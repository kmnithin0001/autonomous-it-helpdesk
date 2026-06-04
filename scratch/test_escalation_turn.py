import sys
import os

# Add project root to sys.path
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from main import initialize_system, MockSession
from a2a.protocol import A2AMessage

def main():
    router, coordinator = initialize_system()
    session = MockSession("SES-ESC-DEMO", "U101")
    
    # Turn 1
    print("\n--- TURN 1 ---")
    query_1 = "My VPN Cisco client connection is failing"
    msg_1 = A2AMessage(
        sender="user",
        receiver="coordinator_agent",
        task="user_message",
        payload={
            "query": query_1,
            "user_id": "U101",
            "session_id": "SES-ESC-DEMO",
            "trace_id": "TRC-DEMO-1",
            "_session_obj": session
        }
    )
    
    res_1 = router.send_message(msg_1)
    print("User >", query_1)
    print("\nIT Helpdesk Response:")
    print(res_1.payload.get("query_response"))
    
    # Turn 2: User responds "No"
    print("\n--- TURN 2 ---")
    query_2 = "No"
    msg_2 = A2AMessage(
        sender="user",
        receiver="coordinator_agent",
        task="user_message",
        payload={
            "query": query_2,
            "user_id": "U101",
            "session_id": "SES-ESC-DEMO",
            "trace_id": "TRC-DEMO-2",
            "_session_obj": session,
            "diagnostic_state": res_1.payload.get("diagnostic_state", {}),
            "diagnostic_steps": res_1.payload.get("diagnostic_steps", [])
        }
    )
    
    res_2 = router.send_message(msg_2)
    print("User >", query_2)
    print("\nIT Helpdesk Response:")
    print(res_2.payload.get("query_response"))
    print("============================")

if __name__ == "__main__":
    main()
