import os
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from a2a.protocol import A2AMessage
from memory.conversation_store import get_session_context, update_session_context, save_conversation
from memory.sqlite_memory import create_ticket, log_user_feedback, get_ticket, resolve_ticket

# Load centralized logging configurations
from logs.logging_config import agent_logger

class CoordinatorAgent:
    """The root-level orchestrator agent of the Autonomous IT Helpdesk System.
    
    Manages session state transitions, initiates ticket records, processes user
    feedback loops, and delegates tasks to classification, troubleshooting, and 
    escalation agents via A2A messages.
    """
    
    def __init__(self, router: Any):
        self.name = "coordinator_agent"
        self.mode = os.environ.get("MODE", "mock").lower()
        self.router = router # Router reference for A2A communication
        
        if self.mode == "gemini":
            try:
                from google.adk import Agent
                self.adk_agent = Agent(
                    name=self.name,
                    model="gemini-2.5-flash",
                    instruction="""
                    You are the Helpdesk Coordinator Agent.
                    Review the user conversation history and identify the current ticket status.
                    Delegate tasks to appropriate sub-agents (classification, troubleshooting, escalation)
                    using the message router, and update session state variable contexts.
                    """
                )
            except Exception as e:
                agent_logger.warning(f"Failed to initialize ADK Agent for Coordinator: {e}. Defaulting to mock mode.")
                self.mode = "mock"

    def handle_a2a_message(self, message: A2AMessage) -> A2AMessage:
        """Processes user inputs, manages state transitions, and routes instructions via the A2A router."""
        import time
        start_time = time.time()
        
        payload = message.payload
        query = payload.get("query", "").strip()
        session_id = payload.get("session_id", "SES-UNKNOWN")
        trace_id = payload.get("trace_id", "TRC-UNKNOWN")
        session_obj = payload.get("_session_obj") # Passed by CLI loop to synchronize ADK Session State
        
        # 1. Retrieve session context from ADK Session object or local dictionary
        context = get_session_context(session_obj)
        user_id = context.get("user_id") or payload.get("user_id", "U-UNKNOWN")
        ticket_id = context.get("ticket_id")
        ticket_status = context.get("ticket_status") or "new"
        category = context.get("issue_category")
        diagnostic_steps = context.get("diagnostic_steps", [])
        
        agent_logger.info(f"[{trace_id}] Coordinator processing message. Status: {ticket_status}, User: {user_id}, Ticket ID: {ticket_id}")
        
        response_text = ""
        response_payload = payload.copy()
        
        # Ensure user_id is in session context
        update_session_context(session_obj, user_id=user_id)
        
        # --- STATE MACHINE LOOP ---
        
        # State: NEW / UNINITIALIZED TICKET
        if ticket_status == "new" or not ticket_id:
            # A. Send A2A message to classify ticket
            classify_msg = A2AMessage(
                sender=self.name,
                receiver="classification_agent",
                task="classify_ticket",
                payload={
                    "query": query,
                    "user_id": user_id,
                    "session_id": session_id,
                    "trace_id": trace_id
                }
            )
            classify_res = self.router.send_message(classify_msg)
            
            category = classify_res.payload.get("category", "Unknown")
            confidence = classify_res.payload.get("confidence", 0.0)
            summary = classify_res.payload.get("summary", "IT Support Request")
            
            # B. Create Ticket record in SQLite
            t_id = create_ticket(user_id=user_id, category=category, summary=summary, status="open")
            save_conversation(t_id, "User", query)
            
            # Synchronize session state with ticket creation details
            update_session_context(
                session_obj,
                ticket_id=t_id,
                issue_category=category,
                ticket_status="open"
            )
            response_payload["ticket_id"] = t_id
            
            # C. Evaluate Confidence Score routing rules
            if confidence < 0.60:
                # Flow: Auto-Escalate due to low confidence
                agent_logger.info(f"[{trace_id}] Confidence {confidence:.2f} < 0.60. Auto-escalating.")
                response_text = self._escalate_flow(
                    ticket_id=t_id,
                    category=category,
                    summary=summary,
                    reason=f"Auto-escalated: Low classification confidence ({confidence:.2f})",
                    user_id=user_id,
                    session_id=session_id,
                    trace_id=trace_id,
                    session_obj=session_obj,
                    response_payload=response_payload
                )
            elif confidence >= 0.60 and confidence <= 0.80:
                # Flow: Ask clarifying questions
                agent_logger.info(f"[{trace_id}] Confidence {confidence:.2f} in [0.60, 0.80]. Asking clarifying questions.")
                response_text = f"It looks like you are experiencing an issue related to [bold cyan]{category}[/bold cyan]. Could you please clarify or provide more details about what you are seeing?"
                save_conversation(t_id, "System", response_text)
                update_session_context(session_obj, ticket_status="awaiting_clarification")
            else:
                # Flow: Continue to Troubleshooting
                agent_logger.info(f"[{trace_id}] Confidence {confidence:.2f} > 0.80. Continuing to troubleshooting.")
                response_text = self._troubleshoot_flow(
                    ticket_id=t_id,
                    category=category,
                    summary=summary,
                    query=query,
                    user_id=user_id,
                    session_id=session_id,
                    trace_id=trace_id,
                    session_obj=session_obj,
                    response_payload=response_payload
                )
                
        # State: AWAITING CLARIFICATION
        elif ticket_status == "awaiting_clarification":
            save_conversation(ticket_id, "User", query)
            
            # Append clarification to summary and re-trigger troubleshooting
            ticket = get_ticket(ticket_id)
            old_summary = ticket.get("summary", "IT Support Request") if ticket else ""
            new_summary = f"{old_summary} (Clarified: {query})"
            
            # Proceed directly to troubleshooting (escalating confidence to high based on clarification)
            response_text = self._troubleshoot_flow(
                ticket_id=ticket_id,
                category=category,
                summary=new_summary,
                query=f"{category} - {query}",
                user_id=user_id,
                session_id=session_id,
                trace_id=trace_id,
                session_obj=session_obj,
                response_payload=response_payload
            )

        # State: AWAITING RESOLUTION FEEDBACK
        elif ticket_status == "awaiting_feedback":
            save_conversation(ticket_id, "User", query)
            q_clean = query.lower().strip()
            
            # Evaluate user response
            is_positive = q_clean in ["yes", "y", "solved", "resolved", "it worked", "thanks", "fixed", "yes it did", "yes it does"]
            
            negative_keywords = [
                "no", "not solved", "persists", "did not work", "still failing", 
                "unresolved", "it still doesn't work", "i tried everything", 
                "still doesn't work", "tried everything"
            ]
            is_negative = q_clean in ["no", "n"] or any(neg in q_clean for neg in negative_keywords)
            
            if is_positive:
                # Log success feedback and close ticket
                log_user_feedback(ticket_id, solved=True)
                update_session_context(session_obj, ticket_status="resolved")
                
                response_text = f"Excellent! I have resolved and closed your ticket [green]TCK-{ticket_id}[/green]. Please let me know if you need help with anything else!"
                save_conversation(ticket_id, "System", response_text)
            elif is_negative:
                # Log failure feedback and trigger Escalation Agent over A2A
                log_user_feedback(ticket_id, solved=False)
                
                # Fetch troubleshooting payload parameters for escalation handoff
                diag_state = payload.get("diagnostic_state", {})
                
                response_text = self._escalate_flow(
                    ticket_id=ticket_id,
                    category=category,
                    summary=f"Unresolved: {category}",
                    reason="User reported issue unresolved after attempting recommended troubleshooting steps.",
                    user_id=user_id,
                    session_id=session_id,
                    trace_id=trace_id,
                    session_obj=session_obj,
                    response_payload=response_payload,
                    diagnostic_steps=diagnostic_steps,
                    diagnostic_state=diag_state
                )
            else:
                # Treat as additional detail and re-troubleshoot
                response_text = self._troubleshoot_flow(
                    ticket_id=ticket_id,
                    category=category,
                    summary=f"Follow-up: {category}",
                    query=query,
                    user_id=user_id,
                    session_id=session_id,
                    trace_id=trace_id,
                    session_obj=session_obj,
                    response_payload=response_payload
                )

        # State: TICKET RESOLVED / ESCALATED (End states)
        else:
            # Check if user is reporting failure on the resolved ticket
            q_clean = query.lower().strip()
            negative_keywords = [
                "no", "not solved", "persists", "did not work", "still failing", 
                "unresolved", "it still doesn't work", "i tried everything", 
                "still doesn't work", "tried everything"
            ]
            is_negative = q_clean in ["no", "n"] or any(neg in q_clean for neg in negative_keywords)
            
            if ticket_status == "resolved" and is_negative:
                agent_logger.info(f"[{trace_id}] Ticket {ticket_id} was resolved, but user reports failure: '{query}'. Escalating.")
                log_user_feedback(ticket_id, solved=False)
                
                # Run escalation
                response_text = self._escalate_flow(
                    ticket_id=ticket_id,
                    category=category,
                    summary=f"Unresolved: {category}",
                    reason="User reported issue unresolved after attempting recommended troubleshooting steps.",
                    user_id=user_id,
                    session_id=session_id,
                    trace_id=trace_id,
                    session_obj=session_obj,
                    response_payload=response_payload,
                    diagnostic_steps=diagnostic_steps,
                    diagnostic_state=payload.get("diagnostic_state", {})
                )
            else:
                # Open a new ticket for new requests
                agent_logger.info(f"[{trace_id}] Ticket {ticket_id} is in end state '{ticket_status}'. Opening new ticket.")
                update_session_context(
                    session_obj,
                    ticket_id=None,
                    issue_category=None,
                    ticket_status="new",
                    diagnostic_steps=[],
                    knowledge_articles=[],
                    escalation_status=None
                )
                response_payload["ticket_id"] = None
                
                # Recurse with status reset
                return self.handle_a2a_message(message)

        latency = time.time() - start_time
        response_payload["query_response"] = response_text
        response_payload["latency_ms"] = round(latency * 1000, 2)
        
        return A2AMessage(
            sender=self.name,
            receiver=message.sender,
            task="user_response",
            payload=response_payload
        )

    def _troubleshoot_flow(self, ticket_id: int, category: str, summary: str, query: str,
                           user_id: str, session_id: str, trace_id: str, session_obj: Any,
                           response_payload: dict) -> str:
        """Invokes the Troubleshooting Agent over A2A and formats the diagnostic findings."""
        trouble_msg = A2AMessage(
            sender=self.name,
            receiver="troubleshooting_agent",
            task="troubleshoot_ticket",
            payload={
                "ticket_id": ticket_id,
                "category": category,
                "summary": summary,
                "query": query,
                "user_id": user_id,
                "session_id": session_id,
                "trace_id": trace_id
            }
        )
        
        trouble_res = self.router.send_message(trouble_msg)
        t_payload = trouble_res.payload
        
        steps = t_payload.get("diagnostic_steps", [])
        recs = t_payload.get("recommendations", "")
        plan = t_payload.get("resolution_plan", "")
        doc = t_payload.get("retrieved_doc", "none")
        section = t_payload.get("retrieved_section", "none")
        diag_state = t_payload.get("diagnostic_state", {})
        
        # Update short-term ADK session context
        update_session_context(
            session_obj,
            ticket_status="awaiting_feedback",
            diagnostic_steps=steps,
            knowledge_articles=[doc]
        )
        
        # Auto-resolve the ticket in the database upon successful generation of troubleshooting resolution
        resolve_ticket(
            ticket_id=ticket_id,
            summary=recs,
            source=doc
        )
        
        # Update payload parameters to pass back to CLI (for feedback loops)
        response_payload["diagnostic_state"] = diag_state
        response_payload["diagnostic_steps"] = steps
        
        # Compile response text
        response_text = (
            f"[bold green]Diagnostic Investigation Completed:[/bold green]\n"
            f"  - Verified checks: {', '.join(steps)}\n\n"
            f"[bold green]Knowledge Citation Reference:[/bold green]\n"
            f"  - Source: [yellow]{doc}[/yellow] (Section: [cyan]{section}[/cyan])\n\n"
            f"[bold green]IT Recommendation:[/bold green]\n"
            f"  {recs}\n\n"
            f"[bold green]Resolution Guide Steps:[/bold green]\n"
            f"{plan}\n\n"
            f"Did this solve your problem? (Yes/No)"
        )
        
        save_conversation(ticket_id, "System", response_text)
        return response_text

    def _escalate_flow(self, ticket_id: int, category: str, summary: str, reason: str,
                      user_id: str, session_id: str, trace_id: str, session_obj: Any,
                      response_payload: dict, diagnostic_steps: List[str] = None,
                      diagnostic_state: dict = None) -> str:
        """Invokes the Escalation Agent over A2A and formats the technician handoff logs."""
        escalate_msg = A2AMessage(
            sender=self.name,
            receiver="escalation_agent",
            task="escalate_ticket",
            payload={
                "ticket_id": ticket_id,
                "category": category,
                "summary": summary,
                "escalation_reason": reason,
                "diagnostic_steps": diagnostic_steps or [],
                "diagnostic_state": diagnostic_state or {},
                "user_id": user_id,
                "session_id": session_id,
                "trace_id": trace_id
            }
        )
        
        escalate_res = self.router.send_message(escalate_msg)
        e_payload = escalate_res.payload
        
        priority = e_payload.get("priority", "Medium")
        team = e_payload.get("recommended_team", "IT Support")
        notes = e_payload.get("handoff_notes", "")
        
        # Update short-term ADK session context
        update_session_context(
            session_obj,
            ticket_status="escalated",
            escalation_status="escalated"
        )
        
        # Compile response text
        response_text = (
            f"[bold red]Ticket Escalated to Level-2 Support[/bold red]\n"
            f"  - Ticket ID: [yellow]TCK-{ticket_id}[/yellow]\n"
            f"  - Assigned Queue: [cyan]{team}[/cyan]\n"
            f"  - Priority Level: [bold red]{priority}[/bold red]\n\n"
            f"[bold yellow]Technician Handoff Log:[/bold yellow]\n"
            f"{notes}"
        )
        
        save_conversation(ticket_id, "System", response_text)
        return response_text
