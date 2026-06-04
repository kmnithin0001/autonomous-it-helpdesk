# 1. Import FastMCP first (while sys.path is clean) to load the official mcp package
from fastmcp import FastMCP

# 2. Add project root to sys.path to enable local imports
import sys
import os
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

# 3. Load local modules
from memory.sqlite_memory import get_user

# Initialize FastMCP Server for User Directory
mcp = FastMCP("User Directory MCP")

@mcp.tool()
def get_user_information(user_id: str) -> dict:
    """Retrieve detailed profile information about an employee from the company directory.
    
    Args:
        user_id: The unique employee ID string (e.g. 'U101').
    """
    user = get_user(user_id)
    if not user:
        return {"error": f"Employee ID '{user_id}' not found in the user directory."}
    return dict(user)

@mcp.tool()
def get_department(user_id: str) -> str:
    """Get the department name of a specific employee.
    
    Args:
        user_id: The unique employee ID string (e.g. 'U101').
    """
    user = get_user(user_id)
    if not user:
        return f"Error: Employee ID '{user_id}' not found in the directory."
    return user.get("department", "Unknown")

@mcp.tool()
def get_manager(user_id: str) -> dict:
    """Retrieve the manager's name and details for a specific employee.
    
    Args:
        user_id: The unique employee ID string (e.g. 'U101').
    """
    user = get_user(user_id)
    if not user:
        return {"error": f"Employee ID '{user_id}' not found in the directory."}
        
    return {
        "employee_id": user_id,
        "employee_name": user.get("name"),
        "manager_name": user.get("manager_name", "Unknown")
    }

if __name__ == "__main__":
    # Boot the MCP stdio server
    mcp.run()
