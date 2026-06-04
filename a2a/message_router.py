import time
import os
import json
import logging
from typing import Dict, Any, List, Optional
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.syntax import Syntax

from a2a.protocol import A2AMessage
from memory.sqlite_memory import log_a2a_message

# Load centralized logging configurations
from logs.logging_config import a2a_logger, set_log_context

class MessageRouter:
    """Central router for all Agent-to-Agent (A2A) communications.
    
    Tracks routing latency, logs transactions to SQLite, appends history to the 
    A2A log file, and displays events in real time using Rich panels.
    """
    
    def __init__(self):
        self._agents: Dict[str, Any] = {}
        self.console = Console()
        
    def register_agent(self, agent_name: str, agent_instance: Any) -> None:
        """Registers an agent instance with the routing table.
        
        Args:
            agent_name: Unique identification string for the agent.
            agent_instance: The agent wrapper or executable class.
        """
        self._agents[agent_name.lower().strip()] = agent_instance
        
    def send_message(self, message: A2AMessage) -> A2AMessage:
        """Routes a single A2A message to its target agent.
        
        Args:
            message: The A2AMessage containing transaction parameters.
            
        Returns:
            The A2AMessage response returned by the receiving agent.
        """
        start_time = time.time()
        
        # 1. Resolve trace tracking identifiers
        trace_id = message.payload.get("trace_id")
        if not trace_id:
            trace_id = "TRC-" + os.urandom(4).hex().upper()
            message.payload["trace_id"] = trace_id
            
        session_id = message.payload.get("session_id", "SES-UNKNOWN")
        ticket_id = message.payload.get("ticket_id")
        
        # Synchronize thread logging context before dispatch
        set_log_context(trace_id=trace_id, session_id=session_id, ticket_id=ticket_id)
        
        # 2. Visual log for dispatching event
        self.display_message_rich(message, trace_id, "ROUTING")
        
        receiver_key = message.receiver.lower().strip()
        if receiver_key not in self._agents:
            error_msg = f"Routing failed. Receiver agent '{message.receiver}' is not registered."
            self.console.print(f"[bold red]A2A ERROR:[/bold red] {error_msg}")
            
            # Log failure
            latency = time.time() - start_time
            self.log_message(message, latency, trace_id, session_id, ticket_id, status="FAILED", error=error_msg)
            raise ValueError(error_msg)
            
        agent = self._agents[receiver_key]
        
        # 3. Route execution
        try:
            if hasattr(agent, "handle_a2a_message"):
                response = agent.handle_a2a_message(message)
            else:
                # Fallback to standard callable invocation
                response = agent(message)
        except Exception as e:
            latency = time.time() - start_time
            error_str = f"Exception during execution: {str(e)}"
            self.console.print(f"[bold red]A2A RUNTIME EXCEPTION in '{message.receiver}':[/bold red] {e}")
            
            self.log_message(message, latency, trace_id, session_id, ticket_id, status="ERROR", error=error_str)
            raise e
            
        latency = time.time() - start_time
        
        # 4. Log message transaction to database and log file
        self.log_message(message, latency, trace_id, session_id, ticket_id)
        
        # 5. Display response event details
        if isinstance(response, A2AMessage):
            self.display_message_rich(response, trace_id, f"COMPLETED ({latency*1000:.1f}ms)")
        
        return response

    def broadcast_message(self, sender: str, task: str, payload: dict) -> List[Any]:
        """Broadcasts an instruction message to all registered agents except the sender.
        
        Args:
            sender: The name of the broadcasting agent.
            task: The instruction task name.
            payload: Payload variables.
            
        Returns:
            A list of responses from the participating agents.
        """
        responses = []
        for name in self._agents:
            if name != sender.lower().strip():
                msg = A2AMessage(
                    sender=sender,
                    receiver=name,
                    task=task,
                    payload=payload.copy()
                )
                try:
                    res = self.send_message(msg)
                    responses.append(res)
                except Exception:
                    # Continue broadcasting to other agents even if one fails
                    pass
        return responses

    def log_message(self, message: A2AMessage, latency: float, trace_id: str, 
                    session_id: str, ticket_id: Optional[int], status: str = "SUCCESS", 
                    error: Optional[str] = None) -> None:
        """Logs the A2A transaction details to SQLite database and logs/a2a.log.
        
        Args:
            message: The message that was routed.
            latency: Time in seconds taken to route and process the request.
            trace_id: Observability correlation ID.
            session_id: The ID of the session.
            ticket_id: The ID of the ticket.
            status: Status of the transaction (e.g. SUCCESS, ERROR, FAILED).
            error: Exception text or error details if routing failed.
        """
        # Formulate payload variables to save
        log_payload = {k: v for k, v in message.payload.items() if not k.startswith("_")}
        log_payload["_latency_ms"] = round(latency * 1000, 2)
        log_payload["_status"] = status
        if error:
            log_payload["_error"] = error
            
        # 1. Log to SQLite
        try:
            log_a2a_message(
                trace_id=trace_id,
                session_id=session_id,
                ticket_id=ticket_id,
                sender=message.sender,
                receiver=message.receiver,
                task=message.task,
                payload=log_payload
            )
        except Exception as e:
            # Fallback if DB write fails (e.g., table locks)
            a2a_logger.error(f"Failed to write to SQLite a2a_logs: {e}")
            
        # 2. Log to logs/a2a.log text file
        log_line = {
            "timestamp": datetime_str(),
            "trace_id": trace_id,
            "session_id": session_id,
            "ticket_id": ticket_id,
            "sender": message.sender,
            "receiver": message.receiver,
            "task": message.task,
            "status": status,
            "latency_ms": round(latency * 1000, 2),
            "payload": log_payload
        }
        a2a_logger.info(json.dumps(log_line))

    def display_message_rich(self, message: A2AMessage, trace_id: str, status: str) -> None:
        """Renders colorized message exchange panel logs in the terminal.
        
        Args:
            message: The message to print.
            trace_id: The trace tracking code.
            status: Transaction status/latency label.
        """
        # Deduce colors based on sender/status
        if "ERROR" in status or "FAILED" in status:
            border_style = "bold red"
        elif "COMPLETED" in status:
            border_style = "bold green"
        else:
            border_style = "bold blue"
            
        direction = f"[yellow]{message.sender}[/yellow] -> [cyan]{message.receiver}[/cyan]"
        title = f" A2A Event: {direction} ({status}) "
        
        # Prepare payload content
        clean_payload = {k: v for k, v in message.payload.items() if not k.startswith("_")}
        payload_str = json.dumps(clean_payload, indent=2)
        
        grid = Table.grid(expand=True)
        grid.add_column(style="dim", width=12)
        grid.add_column()
        
        grid.add_row("Task:", f"[bold magenta]{message.task}[/bold magenta]")
        grid.add_row("Trace ID:", f"[yellow]{trace_id}[/yellow]")
        grid.add_row("Payload:", Syntax(payload_str, "json", theme="ansi_dark", background_color="default"))
        
        self.console.print(
            Panel(
                grid,
                title=title,
                border_style=border_style,
                expand=False,
                subtitle=f"Time: {message.timestamp}"
            )
        )

def datetime_str() -> str:
    """Returns the current ISO formatted datetime."""
    from datetime import datetime
    return datetime.now().isoformat()
