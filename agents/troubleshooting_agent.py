import os
import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

# Load centralized logging configurations
from logs.logging_config import agent_logger, mcp_logger

class TroubleshootingResult(BaseModel):
    """Pydantic model representing structured diagnostic and remediation outputs."""
    diagnostic_steps: List[str] = Field(description="Attempted checks or steps executed during investigation.")
    recommendations: str = Field(description="Remediation actions recommended to the user.")
    resolution_plan: str = Field(description="Step-by-step procedural plan to resolve the issue.")

class TroubleshootingAgent:
    """Agent responsible for running diagnostics and recommending resolution steps."""
    
    def __init__(self, router: Any):
        self.name = "troubleshooting_agent"
        self.mode = os.environ.get("MODE", "mock").lower()
        self.router = router # Router reference for A2A communication
        
        # Load local Diagnostic MCP tools for direct execution/registration
        # We append the mcp path to sys.path to avoid official 'mcp' namespace masking conflict
        import sys
        root_path = os.path.abspath(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        mcp_path = os.path.abspath(os.path.join(root_path, "mcp"))
        if mcp_path not in sys.path:
            sys.path.insert(0, mcp_path)
            
        import system_diagnostic_mcp as diag_mcp
        self.diag_tools = {
            "vpn": diag_mcp.check_vpn,
            "network": diag_mcp.check_network,
            "disk": diag_mcp.check_disk_space,
            "cpu": diag_mcp.check_cpu_usage,
            "memory": diag_mcp.check_memory_usage,
            "printer": diag_mcp.check_printer_status
        }
        
        if self.mode == "gemini":
            try:
                from google.adk import Agent
                
                # Expose all diagnostic tools to ADK Agent
                adk_tools = list(self.diag_tools.values())
                
                self.adk_agent = Agent(
                    name=self.name,
                    model="gemini-2.5-flash",
                    instruction="""
                    Analyze the user issue and the retrieved knowledge guide.
                    Select and execute the appropriate system diagnostic check tool based on the issue category.
                    Synthesize the diagnostic state and the guide instructions.
                    Generate a list of executed diagnostic steps, clear user recommendations, and a step-by-step resolution plan.
                    Return the results in the TroubleshootingResult schema.
                    """,
                    tools=adk_tools,
                    output_schema=TroubleshootingResult
                )
            except Exception as e:
                agent_logger.warning(f"Failed to initialize ADK Agent for Troubleshooting: {e}. Defaulting to mock mode.")
                self.mode = "mock"

    def handle_a2a_message(self, message: Any) -> Any:
        """Processes incoming A2A troubleshooting messages, queries KB, executes diagnostics, and compiles plans."""
        from a2a.protocol import A2AMessage
        
        import time
        start_time = time.time()
        
        category = message.payload.get("category", "Unknown")
        summary = message.payload.get("summary", "")
        original_query = message.payload.get("query", "")
        user_id = message.payload.get("user_id", "U-UNKNOWN")
        session_id = message.payload.get("session_id", "SES-UNKNOWN")
        ticket_id = message.payload.get("ticket_id")
        trace_id = message.payload.get("trace_id", "TRC-UNKNOWN")
        
        agent_logger.info(f"[{trace_id}] {self.name} starting troubleshooting for: '{original_query}' (Category: {category})")
        
        # 1. Ask Knowledge Agent for article RAG lookup over A2A
        kb_message = A2AMessage(
            sender=self.name,
            receiver="knowledge_agent",
            task="search_knowledge",
            payload={
                "query": original_query,
                "category": category,
                "user_id": user_id,
                "session_id": session_id,
                "ticket_id": ticket_id,
                "trace_id": trace_id
            }
        )
        
        kb_response = self.router.send_message(kb_message)
        kb_doc = kb_response.payload.get("document", "none")
        kb_section = kb_response.payload.get("section", "none")
        kb_content = kb_response.payload.get("content", "")
        kb_confidence = kb_response.payload.get("confidence", 0.0)
        
        # 2. Execute Diagnostic MCP Tools
        diag_results = self._run_diagnostics(category)
        
        # 3. Compile troubleshooting summary using Mock or Gemini reasoning
        if self.mode == "gemini":
            try:
                context_prompt = f"""
                User Query: {original_query}
                Category: {category}
                Summary: {summary}
                
                Knowledge Article: {kb_doc} (Section: {kb_section}, Match Confidence: {kb_confidence})
                Article Content:
                {kb_content}
                
                System Diagnostic State:
                {json.dumps(diag_results, indent=2)}
                """
                result = self._run_gemini(context_prompt, user_id, session_id)
            except Exception as e:
                agent_logger.error(f"[{trace_id}] Gemini troubleshooting failed: {e}. Falling back to mock heuristics.")
                result = self._run_mock(category, diag_results, kb_section, kb_content)
        else:
            result = self._run_mock(category, diag_results, kb_section, kb_content)
            
        latency = time.time() - start_time
        agent_logger.info(f"[{trace_id}] {self.name} completed in {latency*1000:.1f}ms. Recommendation: '{result.recommendations}'")
        
        # Formulate response
        response_payload = message.payload.copy()
        
        # Accumulate diagnostic and knowledge state into payload for session tracing
        response_payload.update({
            "diagnostic_steps": result.diagnostic_steps,
            "recommendations": result.recommendations,
            "resolution_plan": result.resolution_plan,
            "diagnostic_state": diag_results,
            "retrieved_doc": kb_doc,
            "retrieved_section": kb_section,
            "retrieved_content": kb_content,
            "latency_ms": round(latency * 1000, 2)
        })
        
        return A2AMessage(
            sender=self.name,
            receiver=message.sender,
            task="troubleshooting_response",
            payload=response_payload
        )

    def _run_diagnostics(self, category: str) -> dict:
        """Invokes specific System Diagnostic MCP tools based on the ticket category."""
        cat_lower = category.lower()
        mcp_logger.info(f"Invoking System Diagnostic MCP for category: {category}")
        
        # Map categories to tools
        if "vpn" in cat_lower:
            tool = self.diag_tools["vpn"]
        elif "printer" in cat_lower:
            tool = self.diag_tools["printer"]
        elif "network" in cat_lower:
            tool = self.diag_tools["network"]
        elif "software" in cat_lower:
            tool = self.diag_tools["disk"]
        elif "hardware" in cat_lower:
            tool = self.diag_tools["cpu"]
        else:
            tool = self.diag_tools["network"]
            
        # Execute tool
        try:
            res = tool()
            mcp_logger.info(f"System Diagnostic MCP output: {json.dumps(res)}")
            return res
        except Exception as e:
            mcp_logger.error(f"System Diagnostic MCP execution failed: {e}")
            return {"error": f"Diagnostic tool execution failed: {str(e)}"}

    def _run_mock(self, category: str, diag_results: dict, kb_section: str, kb_content: str) -> TroubleshootingResult:
        """Heuristic-based mock troubleshooter mapping diagnostic states to guide solutions."""
        cat_lower = category.lower()
        
        if "vpn" in cat_lower:
            return TroubleshootingResult(
                diagnostic_steps=[
                    "Pinged local gateway (success)",
                    "Queried local VPN Client service state (vpn_service: stopped)"
                ],
                recommendations="Restart the Cisco AnyConnect Secure Mobility Client service on your computer.",
                resolution_plan=(
                    "Step 1: Open the Start Menu, type 'services.msc' and press Enter.\n"
                    "Step 2: Scroll down and locate 'Cisco AnyConnect Secure Mobility Client'.\n"
                    "Step 3: Right-click it and select 'Restart'.\n"
                    "Step 4: Re-open Cisco AnyConnect and click 'Connect' again."
                )
            )
        elif "printer" in cat_lower:
            return TroubleshootingResult(
                diagnostic_steps=[
                    "Queried Print Spooler service status (running)",
                    "Checked printer queue spool directory (PRN-NY-CONF-2B has 3 stuck jobs)"
                ],
                recommendations="Stop the Print Spooler service, delete stuck jobs from the queue directory, and restart Spooler.",
                resolution_plan=(
                    "Step 1: Open services.msc, right-click 'Print Spooler' and select 'Stop'.\n"
                    "Step 2: Open File Explorer, navigate to C:\\Windows\\System32\\spool\\PRINTERS\\ and delete all files.\n"
                    "Step 3: Go back to services.msc, right-click 'Print Spooler' and select 'Start'."
                )
            )
        elif "password" in cat_lower:
            return TroubleshootingResult(
                diagnostic_steps=[
                    "Checked lock status in Active Directory (account locked)"
                ],
                recommendations="Use the Self-Service Password Reset (SSPR) portal to unlock your account and reset your password.",
                resolution_plan=(
                    "Step 1: Visit https://passwordreset.microsoftonline.com/ in a web browser.\n"
                    "Step 2: Enter your email and pass the CAPTCHA validation.\n"
                    "Step 3: Complete verification via SMS or Authenticator push code.\n"
                    "Step 4: Select a new password that matches complexity requirements."
                )
            )
        elif "email" in cat_lower:
            return TroubleshootingResult(
                diagnostic_steps=[
                    "Verified connection status to Exchange Server (disconnected)",
                    "Tested OWA Outlook Web access portal ping (connected)"
                ],
                recommendations="Use Outlook Webmail (OWA) temporarily and create a new Outlook Desktop client profile.",
                resolution_plan=(
                    "Step 1: Open Control Panel, search for 'Mail', and click 'Show Profiles...'.\n"
                    "Step 2: Click 'Add...', name it 'CorporateNew', and link your corporate email account.\n"
                    "Step 3: Set 'CorporateNew' as the default profile and launch Outlook."
                )
            )
        elif "network" in cat_lower:
            return TroubleshootingResult(
                diagnostic_steps=[
                    "Tested public internet connection gateway ping (failed)",
                    "Checked ethernet hardware interface link status (inactive)"
                ],
                recommendations="Reconnect your network ethernet cable or cycle your local Wi-Fi interface off and on.",
                resolution_plan=(
                    "Step 1: Locate the ethernet wall port or check your router connections.\n"
                    "Step 2: Unplug the cable, wait 5 seconds, and firmly reconnect it.\n"
                    "Step 3: If on Wi-Fi, turn off Wi-Fi on your device, wait 10 seconds, and turn it back on."
                )
            )
        elif "software" in cat_lower:
            return TroubleshootingResult(
                diagnostic_steps=[
                    "Verified client disk capacity (free_gb: 42.5)",
                    "Queried local software center registry service (running)"
                ],
                recommendations="Install the software using the corporate Self-Service Company Portal app.",
                resolution_plan=(
                    "Step 1: Click the Windows Start button, search for 'Company Portal' or 'Software Center' and launch it.\n"
                    "Step 2: Browse or search for the application you wish to install.\n"
                    "Step 3: Click the 'Install' button and wait for background setup to finish."
                )
            )
            
        # Default unknown fallback
        return TroubleshootingResult(
            diagnostic_steps=["Ran general diagnostic check list (network: ok, memory: ok, disk: ok)"],
            recommendations="Ensure the software client is updated and restart the system.",
            resolution_plan=(
                "Step 1: Save all active work files.\n"
                "Step 2: Reboot the laptop.\n"
                "Step 3: If the problem persists, describe the failure log and submit it to IT support."
            )
        )

    def _run_gemini(self, context_prompt: str, user_id: str, session_id: str) -> TroubleshootingResult:
        """Invokes the Google ADK runner to synthesize diagnostic data and guides using Gemini reasoning."""
        from google.adk.runners import InMemoryRunner
        from google.genai import types
        
        runner = InMemoryRunner(agent=self.adk_agent, app_name="helpdesk")
        runner.auto_create_session = True
        
        content = types.Content(parts=[types.Part.from_text(text=context_prompt)])
        events = runner.run(user_id=user_id, session_id=session_id, new_message=content)
        
        final_output = None
        for ev in events:
            if ev.error_code:
                raise RuntimeError(f"Troubleshooting ADK error: {ev.error_message}")
            if ev.output:
                final_output = ev.output
                
        if not final_output:
            raise RuntimeError("No output received from Troubleshooting ADK agent.")
            
        if isinstance(final_output, TroubleshootingResult):
            return final_output
            
        if isinstance(final_output, dict):
            return TroubleshootingResult(**final_output)
            
        try:
            data = json.loads(str(final_output))
            return TroubleshootingResult(**data)
        except Exception:
            return TroubleshootingResult(
                diagnostic_steps=["Analyses diagnostic outputs via model completion"],
                recommendations=str(final_output),
                resolution_plan=str(final_output)
            )
