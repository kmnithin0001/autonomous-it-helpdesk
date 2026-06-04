import os
import json
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

# Load centralized logging configurations
from logs.logging_config import agent_logger

class KnowledgeResult(BaseModel):
    """Pydantic model representing structured knowledge lookup results."""
    document: str = Field(description="The guide filename (e.g. 'vpn_guide.txt').")
    section: str = Field(description="The matching section title (e.g. 'Restart VPN Service').")
    confidence: float = Field(description="Match confidence score between 0.0 and 1.0.")
    content: str = Field(description="The troubleshooting content of the guide section.")

class KnowledgeAgent:
    """Agent responsible for querying organizational documentation and returning citations."""
    
    def __init__(self):
        self.name = "knowledge_agent"
        self.mode = os.environ.get("MODE", "mock").lower()
        
        # Load embedding and search helpers
        import vectordb.chroma_manager as cm
        self.cm = cm
        
        if self.mode == "gemini":
            try:
                from google.adk import Agent
                
                # Expose search tool to ADK Agent
                def search_kb(query: str) -> str:
                    """Search the corporate knowledge base and return matching article text."""
                    results = cm.semantic_search(query, limit=1)
                    if results:
                        return json.dumps(results[0])
                    return "No matching documentation found."
                
                self.adk_agent = Agent(
                    name=self.name,
                    model="gemini-2.5-flash",
                    instruction="""
                    Use the search_kb tool to find relevant troubleshooting articles.
                    Extract the matching document file name, section name, match confidence, and content.
                    Return them in the output schema format.
                    """,
                    tools=[search_kb],
                    output_schema=KnowledgeResult
                )
            except Exception as e:
                agent_logger.warning(f"Failed to initialize ADK Agent for Knowledge: {e}. Defaulting to mock mode.")
                self.mode = "mock"

    def handle_a2a_message(self, message: Any) -> Any:
        """Processes incoming A2A search messages and returns guide citations."""
        from a2a.protocol import A2AMessage
        
        import time
        start_time = time.time()
        
        query = message.payload.get("query", "")
        user_id = message.payload.get("user_id", "U-UNKNOWN")
        session_id = message.payload.get("session_id", "SES-UNKNOWN")
        ticket_id = message.payload.get("ticket_id")
        trace_id = message.payload.get("trace_id", "TRC-UNKNOWN")
        
        agent_logger.info(f"[{trace_id}] {self.name} searching knowledge for: '{query}'")
        
        if self.mode == "gemini":
            try:
                result = self._run_gemini(query, user_id, session_id)
            except Exception as e:
                agent_logger.error(f"[{trace_id}] Gemini knowledge search failed: {e}. Falling back to mock RAG lookup.")
                result = self._run_mock(query)
        else:
            result = self._run_mock(query)
            
        latency = time.time() - start_time
        agent_logger.info(f"[{trace_id}] {self.name} completed in {latency*1000:.1f}ms. Citation: {result.document} - {result.section} (Conf: {result.confidence})")
        
        # Package response message
        response_payload = message.payload.copy()
        response_payload.update({
            "document": result.document,
            "section": result.section,
            "confidence": result.confidence,
            "content": result.content,
            "latency_ms": round(latency * 1000, 2)
        })
        
        return A2AMessage(
            sender=self.name,
            receiver=message.sender,
            task="knowledge_response",
            payload=response_payload
        )

    def _run_mock(self, query: str) -> KnowledgeResult:
        """Heuristic-based RAG lookup querying local database indexes directly."""
        results = self.cm.semantic_search(query, limit=1)
        if results:
            first = results[0]
            return KnowledgeResult(
                document=first.get("document", "unknown.txt"),
                section=first.get("section", "General Troubleshooting"),
                confidence=first.get("confidence", 0.50),
                content=first.get("content", "")
            )
            
        return KnowledgeResult(
            document="none",
            section="none",
            confidence=0.0,
            content="No matching knowledge articles found in the database."
        )

    def _run_gemini(self, query: str, user_id: str, session_id: str) -> KnowledgeResult:
        """Invokes the Google ADK runner to process the semantic lookup using LLM reasoning."""
        from google.adk.runners import InMemoryRunner
        from google.genai import types
        
        runner = InMemoryRunner(agent=self.adk_agent, app_name="helpdesk")
        runner.auto_create_session = True
        
        content = types.Content(parts=[types.Part.from_text(text=query)])
        events = runner.run(user_id=user_id, session_id=session_id, new_message=content)
        
        final_output = None
        for ev in events:
            if ev.error_code:
                raise RuntimeError(f"Knowledge ADK error: {ev.error_message}")
            if ev.output:
                final_output = ev.output
                
        if not final_output:
            raise RuntimeError("No output received from Knowledge ADK agent.")
            
        if isinstance(final_output, KnowledgeResult):
            return final_output
            
        if isinstance(final_output, dict):
            return KnowledgeResult(**final_output)
            
        try:
            data = json.loads(str(final_output))
            return KnowledgeResult(**data)
        except Exception:
            return KnowledgeResult(
                document="none",
                section="none",
                confidence=0.50,
                content=str(final_output)
            )
