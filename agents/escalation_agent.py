import os
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Load centralized logging configurations
from logs.logging_config import agent_logger, mcp_logger

class EscalationResult(BaseModel):
    """Pydantic model representing structured escalation outputs."""
    priority: str = Field(description="The priority of the escalation: Low, Medium, High, or Critical.")
    recommended_team: str = Field(description="The Level-2 team to assign the ticket to (e.g. Network Operations).")
    handoff_notes: str = Field(description="Detailed technical handoff notes explaining diagnostics and reason for escalation.")

class EscalationAgent:
    """Agent responsible for routing unresolved tickets to secondary engineering queues."""
    
    def __init__(self):
        self.name = "escalation_agent"
        self.mode = os.environ.get("MODE", "mock").lower()
        
        # Load local Ticket MCP tools for direct execution/registration
        import sys
        root_path = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        mcp_path = os.path.abspath(os.path.join(root_path, "mcp"))
        if mcp_path not in sys.path:
            sys.path.insert(0, mcp_path)
            
        import ticket_mcp
        self.ticket_mcp = ticket_mcp
        
        if self.mode == "gemini":
            try:
                from google.adk import Agent
                self.adk_agent = Agent(
                    name=self.name,
                    model="gemini-2.5-flash",
                    instruction="""
                    Analyze the unresolved ticket. 
                    Select the priority, recommended team, and write comprehensive handoff notes.
                    Use the escalate_ticket tool to log the escalation in the ticket database.
                    Return the result matching the EscalationResult schema.
                    """,
                    tools=[ticket_mcp.escalate_ticket],
                    output_schema=EscalationResult
                )
            except Exception as e:
                agent_logger.warning(f"Failed to initialize ADK Agent for Escalation: {e}. Defaulting to mock mode.")
                self.mode = "mock"

    def handle_a2a_message(self, message: Any) -> Any:
        """Processes incoming A2A escalation messages, saves SQLite escalation records, and returns handoff outputs."""
        from a2a.protocol import A2AMessage
        
        import time
        start_time = time.time()
        
        # Extract payload variables
        ticket_id = message.payload.get("ticket_id")
        category = message.payload.get("category", "Unknown")
        summary = message.payload.get("summary", "")
        diagnostic_steps = message.payload.get("diagnostic_steps", [])
        recommendations = message.payload.get("recommendations", "")
        diagnostic_state = message.payload.get("diagnostic_state", {})
        user_id = message.payload.get("user_id", "U-UNKNOWN")
        session_id = message.payload.get("session_id", "SES-UNKNOWN")
        trace_id = message.payload.get("trace_id", "TRC-UNKNOWN")
        reason = message.payload.get("escalation_reason", "User reported unresolved after troubleshooting")
        
        agent_logger.info(f"[{trace_id}] {self.name} processing escalation for ticket {ticket_id}")
        
        # 1. Compile Priority, Team, and Handoff notes
        if self.mode == "gemini":
            try:
                context_prompt = f"""
                Ticket ID: {ticket_id}
                User ID: {user_id}
                Category: {category}
                Summary: {summary}
                Escalation Reason: {reason}
                
                Diagnostic Checks Run:
                {json.dumps(diagnostic_steps)}
                
                Diagnostic States:
                {json.dumps(diagnostic_state)}
                """
                result = self._run_gemini(context_prompt, user_id, session_id)
            except Exception as e:
                agent_logger.error(f"[{trace_id}] Gemini escalation reasoning failed: {e}. Falling back to mock heuristics.")
                result = self._run_mock(category, summary, reason, diagnostic_steps)
        else:
            result = self._run_mock(category, summary, reason, diagnostic_steps)
            
        # 2. Write Escalation Record in DB via Ticket MCP
        mcp_logger.info(f"Invoking Ticket Operations MCP escalate_ticket for TCK-{ticket_id}")
        escalation_val = {}
        if ticket_id:
            try:
                # Call ticket_mcp function
                res = self.ticket_mcp.escalate_ticket(
                    ticket_id=int(ticket_id),
                    reason=reason,
                    priority=result.priority,
                    recommended_team=result.recommended_team,
                    handoff_notes=result.handoff_notes
                )
                escalation_val = res
                mcp_logger.info(f"Ticket Operations MCP output: {json.dumps(res)}")
            except Exception as e:
                mcp_logger.error(f"Ticket Operations MCP escalation tool failed: {e}")
                escalation_val = {"error": f"Failed to log escalation in DB: {e}"}
                
        latency = time.time() - start_time
        agent_logger.info(f"[{trace_id}] {self.name} completed in {latency*1000:.1f}ms. Escalated to: {result.recommended_team} (Priority: {result.priority})")
        
        # Formulate response message
        response_payload = message.payload.copy()
        response_payload.update({
            "escalated": True,
            "escalation_id": escalation_val.get("escalation_id", -1),
            "priority": result.priority,
            "recommended_team": result.recommended_team,
            "handoff_notes": result.handoff_notes,
            "latency_ms": round(latency * 1000, 2)
        })
        
        return A2AMessage(
            sender=self.name,
            receiver=message.sender,
            task="escalation_response",
            payload=response_payload
        )

    def _run_mock(self, category: str, summary: str, reason: str, diagnostic_steps: List[str]) -> EscalationResult:
        """Heuristic-based mock logic deducing routing targets and compiling handoff templates."""
        cat_lower = category.lower()
        
        # Deduce routing team and priority
        if "vpn" in cat_lower or "network" in cat_lower:
            team = "Network Operations"
            priority = "High"
        elif "password" in cat_lower or "access" in cat_lower:
            team = "Directory Services"
            priority = "Medium"
        elif "printer" in cat_lower or "hardware" in cat_lower:
            team = "Desktop Support"
            priority = "Low"
        elif "software" in cat_lower:
            team = "Application Support"
            priority = "Medium"
        else:
            team = "IT Operations"
            priority = "Low"
            
        # Formulate technical handoff notes
        steps_str = "\n  - ".join(diagnostic_steps) if diagnostic_steps else "None"
        notes = (
            f"=== LEVEL-2 HANDOFF NOTE ===\n"
            f"Employee Issue: {summary}\n"
            f"Escalation Reason: {reason}\n"
            f"Diagnostics Attempted:\n"
            f"  - {steps_str}\n"
            f"IT Assessment: Autonomic Level-1 troubleshooting has failed to resolve this request. "
            f"Local services checks confirm faults. Handoff to {team} for manual intervention."
        )
        
        return EscalationResult(
            priority=priority,
            recommended_team=team,
            handoff_notes=notes
        )

    def _run_gemini(self, context_prompt: str, user_id: str, session_id: str) -> EscalationResult:
        """Invokes the Google ADK runner to evaluate priority and write notes via Gemini reasoning."""
        from google.adk.runners import InMemoryRunner
        from google.genai import types
        
        runner = InMemoryRunner(agent=self.adk_agent, app_name="helpdesk")
        runner.auto_create_session = True
        
        content = types.Content(parts=[types.Part.from_text(text=context_prompt)])
        events = runner.run(user_id=user_id, session_id=session_id, new_message=content)
        
        final_output = None
        for ev in events:
            if ev.error_code:
                raise RuntimeError(f"Escalation ADK error: {ev.error_message}")
            if ev.output:
                final_output = ev.output
                
        if not final_output:
            raise RuntimeError("No output received from Escalation ADK agent.")
            
        if isinstance(final_output, EscalationResult):
            return final_output
            
        if isinstance(final_output, dict):
            return EscalationResult(**final_output)
            
        try:
            data = json.loads(str(final_output))
            return EscalationResult(**data)
        except Exception:
            return EscalationResult(
                priority="Medium",
                recommended_team="IT Support",
                handoff_notes=str(final_output)
            )
