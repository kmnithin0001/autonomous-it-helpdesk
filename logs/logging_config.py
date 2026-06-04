import os
import logging
import threading
from typing import Optional, Any

# Local directory config
LOGS_DIR = os.path.dirname(os.path.abspath(__file__))
os.makedirs(LOGS_DIR, exist_ok=True)

# Thread-local storage to capture trace headers dynamically across call stacks
_context_store = threading.local()

def set_log_context(trace_id: str, session_id: str, ticket_id: Optional[Any] = None) -> None:
    """Sets the log context parameters for the current thread execution."""
    _context_store.trace_id = trace_id
    _context_store.session_id = session_id
    
    # Format ticket ID
    if ticket_id is not None:
        if isinstance(ticket_id, int) or (isinstance(ticket_id, str) and not ticket_id.startswith("TCK-")):
            _context_store.ticket_id = f"TCK-{ticket_id}"
        else:
            _context_store.ticket_id = str(ticket_id)
    else:
        _context_store.ticket_id = "TCK-NONE"

def clear_log_context() -> None:
    """Clears the current thread log context parameters."""
    _context_store.trace_id = "TRC-NONE"
    _context_store.session_id = "SES-NONE"
    _context_store.ticket_id = "TCK-NONE"

class LogContextFilter(logging.Filter):
    """Logging filter that injects trace_id, session_id, and ticket_id into formatting records."""
    def filter(self, record):
        record.trace_id = getattr(_context_store, "trace_id", "TRC-NONE")
        record.session_id = getattr(_context_store, "session_id", "SES-NONE")
        record.ticket_id = getattr(_context_store, "ticket_id", "TCK-NONE")
        return True

def setup_logger(name: str, filename: str, level: int = logging.INFO) -> logging.Logger:
    """Configures and returns a file logger with context filters."""
    filepath = os.path.join(LOGS_DIR, filename)
    
    # Enforce file creation
    open(filepath, "a", encoding="utf-8").close()
    
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.propagate = False  # Prevent propagating logs to root terminal console
    
    # Clear existing handlers
    if logger.handlers:
        logger.handlers.clear()
        
    # File handler
    fh = logging.FileHandler(filepath, encoding="utf-8")
    fh.setLevel(level)
    
    # Trace Formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - [%(trace_id)s] [%(session_id)s] [%(ticket_id)s] - %(message)s'
    )
    fh.setFormatter(formatter)
    
    # Add Filter and Handler
    logger.addFilter(LogContextFilter())
    logger.addHandler(fh)
    
    return logger

# --- LOGGER INSTANTIATIONS ---

system_logger = setup_logger("system_logger", "system.log")
a2a_logger = setup_logger("a2a_logger", "a2a.log")
mcp_logger = setup_logger("mcp_logger", "mcp.log")
agent_logger = setup_logger("agent_logger", "agent.log")

# Initial touch confirmations
system_logger.info("IT System logger initialization completed.")
a2a_logger.info("IT A2A router logger initialization completed.")
mcp_logger.info("IT MCP integration logger initialization completed.")
agent_logger.info("IT ADK Agent logger initialization completed.")
