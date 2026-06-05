import os
import sys
import json
import logging
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project directory to sys.path to enable local imports
root_path = os.path.dirname(os.path.abspath(__file__))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# Import local modules
from main import initialize_system, MockSession
from a2a.protocol import A2AMessage
from memory.sqlite_memory import (
    get_db_connection, create_ticket, get_ticket, list_tickets,
    get_conversation_history, log_user_feedback, get_escalation
)
from memory.conversation_store import get_session_context, update_session_context
import vectordb.chroma_manager as cm
import agents.registry as registry

# Initialize FastAPI
app = FastAPI(title="Autonomous IT Helpdesk System API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global router and coordinator references
router = None
coordinator = None

# Active mock/ADK sessions mapped by session_id
active_sessions = {}

# --- WEBSOCKET EVENT MANAGER ---

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# Router callback for broadcasting events to WebSocket
def on_router_event(event: dict):
    # Retrieve current event loop or running thread safe loop
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(manager.broadcast(event), loop)
        else:
            # Fallback if loop is not running actively
            loop.run_until_complete(manager.broadcast(event))
    except Exception:
        # Ignore thread-local loop lookup exceptions
        pass

# --- SYSTEM LIFECYCLE ---

@app.on_event("startup")
def startup_event():
    global router, coordinator
    router, coordinator = initialize_system()
    router.register_listener(on_router_event)
    print("FastAPI System initialized and registered listener with Message Router.")

# --- API SCHEMAS ---

class ChatRequest(BaseModel):
    query: str
    session_id: str
    user_id: str

class TicketCreateRequest(BaseModel):
    user_id: str
    category: str
    summary: str

# --- REST ENDPOINTS ---

@app.post("/api/chat")
async def post_chat(req: ChatRequest):
    global router, coordinator
    if not router or not coordinator:
        raise HTTPException(status_code=500, detail="System not initialized.")

    session_id = req.session_id
    user_id = req.user_id
    query = req.query

    # 1. Resolve or create active session
    if session_id not in active_sessions:
        mode = os.environ.get("MODE", "mock").lower()
        if mode == "gemini" and "google.adk" in sys.modules:
            try:
                from google.adk.runners import InMemoryRunner
                runner = InMemoryRunner(agent=coordinator.adk_agent, app_name="helpdesk")
                runner.auto_create_session = True
                session = runner.session_service.create_session_sync(
                    app_name="helpdesk",
                    user_id=user_id,
                    session_id=session_id
                )
                update_session_context(session, user_id=user_id)
                active_sessions[session_id] = session
            except Exception as e:
                # Fallback to local session
                active_sessions[session_id] = MockSession(session_id, user_id)
        else:
            active_sessions[session_id] = MockSession(session_id, user_id)

    session = active_sessions[session_id]
    pre_context = get_session_context(session)

    # Sync context from database if it's a new session or ticket_id is missing
    if not pre_context.get("ticket_id"):
        try:
            conn = get_db_connection()
            last_ticket = conn.execute(
                "SELECT * FROM Tickets WHERE user_id = ? ORDER BY ticket_id DESC LIMIT 1",
                (user_id,)
            ).fetchone()
            conn.close()
            if last_ticket:
                update_session_context(
                    session,
                    ticket_id=last_ticket["ticket_id"],
                    ticket_status=last_ticket["status"],
                    issue_category=last_ticket["category"]
                )
                pre_context = get_session_context(session)
        except Exception as e:
            print(f"Error syncing session context from database: {e}")

    # 2. Package A2A Message
    trace_id = "TRC-" + os.urandom(4).hex().upper()
    
    # Broadcast ticket creation or user start events
    await manager.broadcast({
        "event": "agent_started",
        "agent": "coordinator_agent",
        "trace_id": trace_id,
        "session_id": session_id,
        "timestamp": datetime.now().isoformat()
    })

    user_msg = A2AMessage(
        sender="user",
        receiver="coordinator_agent",
        task="user_message",
        payload={
            "query": query,
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": trace_id,
            "_session_obj": session
        }
    )

    # 3. Route message synchronously
    try:
        response_msg = router.send_message(user_msg)
    except Exception as e:
        await manager.broadcast({
            "event": "error",
            "message": str(e),
            "trace_id": trace_id,
            "timestamp": datetime.now().isoformat()
        })
        raise HTTPException(status_code=500, detail=f"A2A execution failed: {str(e)}")

    post_context = get_session_context(session)
    ticket_id = post_context.get("ticket_id")

    await manager.broadcast({
        "event": "agent_completed",
        "agent": "coordinator_agent",
        "trace_id": trace_id,
        "session_id": session_id,
        "ticket_id": ticket_id,
        "timestamp": datetime.now().isoformat()
    })

    # Retrieve all A2A logs generated during this trace
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM A2ALogs WHERE trace_id = ? ORDER BY id ASC", (trace_id,)).fetchall()
    a2a_logs = [dict(r) for r in rows]
    
    # Also fetch if there is feedback / escalations triggered
    feedback_rows = conn.execute("SELECT * FROM Feedback WHERE ticket_id = ? ORDER BY feedback_id DESC LIMIT 1", (ticket_id,)).fetchall()
    feedback = dict(feedback_rows[0]) if feedback_rows else None
    
    escalation_rows = conn.execute("SELECT * FROM Escalations WHERE ticket_id = ?", (ticket_id,)).fetchall()
    escalation = dict(escalation_rows[0]) if escalation_rows else None
    
    # Fetch updated ticket object from DB
    db_ticket = conn.execute("SELECT * FROM Tickets WHERE ticket_id = ?", (ticket_id,)).fetchone() if ticket_id else None
    conn.close()

    # Broadcast status changes and events
    if db_ticket:
        db_ticket_dict = dict(db_ticket)
        # Broadcast ticket update event
        await manager.broadcast({
            "event": "ticket_updated",
            "ticket_id": f"TCK-{ticket_id}",
            "status": db_ticket_dict["status"],
            "timestamp": datetime.now().isoformat()
        })
        
        # If resolved, broadcast resolution details
        if db_ticket_dict["status"] == "resolved":
            await manager.broadcast({
                "event": "ticket_resolved",
                "ticket_id": f"TCK-{ticket_id}",
                "user_id": db_ticket_dict["user_id"],
                "category": db_ticket_dict["category"],
                "summary": db_ticket_dict["summary"],
                "resolution_summary": db_ticket_dict.get("resolution_summary"),
                "resolution_source": db_ticket_dict.get("resolution_source"),
                "resolved_at": db_ticket_dict.get("resolved_at"),
                "timestamp": datetime.now().isoformat()
            })

    # If escalated, broadcast escalation event
    if escalation:
        await manager.broadcast({
            "event": "escalation_triggered",
            "ticket_id": f"TCK-{ticket_id}",
            "priority": escalation.get("priority"),
            "team": escalation.get("recommended_team"),
            "timestamp": datetime.now().isoformat()
        })

    return {
        "query_response": response_msg.payload.get("query_response"),
        "ticket_id": ticket_id,
        "ticket": dict(db_ticket) if db_ticket else None,
        "session_id": session_id,
        "trace_id": trace_id,
        "a2a_logs": a2a_logs,
        "feedback": feedback,
        "escalation": escalation,
        "session_state": post_context
    }

@app.post("/api/tickets")
async def post_ticket(req: TicketCreateRequest):
    ticket_id = create_ticket(user_id=req.user_id, category=req.category, summary=req.summary, status="open")
    
    # Broadcast ticket creation event
    await manager.broadcast({
        "event": "ticket_created",
        "ticket_id": f"TCK-{ticket_id}",
        "user_id": req.user_id,
        "category": req.category,
        "summary": req.summary,
        "timestamp": datetime.now().isoformat()
    })
    
    return {
        "ticket_id": f"TCK-{ticket_id}",
        "raw_id": ticket_id,
        "success": True,
        "message": "Ticket created successfully."
    }

@app.get("/api/tickets")
async def get_tickets():
    tickets = list_tickets()
    return tickets

@app.get("/api/ticket/{id}")
async def get_ticket_details(id: int):
    ticket = get_ticket(id)
    if not ticket:
        raise HTTPException(status_code=404, detail=f"Ticket TCK-{id} not found.")
    
    history = get_conversation_history(id)
    escalation = get_escalation(id)
    
    return {
        "ticket": ticket,
        "conversation": history,
        "escalation": escalation
    }

@app.get("/api/knowledge/search")
async def get_knowledge_search(q: str = Query(..., min_length=1), limit: int = 3):
    try:
        citations = cm.semantic_search(q, limit=limit)
        return citations
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def get_health():
    db_ok = "Offline"
    db_rows = 0
    try:
        conn = get_db_connection()
        db_rows = conn.execute("SELECT COUNT(*) FROM Users").fetchone()[0]
        conn.close()
        db_ok = "Online"
    except Exception:
        pass

    chroma_ok = "Offline"
    chroma_count = 0
    try:
        import chromadb
        client = chromadb.PersistentClient(path=cm.VECTORDB_DIR)
        col = client.get_collection("kb_articles")
        chroma_count = col.count()
        chroma_ok = "Online"
    except Exception:
        pass

    # Read logs folder details
    log_sizes = {}
    logs_dir = os.path.join(root_path, "logs")
    if os.path.exists(logs_dir):
        for log_file in ["system.log", "a2a.log", "mcp.log", "agent.log"]:
            path = os.path.join(logs_dir, log_file)
            if os.path.exists(path):
                log_sizes[log_file] = f"{os.path.getsize(path) / 1024:.2f} KB"

    return {
        "status": "healthy" if db_ok == "Online" and chroma_ok == "Online" else "degraded",
        "database": {"status": db_ok, "seeded_users": db_rows},
        "vector_db": {"status": chroma_ok, "indexed_segments": chroma_count},
        "log_files": log_sizes,
        "execution_mode": os.environ.get("MODE", "mock").upper(),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/agents")
async def get_agents():
    # Hardcoded agent data enriched with registry mappings
    agents_list = []
    for name in ["coordinator_agent", "classification_agent", "troubleshooting_agent", "knowledge_agent", "escalation_agent"]:
        try:
            inst = registry.get_agent(name)
            status = "Online"
            conn_type = "Google ADK Agent" if getattr(inst, "mode", "mock") == "gemini" else "Mock Rule Heuristic"
        except Exception:
            status = "Offline"
            conn_type = "Unknown"
        agents_list.append({
            "name": name,
            "status": status,
            "type": conn_type,
            "mode": os.environ.get("MODE", "mock").upper()
        })
    return agents_list

@app.get("/api/memory")
async def get_memory(session_id: str):
    if session_id not in active_sessions:
        return {}
    session = active_sessions[session_id]
    context = get_session_context(session)
    return context

@app.get("/api/a2a/logs")
async def get_a2a_logs_api():
    try:
        conn = get_db_connection()
        rows = conn.execute("SELECT * FROM A2ALogs ORDER BY id DESC LIMIT 100").fetchall()
        logs = []
        for r in rows:
            d = dict(r)
            try:
                if isinstance(d["payload"], str):
                    d["payload"] = json.loads(d["payload"])
            except Exception:
                pass
            logs.append(d)
        conn.close()
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/logs")
async def get_logs_api(file: str = Query("system.log"), lines: int = Query(50)):
    logs_dir = os.path.join(root_path, "logs")
    log_file_path = os.path.join(logs_dir, file)
    if not os.path.abspath(log_file_path).startswith(os.path.abspath(logs_dir)):
        raise HTTPException(status_code=403, detail="Access denied.")
    if not os.path.exists(log_file_path):
        return []
    try:
        with open(log_file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.readlines()
            tail = content[-lines:]
            return [line.strip() for line in tail]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- WEBSOCKET ENDPOINT ---

@app.websocket("/ws/events")
async def websocket_events(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Stream connection confirmation
        await websocket.send_json({
            "event": "connected",
            "message": "Real-time event stream connected successfully.",
            "timestamp": datetime.now().isoformat()
        })
        while True:
            # Keep connection alive, listen for messages if needed
            data = await websocket.receive_text()
            # Echo or ignore
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)

# --- STATIC FILES SERVING (React Production SPA) ---

frontend_dist = os.path.join(root_path, "frontend", "dist")
if os.path.exists(frontend_dist):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
        print("Mounted static /assets directory.")
    
    # Catch-all route to serve index.html for SPA routes
    @app.get("/{catchall:path}")
    async def serve_spa(catchall: str):
        # Prevent catching API, WebSocket, and assets routes
        if catchall.startswith("api/") or catchall.startswith("ws/") or catchall.startswith("assets/"):
            raise HTTPException(status_code=404, detail="Not Found")
        
        # Check if the file exists under dist (e.g. public files like favicon.ico)
        file_path = os.path.join(frontend_dist, catchall)
        if catchall and os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_dist, "index.html"))
    print("Registered SPA catch-all fallback route.")
else:
    print("Static frontend production build folder 'frontend/dist' not found. Backend will only serve API endpoints.")

# --- RUN BLOCK ---

if __name__ == "__main__":
    import uvicorn
    # Check if we should disable reload to avoid conflict with file updates in production
    reload_mode = os.path.exists(frontend_dist) is False
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=reload_mode)
