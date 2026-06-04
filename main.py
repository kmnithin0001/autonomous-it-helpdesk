import os
import sys
import logging
from typing import Any
from datetime import datetime
from dotenv import load_dotenv

# Load environmental variables from .env
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load centralized logging configurations
from logs.logging_config import system_logger, mcp_logger, set_log_context, clear_log_context, LOGS_DIR

system_logger.info("Initializing IT Helpdesk system startup sequence.")

# Import local packages
from memory.sqlite_memory import init_db, get_user, list_tickets
from vectordb.chroma_manager import initialize_vectordb, semantic_search
from a2a.message_router import MessageRouter
from a2a.protocol import A2AMessage
from memory.conversation_store import get_session_context, update_session_context

# Registry and Agents imports
import agents.registry as registry
from agents.coordinator_agent import CoordinatorAgent
from agents.classification_agent import ClassificationAgent
from agents.troubleshooting_agent import TroubleshootingAgent
from agents.knowledge_agent import KnowledgeAgent
from agents.escalation_agent import EscalationAgent

# Rich imports for visual console layouts
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.text import Text

console = Console()

class MockSession:
    """Mock session class mimicking ADK Session memory for Mock Mode."""
    def __init__(self, session_id: str, user_id: str):
        self.id = session_id
        self.user_id = user_id
        self.state = {
            "user_id": user_id,
            "ticket_id": None,
            "issue_category": None,
            "ticket_status": "new",
            "diagnostic_steps": [],
            "knowledge_articles": [],
            "escalation_status": None
        }

def initialize_system() -> tuple:
    """Runs initialization procedures and registers agents with the A2A router."""
    # 1. Initialize SQLite Database
    init_db()
    system_logger.info("SQLite database schema initialized and seeded.")
    
    # 2. Ingest guides in ChromaDB
    initialize_vectordb()
    system_logger.info("ChromaDB vector collection updated and indexed.")
    
    # 3. Create A2A message router
    router = MessageRouter()
    
    # 4. Instantiate agents
    coord = CoordinatorAgent(router=router)
    cl = ClassificationAgent()
    ta = TroubleshootingAgent(router=router)
    ka = KnowledgeAgent()
    ea = EscalationAgent()
    
    # 5. Register with Dynamic Registry
    registry.register_agent("coordinator_agent", coord)
    registry.register_agent("classification_agent", cl)
    registry.register_agent("troubleshooting_agent", ta)
    registry.register_agent("knowledge_agent", ka)
    registry.register_agent("escalation_agent", ea)
    system_logger.info("IT Support agents registered with global registry.")
    
    # 6. Register with A2A Router
    router.register_agent("coordinator_agent", coord)
    router.register_agent("classification_agent", cl)
    router.register_agent("troubleshooting_agent", ta)
    router.register_agent("knowledge_agent", ka)
    router.register_agent("escalation_agent", ea)
    system_logger.info("IT Support agents mapped to A2A routing tables.")
    
    return router, coord

def main():
    """Boots the terminal UI and handles interactive conversation loop."""
    console.clear()
    console.print(
        Panel(
            "[bold green]Autonomous IT Helpdesk System[/bold green]\n"
            "[dim]Powered by Google ADK Framework & Multi-Agent A2A Messaging[/dim]\n\n"
            "Execution Mode: [yellow]" + os.environ.get("MODE", "mock").upper() + "[/yellow]\n"
            "Type [bold cyan]/help[/bold cyan] at any time for list of utility console commands.",
            title=" System Boot Successfully ",
            border_style="bold green"
        )
    )
    
    # Initialize
    router, coordinator = initialize_system()
    
    # 1. Employee verification login
    user_id = ""
    user_profile = None
    while not user_profile:
        user_id_input = console.input("[bold yellow]Please enter your Employee ID (e.g. U101): [/bold yellow]").strip()
        if not user_id_input:
            user_id = "U101"
            user_profile = get_user("U101")
            console.print("[dim]Empty login entered. Defaulting to Alice Smith (U101) for demo.[/dim]")
        else:
            user_profile = get_user(user_id_input)
            if not user_profile:
                console.print(f"[bold red]Error:[/bold red] Employee ID '{user_id_input}' not found in Directory. Try U101, U102, U103, or U104.")
            else:
                user_id = user_id_input
                
    console.print(
        Panel(
            f"Employee:  [bold white]{user_profile['name']}[/bold white] ({user_profile['email']})\n"
            f"Department: [cyan]{user_profile['department']}[/cyan]\n"
            f"Manager:    [magenta]{user_profile['manager_name']}[/magenta]",
            title=" Directory Session Initiated ",
            border_style="cyan"
        )
    )
    
    # 2. Set up Session ID and Memory Storage
    session_id = "SES-" + os.urandom(4).hex().upper()
    mode = os.environ.get("MODE", "mock").lower()
    
    if mode == "gemini" and "google.adk" in sys.modules:
        try:
            # Native ADK Session
            from google.adk.runners import InMemoryRunner
            runner = InMemoryRunner(agent=coordinator.adk_agent, app_name="helpdesk")
            runner.auto_create_session = True
            session = runner.session_service.create_session_sync(
                app_name="helpdesk",
                user_id=user_id,
                session_id=session_id
            )
            update_session_context(session, user_id=user_id)
        except Exception as e:
            console.print(f"[bold red]Failed to create ADK Session memory:[/bold red] {e}. Falling back to mock session.")
            session = MockSession(session_id, user_id)
    else:
        session = MockSession(session_id, user_id)
        
    system_logger.info(f"Session established. ID: {session_id}, Mode: {mode}")
    console.print(f"[dim]Session initialized: {session_id}[/dim]\n")
    
    # 3. Main Chat Loop
    while True:
        try:
            user_query = console.input("[bold cyan]User ❯ [/bold cyan]").strip()
            if not user_query:
                continue
                
            # Handle Slash Commands
            if user_query.startswith("/"):
                handle_slash_command(user_query, session, user_profile)
                continue
                
            # Generate tracing ID
            trace_id = "TRC-" + os.urandom(4).hex().upper()
            
            # Save pre-execution session context snapshot for visual state transition diffs
            pre_context = get_session_context(session).copy()
            
            # Set thread logging context
            set_log_context(trace_id=trace_id, session_id=session_id, ticket_id=pre_context.get("ticket_id"))
            
            # Package A2A Message
            user_msg = A2AMessage(
                sender="user",
                receiver="coordinator_agent",
                task="user_message",
                payload={
                    "query": user_query,
                    "user_id": user_id,
                    "session_id": session_id,
                    "trace_id": trace_id,
                    "_session_obj": session
                }
            )
            
            # Dispatch to Coordinator via Router
            response_msg = router.send_message(user_msg)
            
            # Print response
            console.print("\n[bold green]IT Helpdesk Response:[/bold green]")
            console.print(response_msg.payload.get("query_response", "No response content generated."))
            console.print()
            
            # Compare and render session state updates (Short-term memory tracking)
            post_context = get_session_context(session)
            render_state_changes(pre_context, post_context)
            
        except KeyboardInterrupt:
            console.print("\n[bold yellow]Session closed. Goodbye![/bold yellow]")
            sys.exit(0)
        except Exception as e:
            console.print(f"[bold red]Error processing transaction:[/bold red] {str(e)}")

def handle_slash_command(command: str, session: Any, user_profile: dict) -> None:
    """Executes utility help and health slash commands in the CLI."""
    cmd = command.lower().strip()
    
    if cmd == "/help":
        console.print(
            Panel(
                "[bold cyan]/help[/bold cyan]    - Display this utility command guide.\n"
                "[bold cyan]/health[/bold cyan]  - Run system database, chroma, and paths health checks.\n"
                "[bold cyan]/agents[/bold cyan]  - Display operational registration status of agents.\n"
                "[bold cyan]/memory[/bold cyan]  - Dump the values in active ADK Session State.\n"
                "[bold cyan]/tickets[/bold cyan] - List all ticket entries in the SQLite database.",
                title=" Command Help ",
                border_style="yellow"
            )
        )
        
    elif cmd == "/health":
        # Database connection check
        db_ok = "Offline"
        db_rows = 0
        try:
            from memory.sqlite_memory import get_db_connection
            conn = get_db_connection()
            db_rows = conn.execute("SELECT COUNT(*) FROM Users").fetchone()[0]
            conn.close()
            db_ok = "Online"
        except Exception:
            pass
            
        # Vector collection check
        chroma_ok = "Offline"
        chroma_count = 0
        try:
            import chromadb
            client = chromadb.PersistentClient(path=os.path.join(BASE_DIR, "vectordb", "chroma"))
            col = client.get_collection("kb_articles")
            chroma_count = col.count()
            chroma_ok = "Online"
        except Exception:
            pass
            
        # Log directory check
        log_count = len(glob_files(LOGS_DIR, "*.log"))
        
        table = Table(title=" IT System Health Report ")
        table.add_column("Subsystem", style="cyan")
        table.add_column("Status", style="bold green")
        table.add_column("Metadata", style="dim")
        
        table.add_row("SQLite Database", db_ok if db_ok == "Online" else "[red]Offline[/red]", f"Seeded {db_rows} profiles")
        table.add_row("ChromaDB Vector DB", chroma_ok if chroma_ok == "Online" else "[red]Offline[/red]", f"Indexed {chroma_count} segments")
        table.add_row("Log Files", "Active", f"Generated {log_count} log traces")
        table.add_row("Execution Mode", os.environ.get("MODE", "mock").upper(), "Environment setting")
        
        console.print(table)
        
    elif cmd == "/agents":
        table = Table(title=" Agent Registry Map ")
        table.add_column("Agent Name", style="cyan")
        table.add_column("Registry Status", style="bold green")
        table.add_column("Type Connection", style="dim")
        
        for name in ["coordinator_agent", "classification_agent", "troubleshooting_agent", "knowledge_agent", "escalation_agent"]:
            try:
                inst = registry.get_agent(name)
                status = "Online"
                conn_type = "Google ADK Agent" if getattr(inst, "mode", "mock") == "gemini" else "Mock Rule Heuristic"
            except Exception:
                status = "[red]Offline[/red]"
                conn_type = "Unknown"
                
            table.add_row(name, status, conn_type)
            
        console.print(table)
        
    elif cmd == "/memory":
        context = get_session_context(session)
        table = Table(title=f" ADK Session State Dumps ({session.id if hasattr(session, 'id') else 'Local'}) ")
        table.add_column("State Key", style="cyan")
        table.add_column("Value Dumps", style="yellow")
        
        for k, v in context.items():
            if isinstance(v, list) and v:
                val_str = ", ".join(v)
            elif not v:
                val_str = "[dim]None[/dim]"
            else:
                val_str = str(v)
            table.add_row(k, val_str)
            
        console.print(table)
        
    elif cmd == "/tickets":
        tickets = list_tickets()
        if not tickets:
            console.print("[dim]No tickets logged in the SQLite database yet.[/dim]")
            return
            
        table = Table(title=" Database Tickets Logs ")
        table.add_column("ID", style="yellow")
        table.add_column("User ID", style="cyan")
        table.add_column("Category", style="magenta")
        table.add_column("Summary", style="white")
        table.add_column("Status", style="bold green")
        table.add_column("Created At", style="dim")
        
        for t in tickets:
            status_style = "green"
            if t["status"] == "escalated":
                status_style = "bold red"
            elif t["status"] == "open":
                status_style = "yellow"
                
            table.add_row(
                f"TCK-{t['ticket_id']}",
                t["user_id"],
                t["category"],
                t["summary"],
                f"[{status_style}]{t['status']}[/{status_style}]",
                t["created_at"].split("T")[0]
            )
            
        console.print(table)
        
    else:
        console.print(f"[bold red]Unknown Command:[/bold red] '{command}'. Type /help to see all commands.")

def render_state_changes(pre: dict, post: dict) -> None:
    """Prints changes in Session state keys to illustrate memory trace updates."""
    changes = []
    for k in pre:
        if pre[k] != post[k]:
            pre_val = f"'{pre[k]}'" if pre[k] is not None else "None"
            post_val = f"'{post[k]}'" if post[k] is not None else "None"
            changes.append(f"[bold cyan]{k}[/bold cyan]: {pre_val} -> [green]{post_val}[/green]")
            
    if changes:
        text = Text.from_markup(f"[dim]🛠️ [Session State Update][/dim] " + " | ".join(changes))
        console.print(Panel(text, border_style="dim", expand=False))

def glob_files(directory: str, pattern: str) -> list:
    """Helper to list files matching a glob pattern."""
    import glob
    return glob.glob(os.path.join(directory, pattern))

if __name__ == "__main__":
    main()
