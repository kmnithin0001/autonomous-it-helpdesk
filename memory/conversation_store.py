import os
from typing import Dict, Any, List, Optional
from memory.sqlite_memory import get_db_connection, log_conversation_message

def get_session_context(session: Any) -> Dict[str, Any]:
    """Retrieves short-term context from the ADK Session state or a dict-like container.
    
    Args:
        session: An ADK Session object or a standard dictionary containing session state.
        
    Returns:
        A dictionary containing the parsed support session fields.
    """
    if session is None:
        return {}
    
    # 1. Resolve state object (either session.state or the session itself if it's a dict)
    state = getattr(session, "state", session)
    
    # 2. If it's an ADK State object, convert to dictionary if needed or access via dict get
    if not isinstance(state, dict) and hasattr(state, "to_dict"):
        state_dict = state.to_dict()
    elif isinstance(state, dict):
        state_dict = state
    else:
        # Fallback for dict-like interface if it supports get
        state_dict = {}
        for key in ["user_id", "ticket_id", "issue_category", "ticket_status", 
                    "diagnostic_steps", "knowledge_articles", "escalation_status"]:
            if hasattr(state, "get"):
                state_dict[key] = state.get(key)
            elif hasattr(state, key):
                state_dict[key] = getattr(state, key)
                
    # 3. Pull required keys with correct type fallbacks
    context = {
        "user_id": state_dict.get("user_id"),
        "ticket_id": state_dict.get("ticket_id"),
        "issue_category": state_dict.get("issue_category"),
        "ticket_status": state_dict.get("ticket_status"),
        "diagnostic_steps": state_dict.get("diagnostic_steps"),
        "knowledge_articles": state_dict.get("knowledge_articles"),
        "escalation_status": state_dict.get("escalation_status")
    }
    
    # Ensure list types are instantiated
    if context["diagnostic_steps"] is None:
        context["diagnostic_steps"] = []
    if context["knowledge_articles"] is None:
        context["knowledge_articles"] = []
        
    return context

def update_session_context(session: Any, **kwargs: Any) -> None:
    """Updates context keys in the ADK Session state or a dict-like container.
    
    Args:
        session: The ADK Session or local dictionary to update.
        kwargs: The key-value pairs to set in session state.
    """
    if session is None:
        return
    
    # Resolve state object
    state = getattr(session, "state", session)
    
    for key, val in kwargs.items():
        # Handle dict/ADK State update
        if isinstance(state, dict):
            state[key] = val
        elif hasattr(state, "__setitem__"):
            state[key] = val
        else:
            try:
                setattr(state, key, val)
            except Exception:
                # Log or ignore if read-only attribute
                pass

def load_previous_tickets(user_id: str) -> List[Dict[str, Any]]:
    """Loads historical tickets for a user from SQLite database.
    
    Args:
        user_id: The employee's unique user identifier.
        
    Returns:
        A list of dictionaries representing the user's past tickets.
    """
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM Tickets 
        WHERE user_id = ? 
        ORDER BY ticket_id DESC
    """, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_conversation(ticket_id: int, speaker: str, message: str) -> bool:
    """Saves a conversation turn to SQLite and returns success status.
    
    Args:
        ticket_id: The ID of the ticket.
        speaker: The sender of the message ('User', 'System', or Agent Name).
        message: The actual message content.
        
    Returns:
        True if the conversation turn was logged successfully, False otherwise.
    """
    return log_conversation_message(ticket_id, speaker, message)
