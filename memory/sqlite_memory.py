import sqlite3
import os
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "helpdesk.db")

def get_db_connection():
    """Establishes and returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database and creates the required tables if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Users (
        user_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        department TEXT NOT NULL,
        manager_name TEXT NOT NULL
    )
    """)
    
    # 2. Tickets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Tickets (
        ticket_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        category TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES Users(user_id)
    )
    """)
    
    # 3. Conversations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        speaker TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(ticket_id) REFERENCES Tickets(ticket_id)
    )
    """)
    
    # 4. Escalations Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Escalations (
        escalation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        priority TEXT NOT NULL,
        recommended_team TEXT NOT NULL,
        handoff_notes TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(ticket_id) REFERENCES Tickets(ticket_id)
    )
    """)
    
    # 5. KnowledgeSearches Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS KnowledgeSearches (
        search_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        query TEXT NOT NULL,
        results TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY(ticket_id) REFERENCES Tickets(ticket_id)
    )
    """)
    
    # 6. A2ALogs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS A2ALogs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        ticket_id INTEGER,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        task TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)
    
    # 7. Feedback Table (New for the feedback loop requirement)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Feedback (
        feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticket_id INTEGER NOT NULL,
        solved INTEGER NOT NULL, -- 1 for Yes, 0 for No
        timestamp TEXT NOT NULL,
        FOREIGN KEY(ticket_id) REFERENCES Tickets(ticket_id)
    )
    """)
    
    conn.commit()
    conn.close()
    
    # Seed mock users if empty
    seed_mock_users()

def seed_mock_users():
    """Seeds the database with mock employee users."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM Users")
    if cursor.fetchone()[0] == 0:
        mock_users = [
            ("U101", "Alice Smith", "alice.smith@company.com", "Engineering", "Bob Jones"),
            ("U102", "Charlie Miller", "charlie.miller@company.com", "Marketing", "Sarah Jenkins"),
            ("U103", "Dan Rogers", "dan.rogers@company.com", "Human Resources", "Sarah Jenkins"),
            ("U104", "Emma Watson", "emma.watson@company.com", "Finance", "David Vance"),
        ]
        cursor.executemany("""
        INSERT INTO Users (user_id, name, email, department, manager_name)
        VALUES (?, ?, ?, ?, ?)
        """, mock_users)
        conn.commit()
    
    conn.close()

# --- CRUD HELPER FUNCTIONS ---

# Users CRUD
def get_user(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieves user directory information by user_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Users WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def create_user(user_id: str, name: str, email: str, department: str, manager_name: str) -> bool:
    """Inserts a new user record or updates if already exists."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
        INSERT OR REPLACE INTO Users (user_id, name, email, department, manager_name)
        VALUES (?, ?, ?, ?, ?)
        """, (user_id, name, email, department, manager_name))
        conn.commit()
        success = True
    except Exception:
        success = False
    finally:
        conn.close()
    return success

# Tickets CRUD
def create_ticket(user_id: str, category: str, summary: str, status: str = 'open') -> int:
    """Creates a new ticket record and returns its ticket_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO Tickets (user_id, category, summary, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, category, summary, status, now_str, now_str))
    ticket_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return ticket_id

def get_ticket(ticket_id: int) -> Optional[Dict[str, Any]]:
    """Retrieves ticket details by ticket_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Tickets WHERE ticket_id = ?", (ticket_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def update_ticket_status(ticket_id: int, status: str) -> bool:
    """Updates the status of an existing ticket."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    cursor.execute("""
    UPDATE Tickets SET status = ?, updated_at = ? WHERE ticket_id = ?
    """, (status, now_str, ticket_id))
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    return rows_affected > 0

def list_tickets() -> List[Dict[str, Any]]:
    """Lists all tickets currently stored in the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Tickets ORDER BY ticket_id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Conversations CRUD
def log_conversation_message(ticket_id: int, speaker: str, message: str) -> bool:
    """Logs a single message turn in a ticket conversation."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    try:
        cursor.execute("""
        INSERT INTO Conversations (ticket_id, speaker, message, timestamp)
        VALUES (?, ?, ?, ?)
        """, (ticket_id, speaker, message, now_str))
        conn.commit()
        success = True
    except Exception:
        success = False
    finally:
        conn.close()
    return success

def get_conversation_history(ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieves all conversation history for a given ticket."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Conversations WHERE ticket_id = ? ORDER BY id ASC", (ticket_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Escalations CRUD
def create_escalation(ticket_id: int, reason: str, priority: str, recommended_team: str, handoff_notes: str) -> int:
    """Creates an escalation record and marks the ticket as 'escalated'."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    
    # 1. Create Escalation Record
    cursor.execute("""
    INSERT INTO Escalations (ticket_id, reason, priority, recommended_team, handoff_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (ticket_id, reason, priority, recommended_team, handoff_notes, now_str))
    escalation_id = cursor.lastrowid
    
    # 2. Update Ticket Status
    cursor.execute("""
    UPDATE Tickets SET status = 'escalated', updated_at = ? WHERE ticket_id = ?
    """, (now_str, ticket_id))
    
    conn.commit()
    conn.close()
    return escalation_id

def get_escalation(ticket_id: int) -> Optional[Dict[str, Any]]:
    """Gets escalation record details by ticket_id."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Escalations WHERE ticket_id = ?", (ticket_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

# KnowledgeSearches CRUD
def log_knowledge_search(ticket_id: int, query: str, results: List[Dict[str, Any]]) -> int:
    """Logs details of a knowledge search query and results citation metadata."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    results_json = json.dumps(results)
    cursor.execute("""
    INSERT INTO KnowledgeSearches (ticket_id, query, results, timestamp)
    VALUES (?, ?, ?, ?)
    """, (ticket_id, query, results_json, now_str))
    search_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return search_id

def get_knowledge_searches(ticket_id: int) -> List[Dict[str, Any]]:
    """Retrieves all logged knowledge searches for a given ticket."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM KnowledgeSearches WHERE ticket_id = ? ORDER BY search_id ASC", (ticket_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# A2ALogs CRUD
def log_a2a_message(trace_id: str, session_id: str, ticket_id: Optional[int], sender: str, receiver: str, task: str, payload: Dict[str, Any]) -> int:
    """Records an Agent-to-Agent message log for tracing and observability."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    payload_json = json.dumps(payload)
    cursor.execute("""
    INSERT INTO A2ALogs (trace_id, session_id, ticket_id, sender, receiver, task, payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (trace_id, session_id, ticket_id, sender, receiver, task, payload_json, now_str))
    log_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return log_id

def get_a2a_logs(session_id: str) -> List[Dict[str, Any]]:
    """Retrieves all A2A logs for a given session."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM A2ALogs WHERE session_id = ? ORDER BY id ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

# Feedback CRUD
def log_user_feedback(ticket_id: int, solved: bool) -> int:
    """Logs the user resolution feedback (Yes/No)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    solved_val = 1 if solved else 0
    cursor.execute("""
    INSERT INTO Feedback (ticket_id, solved, timestamp)
    VALUES (?, ?, ?)
    """, (ticket_id, solved_val, now_str))
    feedback_id = cursor.lastrowid
    
    # If solved, also update ticket to resolved
    if solved:
        cursor.execute("""
        UPDATE Tickets SET status = 'resolved', updated_at = ? WHERE ticket_id = ?
        """, (now_str, ticket_id))
        
    conn.commit()
    conn.close()
    return feedback_id
