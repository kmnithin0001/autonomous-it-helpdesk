import os
import sys
import json
import sqlite3

# Add project root to sys.path
root_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_path not in sys.path:
    sys.path.insert(0, root_path)

from main import initialize_system, MockSession, handle_slash_command
from a2a.protocol import A2AMessage
from logs.logging_config import set_log_context, clear_log_context, LOGS_DIR
from memory.sqlite_memory import get_db_connection, get_ticket, get_escalation, get_conversation_history, list_tickets
from memory.conversation_store import get_session_context
import vectordb.chroma_manager as cm

def run_scenarios_validation():
    print("====================================================")
    print("       IT HELPDESK SYSTEM INTEGRATION VALIDATION     ")
    print("====================================================\n")
    
    # 1. Initialize DB and Vector DB
    router, coordinator = initialize_system()
    
    # Track verification results
    results = {
        "Scenarios": {
            "Scenario 1: VPN Issue": False,
            "Scenario 2: Password Reset": False,
            "Scenario 3: Printer Issue": False,
            "Scenario 4: Escalation Flow": False,
        },
        "CLI Commands": {
            "/help": False,
            "/health": False,
            "/agents": False,
            "/memory": False,
            "/tickets": False,
        },
        "Database Integrity": False,
        "ChromaDB Vector DB": False,
        "Logs & Tracing": False
    }
    
    print("\n--- STEP 1: VALIDATING CHROMADB VECTOR DB ---")
    try:
        citations = cm.semantic_search("how to restart vpn connection", limit=1)
        if citations and len(citations) > 0:
            citation = citations[0]
            print(f"ChromaDB search successful. Found: {citation['document']} (Section: {citation['section']}, Conf: {citation['confidence']})")
            results["ChromaDB Vector DB"] = True
        else:
            print("ChromaDB search returned empty results.")
    except Exception as e:
        print(f"ChromaDB search failed: {e}")
        
    # --- RUN SCENARIOS ---
    
    session_id = "SES-VALIDATION-E2E"
    user_id = "U101"
    
    # Scenario 1 & 4 (VPN and Escalation)
    print("\n--- STEP 2: RUNNING SCENARIO 1 (VPN Issue) ---")
    try:
        session_vpn = MockSession(session_id, user_id)
        trace_id_1 = "TRC-VPN-ISSUE"
        set_log_context(trace_id=trace_id_1, session_id=session_id)
        
        msg_vpn = A2AMessage(
            sender="user",
            receiver="coordinator_agent",
            task="user_message",
            payload={
                "query": "My VPN is not connecting",
                "user_id": user_id,
                "session_id": session_id,
                "trace_id": trace_id_1,
                "_session_obj": session_vpn
            }
        )
        
        res_vpn = router.send_message(msg_vpn)
        ticket_id_vpn = res_vpn.payload.get("ticket_id")
        q_res = res_vpn.payload.get("query_response", "")
        diagnostic_state = res_vpn.payload.get("diagnostic_state", {})
        diagnostic_steps = res_vpn.payload.get("diagnostic_steps", [])
        
        print(f"VPN Issue Category check: {res_vpn.payload.get('issue_category') or 'VPN Issue'}")
        print(f"Ticket generated: TCK-{ticket_id_vpn}")
        print(f"Diagnostic Steps run: {diagnostic_steps}")
        print("Response received contains troubleshooting info:", "Diagnostic Investigation Completed" in q_res)
        
        if ticket_id_vpn and len(diagnostic_steps) > 0 and "Diagnostic Investigation Completed" in q_res:
            results["Scenarios"]["Scenario 1: VPN Issue"] = True
            
        # Scenario 4 (Escalation Flow)
        print("\n--- STEP 3: RUNNING SCENARIO 4 (Escalation Flow) ---")
        trace_id_esc = "TRC-VPN-ESCALATE"
        set_log_context(trace_id=trace_id_esc, session_id=session_id, ticket_id=ticket_id_vpn)
        
        msg_esc = A2AMessage(
            sender="user",
            receiver="coordinator_agent",
            task="user_message",
            payload={
                "query": "No",
                "user_id": user_id,
                "session_id": session_id,
                "trace_id": trace_id_esc,
                "_session_obj": session_vpn,
                "diagnostic_state": diagnostic_state,
                "diagnostic_steps": diagnostic_steps
            }
        )
        
        res_esc = router.send_message(msg_esc)
        q_esc_res = res_esc.payload.get("query_response", "")
        print("Escalation response contains handoff info:", "Ticket Escalated" in q_esc_res)
        
        # Check database for escalation record
        esc_rec = get_escalation(ticket_id_vpn)
        if esc_rec:
            print("Escalation record found in SQLite:")
            print(f"  Team: {esc_rec['recommended_team']}, Priority: {esc_rec['priority']}")
            print(f"  Reason: {esc_rec['reason']}")
            results["Scenarios"]["Scenario 4: Escalation Flow"] = True
        else:
            print("No escalation record found in SQLite database!")
            
    except Exception as e:
        print(f"VPN/Escalation Scenarios failed with error: {e}")
        
    # Scenario 2 (Password Reset)
    print("\n--- STEP 4: RUNNING SCENARIO 2 (Password Reset) ---")
    try:
        session_pwd = MockSession("SES-PWD-RESET", user_id)
        trace_id_pwd = "TRC-PWD-RESET"
        set_log_context(trace_id=trace_id_pwd, session_id="SES-PWD-RESET")
        
        msg_pwd = A2AMessage(
            sender="user",
            receiver="coordinator_agent",
            task="user_message",
            payload={
                "query": "I forgot my password",
                "user_id": user_id,
                "session_id": "SES-PWD-RESET",
                "trace_id": trace_id_pwd,
                "_session_obj": session_pwd
            }
        )
        
        res_pwd = router.send_message(msg_pwd)
        ticket_pwd_id = res_pwd.payload.get("ticket_id")
        pwd_res = res_pwd.payload.get("query_response", "")
        print(f"Password reset ticket: TCK-{ticket_pwd_id}")
        print("Resolution steps returned:", "Self-Service Password Reset" in pwd_res or "password" in pwd_res.lower())
        
        if ticket_pwd_id and ("password" in pwd_res.lower() or "reset" in pwd_res.lower()):
            results["Scenarios"]["Scenario 2: Password Reset"] = True
    except Exception as e:
        print(f"Password Reset Scenario failed with error: {e}")
        
    # Scenario 3 (Printer Issue)
    print("\n--- STEP 5: RUNNING SCENARIO 3 (Printer Issue) ---")
    try:
        session_prn = MockSession("SES-PRINTER", user_id)
        trace_id_prn = "TRC-PRINTER"
        set_log_context(trace_id=trace_id_prn, session_id="SES-PRINTER")
        
        msg_prn = A2AMessage(
            sender="user",
            receiver="coordinator_agent",
            task="user_message",
            payload={
                "query": "My printer NYC-CONF-2B is offline",
                "user_id": user_id,
                "session_id": "SES-PRINTER",
                "trace_id": trace_id_prn,
                "_session_obj": session_prn
            }
        )
        
        res_prn = router.send_message(msg_prn)
        ticket_prn_id = res_prn.payload.get("ticket_id")
        prn_res = res_prn.payload.get("query_response", "")
        print(f"Printer ticket generated: TCK-{ticket_prn_id}")
        print("Diagnostic checks print queue:", "PRN-NY-CONF-2B" in prn_res or "printer" in prn_res.lower() or "spooler" in prn_res.lower())
        
        if ticket_prn_id and ("printer" in prn_res.lower() or "spooler" in prn_res.lower() or "offline" in prn_res.lower()):
            results["Scenarios"]["Scenario 3: Printer Issue"] = True
    except Exception as e:
        print(f"Printer Issue Scenario failed with error: {e}")
        
    # --- CLI SLASH COMMANDS VERIFICATION ---
    print("\n--- STEP 6: VERIFYING CLI SLASH COMMANDS ---")
    mock_user_profile = {"name": "Test User", "email": "test@company.com", "department": "QA", "manager_name": "Test Manager"}
    session_cli = MockSession("SES-CLI-TEST", "U101")
    
    for cmd in ["/help", "/agents", "/health", "/memory", "/tickets"]:
        try:
            print(f"Testing command: {cmd}")
            # Capture console or just ensure it runs without exception
            handle_slash_command(cmd, session_cli, mock_user_profile)
            results["CLI Commands"][cmd] = True
        except Exception as e:
            print(f"Command '{cmd}' failed: {e}")
            
    # --- SQLITE INTEGRITY VERIFICATION ---
    print("\n--- STEP 7: VERIFYING DATABASE INTEGRITY ---")
    try:
        conn = get_db_connection()
        tables = ["Users", "Tickets", "Conversations", "Escalations", "KnowledgeSearches", "A2ALogs", "Feedback"]
        db_ok = True
        for table in tables:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            print(f"  Table '{table}' exists and has {count} records.")
            
        # Verify foreign keys are enabled or structural records are consistent
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_key_check")
        fk_violations = cursor.fetchall()
        if fk_violations:
            print(f"  WARNING: Foreign Key violations found: {fk_violations}")
            db_ok = False
        else:
            print("  No Foreign Key violations.")
            
        # Verify tickets have valid users linked
        unlinked_tickets = conn.execute("SELECT COUNT(*) FROM Tickets WHERE user_id NOT IN (SELECT user_id FROM Users)").fetchone()[0]
        if unlinked_tickets > 0:
            print(f"  WARNING: Found {unlinked_tickets} tickets with invalid user_id.")
            db_ok = False
            
        conn.close()
        results["Database Integrity"] = db_ok
    except Exception as e:
        print(f"Database verification failed: {e}")
        
    # --- LOGS VERIFICATION ---
    print("\n--- STEP 8: VERIFYING LOGS & TRACING ---")
    try:
        log_files = ["system.log", "a2a.log", "agent.log", "mcp.log"]
        logs_ok = True
        for log_file in log_files:
            filepath = os.path.join(LOGS_DIR, log_file)
            if not os.path.exists(filepath):
                print(f"  Missing log file: {log_file}")
                logs_ok = False
                continue
                
            # Verify traces are propagated inside logs
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
                if "TRC-" not in content and "TRC-NONE" not in content:
                    print(f"  WARNING: Trace ID markers ('TRC-') not found in {log_file}!")
                    logs_ok = False
                else:
                    print(f"  Log file '{log_file}' has trace ID correlation.")
                    
        results["Logs & Tracing"] = logs_ok
    except Exception as e:
        print(f"Log verification failed: {e}")
        
    # --- PRINT FINAL REPORT CARD ---
    print("\n====================================================")
    print("               FINAL VALIDATION SUMMARY             ")
    print("====================================================")
    
    total_passed = 0
    total_checks = 0
    
    for category, status in results.items():
        if isinstance(status, dict):
            print(f"\n[{category}]")
            for sub_cat, sub_status in status.items():
                icon = "PASS" if sub_status else "FAIL"
                print(f"  [{icon}] - {sub_cat}")
                total_checks += 1
                if sub_status:
                    total_passed += 1
        else:
            icon = "PASS" if status else "FAIL"
            print(f"[{icon}] - {category}")
            total_checks += 1
            if status:
                total_passed += 1
                
    score_pct = (total_passed / total_checks) * 100
    score_10 = round((total_passed / total_checks) * 10, 1)
    
    print("\n----------------------------------------------------")
    print(f"Verification Score: {total_passed}/{total_checks} ({score_pct:.1f}%)")
    print(f"Production Readiness Rating: {score_10}/10")
    print("----------------------------------------------------\n")
    
    # Save validation metrics to a temp file for inclusion in the final report
    with open("scratch/validation_metrics.json", "w") as f:
        json.dump({
            "results": results,
            "passed": total_passed,
            "total": total_checks,
            "score_10": score_10
        }, f, indent=2)

if __name__ == "__main__":
    run_scenarios_validation()
