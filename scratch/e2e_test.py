import os
import sys
import json
import logging

# Add project root to sys.path
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from main import initialize_system, MockSession
from a2a.protocol import A2AMessage
from logs.logging_config import set_log_context, clear_log_context, LOGS_DIR

def run_test():
    print("=== STARTING INTEGRATION E2E TEST ===")
    
    # 1. Initialize system
    router, coordinator = initialize_system()
    
    # 2. Setup mock session and parameters
    session_id = "SES-TEST1234"
    user_id = "U101"
    trace_id = "TRC-TEST5678"
    
    session = MockSession(session_id, user_id)
    
    # 3. Simulate first user query (triggers classification -> troubleshooting)
    print("\n--- Sending Query 1: 'My VPN Cisco connection is failing' ---")
    set_log_context(trace_id=trace_id, session_id=session_id)
    
    user_msg = A2AMessage(
        sender="user",
        receiver="coordinator_agent",
        task="user_message",
        payload={
            "query": "My VPN Cisco connection is failing",
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": trace_id,
            "_session_obj": session
        }
    )
    
    response = router.send_message(user_msg)
    print("IT Response:\n", response.payload.get("query_response"))
    print("Ticket ID generated:", response.payload.get("ticket_id"))
    
    # 4. Simulate user feedback: "No" (it didn't solve the problem, should escalate)
    print("\n--- Sending Query 2: 'No' ---")
    trace_id_2 = "TRC-TEST9999"
    set_log_context(trace_id=trace_id_2, session_id=session_id, ticket_id=response.payload.get("ticket_id"))
    
    user_msg_2 = A2AMessage(
        sender="user",
        receiver="coordinator_agent",
        task="user_message",
        payload={
            "query": "No",
            "user_id": user_id,
            "session_id": session_id,
            "trace_id": trace_id_2,
            "_session_obj": session,
            "diagnostic_state": response.payload.get("diagnostic_state", {}),
            "diagnostic_steps": response.payload.get("diagnostic_steps", [])
        }
    )
    
    response_2 = router.send_message(user_msg_2)
    print("IT Response:\n", response_2.payload.get("query_response"))
    
    # 5. Check log file outputs
    print("\n=== VERIFYING LOG FILES ===")
    log_files = ["system.log", "a2a.log", "agent.log", "mcp.log"]
    for log_file in log_files:
        filepath = os.path.join(LOGS_DIR, log_file)
        if os.path.exists(filepath):
            size = os.path.getsize(filepath)
            print(f"Log file '{log_file}' exists. Size: {size} bytes.")
            # Read last 3 lines
            with open(filepath, "r", encoding="utf-8") as f:
                lines = f.readlines()
                print(f"Last lines of '{log_file}':")
                for line in lines[-3:]:
                    print(f"  {line.strip()}")
        else:
            print(f"ERROR: Log file '{log_file}' not found!")
            
    print("\n=== TEST COMPLETED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_test()
