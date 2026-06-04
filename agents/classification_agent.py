import os
import json
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

# Load centralized logging configurations
from logs.logging_config import agent_logger

class ClassificationResult(BaseModel):
    """Pydantic model representing structured classification response from the agent."""
    category: str = Field(description="The mapped IT issue category (e.g. 'VPN Issue', 'Password Reset').")
    confidence: float = Field(description="Confidence score of classification, between 0.0 and 1.0.")
    summary: str = Field(description="Concise summary of the user's issue.")

class ClassificationAgent:
    """Agent responsible for identifying the category and summary of an IT support ticket."""
    
    def __init__(self):
        self.name = "classification_agent"
        self.mode = os.environ.get("MODE", "mock").lower()
        
        if self.mode == "gemini":
            try:
                from google.adk import Agent
                self.adk_agent = Agent(
                    name=self.name,
                    model="gemini-2.5-flash",
                    instruction="""
                    Analyze the user's IT support request and classify it into one of these exact categories:
                    - Network Issue
                    - Software Issue
                    - Hardware Issue
                    - Email Issue
                    - Access Issue
                    - Password Reset
                    - VPN Issue
                    - Printer Issue
                    - Unknown

                    Provide a confidence score between 0.0 and 1.0 representing how confident you are.
                    Provide a concise summary of the issue.
                    """,
                    output_schema=ClassificationResult
                )
            except Exception as e:
                agent_logger.warning(f"Failed to initialize ADK Agent for Classification: {e}. Defaulting to mock mode.")
                self.mode = "mock"
                
    def handle_a2a_message(self, message: Any) -> Any:
        """Processes incoming A2A messages and returns classification payload response."""
        from a2a.protocol import A2AMessage
        
        # Start performance tracing
        import time
        start_time = time.time()
        
        query = message.payload.get("query", "")
        user_id = message.payload.get("user_id", "U-UNKNOWN")
        session_id = message.payload.get("session_id", "SES-UNKNOWN")
        ticket_id = message.payload.get("ticket_id")
        trace_id = message.payload.get("trace_id", "TRC-UNKNOWN")
        
        agent_logger.info(f"[{trace_id}] {self.name} processing query: '{query}'")
        
        # Branch depending on execution mode
        if self.mode == "gemini":
            try:
                result = self._run_gemini(query, user_id, session_id)
            except Exception as e:
                agent_logger.error(f"[{trace_id}] Gemini classification failed: {e}. Falling back to mock rules.")
                result = self._run_mock(query)
        else:
            result = self._run_mock(query)
            
        latency = time.time() - start_time
        agent_logger.info(f"[{trace_id}] {self.name} completed in {latency*1000:.1f}ms. Category: {result.category} ({result.confidence})")
        
        # Formulate response message
        response_payload = message.payload.copy()
        response_payload.update({
            "category": result.category,
            "confidence": result.confidence,
            "summary": result.summary,
            "latency_ms": round(latency * 1000, 2)
        })
        
        return A2AMessage(
            sender=self.name,
            receiver=message.sender, # Return to sender (Coordinator)
            task="classification_response",
            payload=response_payload
        )

    def _run_mock(self, query: str) -> ClassificationResult:
        """Rule-based mock classifier to handle local execution and testing configurations."""
        q = query.lower().strip()
        
        # Ambiguous inputs to trigger clarification flow (0.60 - 0.80)
        if q in ["help", "it is broken", "error message", "can't connect", "not working"]:
            return ClassificationResult(
                category="Network Issue",
                confidence=0.70,
                summary="Ambiguous network or client connection issue reported."
            )
            
        # Low confidence inputs to trigger auto-escalation flow (< 0.60)
        if q in ["urgent", "need help now", "broken system", "crash", "stuck"]:
            return ClassificationResult(
                category="Unknown",
                confidence=0.45,
                summary="Unclassified critical system issue."
            )
            
        # Standard high confidence categories (> 0.80)
        if any(w in q for w in ["vpn", "pulse", "cisco", "anyconnect"]):
            return ClassificationResult(
                category="VPN Issue",
                confidence=0.95,
                summary="User experiencing VPN connectivity issues."
            )
        elif any(w in q for w in ["password", "reset", "passwordreset", "lockout", "locked out", "login"]):
            return ClassificationResult(
                category="Password Reset",
                confidence=0.98,
                summary="Active Directory password reset request."
            )
        elif any(w in q for w in ["printer", "print", "spooler", "paper", "toner"]):
            return ClassificationResult(
                category="Printer Issue",
                confidence=0.96,
                summary="Corporate network printer queue or driver issue."
            )
        elif any(w in q for w in ["email", "outlook", "mailbox", "shared mailbox", "webmail"]):
            return ClassificationResult(
                category="Email Issue",
                confidence=0.92,
                summary="Outlook desktop client configuration or mailbox access issue."
            )
        elif any(w in q for w in ["network", "wifi", "internet", "offline", "ethernet", "router"]):
            return ClassificationResult(
                category="Network Issue",
                confidence=0.88,
                summary="Local network gateway or internet connectivity issue."
            )
        elif any(w in q for w in ["install", "software", "license", "chrome", "slack", "adobe"]):
            return ClassificationResult(
                category="Software Issue",
                confidence=0.90,
                summary="Self-service software portal or license activation request."
            )
        elif any(w in q for w in ["access", "permission", "share", "folder", "drive"]):
            return ClassificationResult(
                category="Access Issue",
                confidence=0.85,
                summary="Shared folder permission or folder drive access request."
            )
        elif any(w in q for w in ["hardware", "keyboard", "mouse", "monitor", "screen"]):
            return ClassificationResult(
                category="Hardware Issue",
                confidence=0.82,
                summary="Local peripheral hardware device issue."
            )
            
        # Default unknown
        return ClassificationResult(
            category="Unknown",
            confidence=0.35,
            summary="IT support request with unidentifiable category."
        )

    def _run_gemini(self, query: str, user_id: str, session_id: str) -> ClassificationResult:
        """Invokes the Google ADK runner to perform structured Gemini model classification."""
        from google.adk.runners import InMemoryRunner
        from google.genai import types
        
        runner = InMemoryRunner(agent=self.adk_agent, app_name="helpdesk")
        runner.auto_create_session = True
        
        content = types.Content(parts=[types.Part.from_text(text=query)])
        events = runner.run(user_id=user_id, session_id=session_id, new_message=content)
        
        final_output = None
        for ev in events:
            if ev.error_code:
                raise RuntimeError(f"Classification ADK error: {ev.error_message}")
            if ev.output:
                final_output = ev.output
                
        # If output was not structured but text, parse it manually
        if not final_output:
            raise RuntimeError("No output received from Classification ADK agent.")
            
        if isinstance(final_output, ClassificationResult):
            return final_output
            
        # In case the output is returned as dictionary or string
        if isinstance(final_output, dict):
            return ClassificationResult(**final_output)
            
        # Try to parse string JSON if returned as text
        try:
            data = json.loads(str(final_output))
            return ClassificationResult(**data)
        except Exception:
            # Hard fallback
            return ClassificationResult(
                category="Unknown",
                confidence=0.50,
                summary=str(final_output)
            )
