# 1. Import FastMCP first (while sys.path is clean) to load the official mcp package
from fastmcp import FastMCP

# 2. Add project root to sys.path to enable local imports
import sys
import os
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# 3. Load local modules
import memory.sqlite_memory as db

# Initialize FastMCP Server for Tickets
mcp = FastMCP("Ticket Operations MCP")

@mcp.tool()
def create_ticket(user_id: str, category: str, summary: str) -> dict:
    """Create a new IT support ticket in the database.
    
    Args:
        user_id: The unique employee ID (e.g. 'U101').
        category: The ticket classification category (e.g. 'VPN Issue').
        summary: A short description of the problem.
    """
    # Create the ticket in SQLite
    t_id = db.create_ticket(user_id=user_id, category=category, summary=summary, status="open")
    formatted_id = f"TCK-{t_id}"
    
    # Log initial system update in the conversation
    db.log_conversation_message(t_id, "System", f"Ticket created. Summary: {summary}")
    
    return {
        "ticket_id": formatted_id,
        "raw_id": t_id,
        "user_id": user_id,
        "category": category,
        "summary": summary,
        "status": "open",
        "message": "Ticket created successfully."
    }

@mcp.tool()
def update_ticket(ticket_id: int, status: str) -> dict:
    """Update the status of an existing ticket (e.g. 'open', 'resolved', 'escalated').
    
    Args:
        ticket_id: The integer ID of the ticket.
        status: The target status value.
    """
    success = db.update_ticket_status(ticket_id, status)
    if not success:
        return {"error": f"Ticket ID {ticket_id} not found or update failed."}
        
    db.log_conversation_message(ticket_id, "System", f"Ticket status updated to: {status}")
    return {
        "ticket_id": f"TCK-{ticket_id}",
        "status": status,
        "success": True,
        "message": f"Ticket status updated successfully to {status}."
    }

@mcp.tool()
def close_ticket(ticket_id: int, resolution_notes: str) -> dict:
    """Resolve and close a support ticket.
    
    Args:
        ticket_id: The integer ID of the ticket.
        resolution_notes: Notes explaining how the issue was resolved.
    """
    success = db.update_ticket_status(ticket_id, "resolved")
    if not success:
        return {"error": f"Ticket ID {ticket_id} not found or resolution update failed."}
        
    db.log_conversation_message(ticket_id, "System", f"Ticket resolved. Notes: {resolution_notes}")
    return {
        "ticket_id": f"TCK-{ticket_id}",
        "status": "resolved",
        "success": True,
        "resolution_notes": resolution_notes,
        "message": "Ticket marked as resolved."
    }

@mcp.tool()
def escalate_ticket(ticket_id: int, reason: str, priority: str, recommended_team: str, handoff_notes: str) -> dict:
    """Escalate a ticket to a Level-2 support team.
    
    Args:
        ticket_id: The integer ID of the ticket.
        reason: The reason for the escalation (e.g. 'unresolved').
        priority: The priority of the escalation ('Low', 'Medium', 'High', 'Critical').
        recommended_team: The team to assign the ticket to (e.g. 'Network Operations').
        handoff_notes: Detailed handoff notes for the Level-2 engineer.
    """
    try:
        esc_id = db.create_escalation(
            ticket_id=ticket_id,
            reason=reason,
            priority=priority,
            recommended_team=recommended_team,
            handoff_notes=handoff_notes
        )
        # Log system message
        db.log_conversation_message(ticket_id, "System", f"Ticket escalated to {recommended_team} (Priority: {priority}). Reason: {reason}")
        return {
            "escalation_id": esc_id,
            "ticket_id": f"TCK-{ticket_id}",
            "status": "escalated",
            "priority": priority,
            "assigned_team": recommended_team,
            "success": True,
            "message": f"Ticket escalated successfully to {recommended_team}."
        }
    except Exception as e:
        return {"error": f"Escalation failed: {str(e)}"}

if __name__ == "__main__":
    # Start the FastMCP stdio server loop
    mcp.run()
