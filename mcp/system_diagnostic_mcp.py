# 1. Import FastMCP first (while sys.path is clean) to load the official mcp package
from fastmcp import FastMCP

# 2. Add project root to sys.path to enable local imports
import sys
import os
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# Initialize FastMCP Server for Diagnostics
mcp = FastMCP("System Diagnostics MCP")

@mcp.tool()
def check_network() -> dict:
    """Diagnose the local network connection status, latency, and packet loss."""
    return {
        "internet": "connected",
        "latency_ms": 14.5,
        "packet_loss_pct": 0.0,
        "gateway_ping": "success",
        "dns_resolution": "success"
    }

@mcp.tool()
def check_vpn() -> dict:
    """Check the local VPN client service configuration and tunnel status."""
    return {
        "vpn_service": "stopped", # Expected state for demo troubleshooting recommendations
        "tunnel_interface": "inactive",
        "gateway_ip": "10.20.1.1",
        "auth_status": "disconnected",
        "client_version": "Cisco AnyConnect 4.10.05"
    }

@mcp.tool()
def check_disk_space() -> dict:
    """Retrieve primary storage disk metrics (total, free, and used percentage)."""
    return {
        "total_gb": 476.2,
        "free_gb": 42.5,
        "used_pct": 91.0,
        "status": "ok",
        "low_space_warning": False
    }

@mcp.tool()
def check_cpu_usage() -> dict:
    """Fetch current system CPU workloads and load averages."""
    return {
        "cores": 8,
        "overall_usage_pct": 24.5,
        "load_average_1m": 1.2,
        "status": "normal",
        "throttled": False
    }

@mcp.tool()
def check_memory_usage() -> dict:
    """Fetch system RAM capacity, available RAM, and current consumption metrics."""
    return {
        "total_mb": 16384,
        "available_mb": 4096,
        "used_pct": 75.0,
        "status": "normal"
    }

@mcp.tool()
def check_printer_status() -> dict:
    """Query local print spooler service state and check for blocked queues."""
    return {
        "spooler_running": True,
        "offline": False,
        "jobs_in_queue": 3,
        "stuck_jobs": ["PRN-NY-CONF-2B_job_29910"],
        "status": "stuck_queue" # Triggers the spooler-cleaning guide recommendation
    }

if __name__ == "__main__":
    # Boot the MCP stdio server
    mcp.run()
