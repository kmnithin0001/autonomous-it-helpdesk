import sys
import os

# Add project root to sys.path
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from main import initialize_system, MockSession
from a2a.protocol import A2AMessage

def main():
    query = "My VPN is not connecting"
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        
    router, coordinator = initialize_system()
    session = MockSession("SES-ONCE", "U101")
    
    msg = A2AMessage(
        sender="user",
        receiver="coordinator_agent",
        task="user_message",
        payload={
            "query": query,
            "user_id": "U101",
            "session_id": "SES-ONCE",
            "trace_id": "TRC-ONCE",
            "_session_obj": session
        }
    )
    
    res = router.send_message(msg)
    print("\n=== USER QUERY ===")
    print(query)
    print("\n=== IT HELPDESK RESPONSE ===")
    # Remove console markup color syntax for raw terminal viewing if desired
    response_text = res.payload.get("query_response", "")
    print(response_text)
    print("============================")

if __name__ == "__main__":
    main()
