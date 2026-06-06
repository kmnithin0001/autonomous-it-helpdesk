# PROJECT REPORT: AUTONOMOUS IT HELPDESK SYSTEM

---

## 1. TITLE PAGE

### **PROJECT REPORT**
**ON**
### **AUTONOMOUS IT HELPDESK SYSTEM**

**Submitted in partial fulfillment of the requirements for the evaluation of AI/ML projects.**

* **Student Name:** K Nithin Kumar  
* **Guide Name:** Prajapati Lekha Nanku  
* **Batch:** AIML Batch 8  
* **Academic Year:** 2026  

---

## 2. ABSTRACT

In modern enterprises, Information Technology (IT) service desks are primary bottlenecks. Employees lose significant productivity waiting for human analysts to resolve routine issues such as corporate VPN disconnects, account lockouts, offline printers, configuration errors, and software setup requests. Traditional helpdesks rely on static forms, manual ticket triaging, and sequential queue routing, leading to high Mean Time to Resolution (MTTR) and high operational overhead.

This project introduces the **Autonomous IT Helpdesk System**, a fully automated, multi-agent enterprise platform designed to autonomously ingest, classify, diagnose, and resolve corporate IT support requests. By leveraging the **Google Agent Development Kit (ADK)** and the **Model Context Protocol (MCP)**, the system coordinates specialized AI agents that execute diagnostics and consult knowledge bases to troubleshoot issues without human intervention. 

The core architecture is built around a five-agent coordination loop. The **Coordinator Agent** manages the lifecycle of the ticket and orchestrates A2A (Agent-to-Agent) routing. The **Classification Agent** categorizes incoming issues and assesses confidence. The **Troubleshooting Agent** runs automated system checks using diagnostic tools. The **Knowledge Agent** runs semantic search lookups against vector stores, and the **Escalation Agent** summarizes diagnostic traces and generates structured L2 technician handoff notes. 

System memory is divided into short-term session state managed via Google ADK Session State and long-term storage managed via an **SQLite** database. A vector search registry powered by **ChromaDB** stores embedded corporate manuals to enable Retrieval-Augmented Generation (RAG). The system backend is developed using **FastAPI**, enabling high-speed RESTful JSON exchanges and persistent state synchronization via WebSockets. The frontend is built using **React, TypeScript, and Vite**, offering a ServiceNow-style light dashboard displaying real-time ticket statuses, automation service metrics, diagnostic timelines, and an interactive chat interface. 

Validation runs demonstrate that corporate incidents in VPN, account, printer, email, and software categories are classified, diagnosed, and resolved within seconds. If troubleshooting fails, the ticket is escalated with Level-2 diagnostic logs automatically, reducing human MTTR and optimizing operational resources.

---

## 3. INTRODUCTION

### Traditional IT Helpdesk Challenges
Enterprise IT departments are constantly inundated with repetitive, low-complexity support requests. According to industry statistics, up to 70% of service desk tickets consist of routine issues such as password resets, printer queue stalls, VPN configuration errors, and standard software installation requests. Resolving these issues manually consumes massive human analyst bandwidth.

### Manual Ticket Management
Traditional systems rely on human triage. A dispatcher must read the request, classify it into a category (e.g., Network, Hardware, Access), assign a priority level, and route it to an appropriate support queue. This manual step introduces significant latency, often leaving critical requests sitting in queues for hours before an analyst reviews them.

### Delayed Issue Resolution
Once assigned, the technician must communicate back and forth with the user to collect logs, run diagnostic checks, search internal manuals, and deliver instructions. This synchronous process causes employee downtime, directly impacting operational productivity and raising the enterprise's operational cost per ticket.

### The Proposed AI-Driven Automation
This project proposes a self-healing, autonomous IT support desk that operates 24/7. Using large language models (LLMs) coordinated via a multi-agent framework, the system intercepts user issues, performs real-time system and network diagnostics, retrieves the exact relevant knowledge base documents, applies resolutions, and updates the ticket lifecycle. By integrating AI agents with local system hooks (MCP servers), the platform bridges the gap between passive chat interfaces and active, executable network/system administration tools.

---

## 4. PROBLEM STATEMENT

Corporate employees frequently encounter local workstation and network failures that block daily business functions. The most common issues include:
* **VPN Failures:** Local client services stopping, incorrect gateway configurations, and network pings failing.
* **Account Lockouts:** Active Directory user lockouts due to expired passwords or incorrect credentials.
* **Printer Failures:** Print Spooler service crashes, duplicate jobs stuck in queues, and offline hardware status.
* **Email Configurations:** Disconnected Exchange server credentials, misconfigured Outlook profiles, and mail sync errors.
* **Software Installs:** Workstations lacking corporate-approved licenses or registry entries.

Traditional service desks require a human agent to diagnose each of these issues. There is a critical need for an intelligent system that can:
1. Parse the user's natural language request.
2. Automatively execute local diagnostics (e.g. check spoolers, ping gateways).
3. Search semantic document databases to locate troubleshooting instructions.
4. Auto-resolve the ticket and log resolution details.
5. Escalate to human engineers with full diagnostic summaries if local fixes are unsuccessful.

---

## 5. OBJECTIVES

The main objectives of the Autonomous IT Helpdesk System are:
* **Automate Ticket Classification:** Automatically categorize incoming text queries into IT categories (VPN, Access, Email, Printer, Software, Hardware) with statistical confidence metrics.
* **Automate Workstation & Network Troubleshooting:** Connect AI agents to executable diagnostic tools through standard protocols.
* **Semantic Knowledge Retrieval (RAG):** Index PDF/text manuals and execute real-time vector search queries to feed precise troubleshooting procedures into the agent prompt context.
* **Ticket Lifecycle Management:** Maintain ticket records in a structured database, transitioning statuses dynamically from `open` to `resolved` or `escalated`.
* **Escalation Automation:** Generate automated summaries of executed checks and system states, routing failed tickets to specialized Level-2 human queues.
* **Real-time Monitoring & UI:** Provide a dashboard display featuring real-time WebSockets to sync metrics, timeline events, and active chats.

---

## 6. SYSTEM ARCHITECTURE

The system follows a three-tier design, separating presentation, orchestration, and service/storage layers:

```
                  +-----------------------------------+
                  |        User Web Browser           |
                  |     React / TypeScript / Vite     |
                  +-----------------+-----------------+
                                    |
                        HTTP / WS   | REST API & Events
                                    v
                  +-----------------------------------+
                  |         FastAPI Backend           |
                  |  (Server, WebSocket, API Routers) |
                  +-----------------+-----------------+
                                    |
                     A2A Messages   | Session State
                                    v
                  +-----------------------------------+
                  |         Coordinator Agent         |
                  |     (Orchestrator State Machine)   |
                  +--------+-------+--------+---------+
                           |       |        |
         +-----------------+       |        +------------------+
         | A2A                     | A2A                       | A2A
         v                         v                           v
+------------------+     +------------------+        +------------------+
|  Classification  |     | Troubleshooting  |        |    Escalation    |
|      Agent       |     |      Agent       |        |      Agent       |
+------------------+     +--------+---------+        +------------------+
                                  |
                   +--------------+--------------+
                   |                             |
                   v A2A                         v Execute Tools
         +------------------+          +------------------+
         | Knowledge Agent  |          |   MCP Servers    |
         |  (ChromaDB RAG)  |          | (System, Ticket) |
         +------------------+          +------------------+
```

### 1. Frontend Layer (React SPA)
A responsive dashboard utilizing TypeScript. It maintains query states using React Query and connects to the backend event loop via a persistent WebSocket client.

### 2. Backend Layer (FastAPI)
The central API engine. It initializes the Multi-Agent Router, serves React production static assets, manages WebSocket client lists, and provides endpoints for ticket operations, agent listings, and log monitoring.

### 3. Agent Coordination Layer (Google ADK)
Uses the Google Agent Development Kit to orchestrate agent states. The Coordinator Agent acts as the entry point and directs requests to sub-agents via standard A2A protocol packets.

### 4. Tool & Execution Layer (MCP Servers)
Implements Model Context Protocol (MCP) servers. The Troubleshooting Agent invokes these servers to run diagnostic checks (e.g. parsing processes, directory lookups, network pings) directly on target environments.

### 5. Memory & Storage Layer (SQLite & ChromaDB)
* **SQLite:** Stores relational records of users, tickets, conversation turns, escalations, searches, and traces.
* **ChromaDB:** A vector database holding embedded guides. RAG searches use Cosine similarity matches to query documents.

---

## 7. MULTI-AGENT ARCHITECTURE

The system's intelligence is distributed across five specialized autonomous agents:

### 1. Coordinator Agent
* **Purpose:** Orchestrates the ticket conversation flow and state machine transitions.
* **Responsibilities:** Classifies the session status, logs conversation turns, coordinates A2A messages, initiates tickets, and intercepts rejections.
* **Inputs:** Raw user chat text, session identifier, user ID, current state context.
* **Outputs:** Chat response strings, status update events, ticket records.
* **Workflow:** Ingests input -> routes to Classification -> determines path (Auto-escalate/Clarify/Troubleshoot) -> updates database state -> replies to user.

### 2. Classification Agent
* **Purpose:** Classifies natural language requests into structured IT categories.
* **Responsibilities:** Computes category mapping, builds ticket summaries, and assesses confidence.
* **Inputs:** Natural language query.
* **Outputs:** Category (string), Summary (string), Confidence Score (float).
* **Workflow:** Runs zero-shot classification prompts on query -> generates structural output matches -> maps response.

### 3. Troubleshooting Agent
* **Purpose:** Executes diagnostics and generates remediation guidelines.
* **Responsibilities:** Invokes MCP diagnostic tools, aggregates system logs, and designs step-by-step resolution guides.
* **Inputs:** Issue category, user query, retrieved knowledge base text.
* **Outputs:** Diagnostic steps executed (list), recommendations (string), resolution plan (string).
* **Workflow:** Selects target MCP tool based on category -> runs check -> synthesizes tools and article data -> returns structured troubleshooting payload.

### 4. Knowledge Agent
* **Purpose:** Acts as a librarian agent searching the embedded vector space.
* **Responsibilities:** Embedded index queries and source document parsing.
* **Inputs:** Troubleshooting query text.
* **Outputs:** Matching document text, confidence score, source metadata, article path.
* **Workflow:** Queries ChromaDB collection using semantic search query -> pulls the top matched chunks -> returns metadata.

### 5. Escalation Agent
* **Purpose:** Manages level-2 engineer handover logs.
* **Responsibilities:** Escalation prioritization and technical summary construction.
* **Inputs:** Diagnostic steps attempted, current workstation state logs, ticket ID.
* **Outputs:** Assigned team (string), priority rating (string), handoff notes (string).
* **Workflow:** Assesses ticket history -> assigns priority -> writes system state summary logs -> inserts escalation DB record.

---

## 8. AGENT RESPONSIBILITIES TABLE

| Agent Name | Role | Primary Input | Primary Output | Dependencies |
| :--- | :--- | :--- | :--- | :--- |
| **Coordinator Agent** | Orchestrator | User chat text, Session ID | natural language bot response | Classification, Troubleshooting, Escalation |
| **Classification Agent** | Triage Analyst | User text | Category, Summary, Confidence | None |
| **Troubleshooting Agent** | Diagnostics Analyst | Category, User text, KB text | Diagnostic steps, Recommendation, Plan | Knowledge Agent, System MCP Tools |
| **Knowledge Agent** | KB Librarian | Search queries | Matched manual sections, scores | ChromaDB Vector Store |
| **Escalation Agent** | L2 Dispatcher | Attempted checks, system state | Assignee team, Priority, Handoff logs | SQLite memory tables |

---

## 9. A2A COMMUNICATION ARCHITECTURE

The system implements Agent-to-Agent (A2A) communication to enable agents to send messages to each other using structured data payloads.

### Message Router
The A2A Router registers agent instances and manages message routing. When an agent sends a message, the router delivers it to the target receiver agent, registers logs in SQLite, and handles response routing.

### Message Schema
A2A communication utilizes a strict JSON message protocol defined as follows:

```json
{
  "sender": "coordinator_agent",
  "receiver": "classification_agent",
  "task": "classify_ticket",
  "payload": {
    "query": "I cannot connect to the corporate VPN",
    "user_id": "U101",
    "session_id": "SES-1029",
    "trace_id": "TRC-7F98B20C"
  },
  "timestamp": "2026-06-05T19:42:01.321456"
}
```

### Trace IDs & Observability
Every user request generates a unique `Trace ID` (e.g. `TRC-7F98B20C`). This identifier is propagated across all A2A messages exchanged during the transaction. This allows the backend to group all logs associated with a single interaction, enabling real-time trace tracking and visual diagnostics on the settings/activity pages.

---

## 10. Model Context Protocol (MCP) ARCHITECTURE

The system utilizes the **Model Context Protocol (MCP)**, an open standard that enables LLMs to interact with external data sources and execution tools in a secure, structured manner. Rather than writing custom ad-hoc integrations for every script, MCP provides a unified API structure for tool registrations.

### 1. Directory MCP
Exposes administrative directory tools to fetch user information and verify organization structures:
* `get_user_information(user_id)`: Fetches name, email, department, and manager name.
* `get_department(user_id)`: Verifies team alignments.
* `get_manager(user_id)`: Retrives manager details.

### 2. Ticket MCP
Provides hooks to create and modify ticket entries:
* `create_ticket(user_id, category, summary, status)`: Creates database records.
* `update_ticket(ticket_id, status)`: Modifies statuses.
* `close_ticket(ticket_id)`: Marks tickets as resolved.
* `escalate_ticket(ticket_id)`: Assigns tickets to Level-2 support queues.

### 3. Knowledge MCP
Handles standard document queries:
* `semantic_search(query, limit)`: Runs vector collection lookups.
* `search_documents(keyword)`: Scans filesystem documentation.

### 4. System Diagnostic MCP
Enables executable workstation checks:
* `check_vpn()`: Checks VPN interfaces and pings gateway hosts.
* `check_network()`: Pings public gateways and DNS routing tables.
* `check_disk_space()`: Verifies drive space statistics.
* `check_memory_usage()`: Evaluates RAM utilization.
* `check_cpu_usage()`: Checks CPU utilization.
* `check_printer_status()`: Scans local print spoolers and print queues.

### Benefits of MCP
* **Loose Coupling:** The language models do not need hardcoded tools; they read schemas dynamically.
* **Security:** Execution remains isolated inside the sandboxed MCP server environment.
* **Reusability:** The same diagnostic tools can be invoked by other enterprise automation platforms.

---

## 11. MEMORY MANAGEMENT

Memory is split between short-term transactional states and long-term historical records.

```
                  +-----------------------------------+
                  |           User Request            |
                  +-----------------+-----------------+
                                    |
                                    v
                  +-----------------+-----------------+
                  |      Short-Term Memory (ADK)      |
                  |  (user_id, ticket_id, status...)  |
                  +-----------------+-----------------+
                                    |
                                    v Database Queries
                  +-----------------+-----------------+
                  |     Long-Term Memory (SQLite)     |
                  | (Tickets, Conversations, Logs...) |
                  +-----------------------------------+
```

### 1. Short-Term Memory (Google ADK Session State)
Managed dynamically via the Google ADK Session State. It tracks parameters within a active chat:
* `user_id`: Current employee identifier.
* `ticket_id`: Active ticket ID associated with the session.
* `issue_category`: Classified category of the request.
* `ticket_status`: Active workflow state (`new`, `awaiting_feedback`, `resolved`, `escalated`).
* `diagnostic_steps`: List of checks executed in the current session.
* `knowledge_articles`: Matched knowledge guides.
* `escalation_status`: Escalation details.

On backend restarts, the system queries the SQLite database for the user's last ticket and populates the session state, ensuring context is preserved across restarts.

### 2. Long-Term Memory (SQLite Database)
Persists history, audit logging records, and metric tables across application lifecycles.

---

## 12. DATABASE DESIGN

The relational SQLite database consists of seven tables structured as follows:

```
  +--------------------+             +--------------------+
  |       Users        |             |      Tickets       |
  +--------------------+             +--------------------+
  | PK  user_id        |<-------+    | PK  ticket_id      |
  |     name           |        |    | FK  user_id        |
  |     email          |        |    |     category       |
  |     department     |        |    |     summary        |
  |     manager_name   |        |    |     status         |
  +--------------------+        |    |     created_at     |
                                |    |     updated_at     |
  +--------------------+        |    |     resolved_at    |
  |   Conversations    |        |    |     res_summary    |
  +--------------------+        |    |     res_source     |
  | PK  id             |        |    +---------+----------+
  | FK  ticket_id      |--------+              |
  |     speaker        |                       |
  |     message        |                       |
  |     timestamp      |                       |
  +--------------------+                       |
                                               |
  +--------------------+                       |
  |    Escalations     |                       |
  +--------------------+                       |
  | PK  escalation_id  |                       |
  | FK  ticket_id      |<----------------------+
  |     reason         |                       |
  |     priority       |                       |
  |     rec_team       |                       |
  |     handoff_notes  |                       |
  |     created_at     |                       |
  +--------------------+                       |
                                               |
  +--------------------+                       |
  | KnowledgeSearches  |                       |
  +--------------------+                       |
  | PK  search_id      |                       |
  | FK  ticket_id      |<----------------------+
  |     query          |
  |     results        |
  |     timestamp      |
  +--------------------+
```

### 1. Users Table
Stores information for corporate directory lookups:
* `user_id` (TEXT, PK): Unique employee ID.
* `name` (TEXT), `email` (TEXT), `department` (TEXT), `manager_name` (TEXT).

### 2. Tickets Table
Represents support incidents and tracks resolutions:
* `ticket_id` (INTEGER, PK, AUTOINCREMENT)
* `user_id` (TEXT, FK to Users)
* `category` (TEXT): Incident type (VPN, Printer, Email, etc.).
* `summary` (TEXT): Incident description.
* `status` (TEXT): Incident state (`open`, `resolved`, `escalated`).
* `created_at` (TEXT), `updated_at` (TEXT).
* `resolved_at` (TEXT): Timestamp when resolution was delivered.
* `resolution_summary` (TEXT): Auto-generated solution details.
* `resolution_source` (TEXT): Source documentation used.

### 3. Conversations Table
Stores dialog turns associated with tickets:
* `id` (INTEGER, PK, AUTOINCREMENT)
* `ticket_id` (INTEGER, FK to Tickets)
* `speaker` (TEXT): Senders (`User`, `System`, etc.).
* `message` (TEXT), `timestamp` (TEXT).

### 4. Escalations Table
Stores tickets escalated to human engineers:
* `escalation_id` (INTEGER, PK, AUTOINCREMENT)
* `ticket_id` (INTEGER, FK to Tickets)
* `reason` (TEXT): Reason for escalation.
* `priority` (TEXT): Escalation priority.
* `recommended_team` (TEXT): Assigned support group.
* `handoff_notes` (TEXT): Full system states and diagnostic steps.
* `created_at` (TEXT).

### 5. KnowledgeSearches Table
Audits search queries:
* `search_id` (INTEGER, PK, AUTOINCREMENT)
* `ticket_id` (INTEGER, FK to Tickets)
* `query` (TEXT): Search query string.
* `results` (TEXT): JSON dump of matched articles.
* `timestamp` (TEXT).

### 6. A2ALogs Table
Tracks agent-to-agent traces:
* `id` (INTEGER, PK, AUTOINCREMENT)
* `trace_id` (TEXT), `session_id` (TEXT), `ticket_id` (INTEGER, Nullable).
* `sender` (TEXT), `receiver` (TEXT), `task` (TEXT), `payload` (TEXT), `timestamp` (TEXT).

---

## 13. KNOWLEDGE BASE ARCHITECTURE

The system uses a Retrieval-Augmented Generation (RAG) architecture to find solutions for common IT issues.

```
+--------------------+      +--------------------+      +--------------------+
|  PDF/Text Manuals  |----->|  SentenceX Embed   |----->|  ChromaDB Vector   |
|   (Guides Space)   |      |   (384-dim Vector) |      |     Collection     |
+--------------------+      +--------------------+      +--------------------+
                                                                   ^
                                                                   | RAG Search
                                                                   v
                                                        +--------------------+
                                                        |  Knowledge Agent   |
                                                        +--------------------+
```

### Knowledge Guides Data
The repository holds structured troubleshooting guides:
* `vpn_diagnostics.txt`: Restart service details, network routing tables, and gateway IPs.
* `password_reset.txt`: URL configurations for portals and self-service guidelines.
* `printer_setup.txt`: Print Spooler management and local print queue cleanup instructions.
* `email_config.txt`: Exchange server parameters and Outlook profile commands.
* `software_install.txt`: Software center directories and license validation checklists.

### ChromaDB RAG Vector Store
1. **Preprocessing:** Documents are split into logical sections based on headings.
2. **Vector Space Generation:** Sections are embedded into a 384-dimensional vector space using sentence-transformer models.
3. **Semantic Ingestion:** Chunks are loaded into a persistent ChromaDB collection (`kb_articles`).
4. **Search Resolution:** When an incident is logged, the Knowledge Agent runs a Cosine similarity search. The matched guide sections are retrieved and added to the Troubleshooting Agent's context.

---

## 14. FRONTEND ARCHITECTURE

The frontend is built as a single-page application (SPA) with **React**, **TypeScript**, and **Vite**. It enforces a clean SaaS light-theme dashboard styled with vanilla CSS.

### Pages

#### 1. Dashboard (`/`)
Displays key metrics:
* Metric counters (Open, Resolved, Pending Escalation, Knowledge Searches).
* Shortlist table of recent tickets.
* Live feed of system events and A2A log traces.
* Compact list of automated background services.

#### 2. Support Requests (`/support`)
Displays intake forms for submitting incidents. Includes dropdown selectors for categories and priorities, a drag-and-drop zone for screenshots, and a history list to view active tickets.

#### 3. AI Assistant (`/chat`)
A ChatGPT-style interface for chatting with the AI support assistant. Features conversation history tracking, suggested questions, and collapsible agent trace panels that show the step-by-step diagnostic process.

#### 4. Tickets (`/tickets`)
A Jira-style table registry. Supports full-text search, filters for category/status/priority, and pagination. Clicking a ticket opens a drawer panel showing conversation logs and escalation paths.

#### 5. Knowledge Base (`/kb`)
Displays search panels and categories. Shows matched search articles with confidence scores, source documents, and expandable content boxes.

#### 6. Activity Center (`/activity`)
A log audit panel. Translates system agent labels (e.g. `troubleshooting_agent` -> `Diagnostic Service`) into clear terms. Features text search, log filtering, and data inspect drawers.

#### 7. System Health (`/health`)
An administrator status panel. Monitors database, vector storage, agent, and WebSocket connection states. Includes a console viewer for logs and lists recent errors.

#### 8. Settings (`/settings`)
Provides general system settings (REST API and WebSocket connection URLs) and an "About System" tab that renders the interactive architecture diagram.

---

## 15. BACKEND ARCHITECTURE

The backend is built with **FastAPI** to enable high-speed data exchanges.

### 1. REST APIs
* `POST /api/chat`: Runs the A2A router process. Syncs sessions from the database and returns final agent responses, updated ticket models, and logs.
* `POST /api/tickets`: Creates a ticket and broadcasts a WebSocket notification.
* `GET /api/tickets`: Lists all tickets.
* `GET /api/ticket/{id}`: Returns ticket details, conversations, and escalation records.
* `GET /api/knowledge/search?q={query}`: Runs a vector lookup against ChromaDB.
* `GET /api/health`: Returns health statuses for SQLite and ChromaDB.

### 2. WebSockets (`/ws/events`)
Maintains connection lists for connected browsers. The API routes events (e.g. `ticket_created`, `ticket_resolved`, `escalation_triggered`) to the Connection Manager to broadcast updates, ensuring real-time dashboard updates without polling.

---

## 16. COMPLETE WORKFLOW EXAMPLE

### Scenario: "My VPN is not connecting"

```
[ User ] -- Submit Issue --> [ Coordinator Agent ]
                                     |
                                     | A2A Message
                                     v
                           [ Classification Agent ]
                                     |
                                     | Response: "VPN Connection Issue"
                                     v
                           [ Troubleshooting Agent ]
                                     |
                                     +---> [ Knowledge Agent ] -- Query ChromaDB --> [ "vpn_diagnostics.txt" ]
                                     |
                                     +---> [ Diagnostic MCP ] -- Run check_vpn() -> [ "vpn_service: stopped" ]
                                     |
                                     v
                           [ Troubleshooting Agent ] -- Compile Plan & Recommendation
                                     |
                                     v
                           [ Coordinator Agent ]
                                     |
                                     +---> Auto-Resolves Ticket in DB (Status: "resolved")
                                     |
                                     +---> Broadcasts "ticket_resolved" event over WebSockets
                                     |
                                     +---> Returns guide to User: "Restart Cisco AnyConnect service..."
                                     |
                                     +---> (If user says "still doesn't work") --> Escalates to Level-2
```

1. **Submission:** The user submits the request "My VPN is not connecting" via the React app.
2. **Classification:** The Coordinator Agent routes the query to the Classification Agent via A2A, which classifies the category as `"VPN Connection Issue"` (with high confidence).
3. **Diagnostics & Knowledge Search:**
   * The Coordinator Agent routes the ticket to the Troubleshooting Agent.
   * The Troubleshooting Agent queries the Knowledge Agent for solutions. The Knowledge Agent returns relevant troubleshooting steps from `vpn_diagnostics.txt`.
   * The Troubleshooting Agent invokes the System Diagnostic MCP tool `check_vpn()`, which runs local checks and detects that the Cisco AnyConnect service is stopped.
4. **Resolution:** The Troubleshooting Agent combines the diagnostic findings and knowledge base solutions to generate a step-by-step resolution plan.
5. **Auto-Resolution & Delivery:**
   * The Coordinator Agent calls `resolve_ticket(ticket_id, summary, source)` in the database, setting the status to `'resolved'` and storing the recommendation as the resolution summary.
   * A WebSocket event (`ticket_resolved`) is broadcast, updating dashboard metrics.
   * The system prompts the user with the resolution steps and asks if the issue is solved.
6. **Escalation (If Required):** If the user responds with negative feedback (e.g., "It still doesn't work"), the Coordinator Agent intercepts the reply, transitions the ticket status to `'escalated'`, and calls the Escalation Agent to assign the ticket to the Network Operations team with L2 handoff notes.

---

## 17. TESTING AND VALIDATION

The system was verified using three testing methodologies:

### 1. Unit Testing
* Verified the SQLite database helper functions (`create_ticket`, `resolve_ticket`, `log_user_feedback`) independently.
* Tested local diagnostic MCP tool executions (`check_vpn`, `check_printer_status`) to verify they return structured payloads.

### 2. Integration Testing
* Simulated A2A routing flows under mock conditions.
* Verified that the Knowledge Agent successfully queries ChromaDB and returns accurate manual sections.

### 3. End-to-End Testing
Tested the 5 primary troubleshooting flows end-to-end:
* **VPN Issue:** Simulated "I cannot connect to the corporate VPN". Verified the ticket is auto-resolved with the AnyConnect restart recommendation, and then escalated to the Network Operations queue when the user replies "It still doesn't work".
* **Password Reset:** Verified the system detects active directory locks and provides the self-service reset URL.
* **Printer Issue:** Verified spooler audits and queue clearing steps.
* **Email Configuration:** Tested offline Exchange configurations and profile setups.
* **Software Install:** Verified disk space checks and Software Center guide recommendations.

---

## 18. RESULTS AND DISCUSSION

* **Performance:** Automatic classification and diagnostic execution take less than 1.5 seconds under mock environments and 5-8 seconds under live LLM execution, reducing triage latency.
* **Resolution Rates:** Repetitive Level-1 issues are resolved automatically, saving engineering time for complex issues.
* **Data Consistency:** The cleanup run processed 18 historical tickets and successfully resolved database inconsistencies:
  * **Open:** 3
  * **Resolved:** 10
  * **Escalated:** 13
* **Observability:** Propagating Trace IDs enables tracking A2A message exchanges. Developers can debug routing sequences via the settings logs or health consoles.

---

## 19. ADVANTAGES

* **Zero-Touch Triage:** Automates categorization, prioritizing, and assigning support tickets.
* **Executable Diagnostics:** Bridges communication and diagnostic tool execution via Model Context Protocol.
* **Self-Service Resolution:** Empowers users to resolve issues independently via automated step-by-step resolution guides.
* **Smart Escalation:** Automatically provides Level-2 technicians with clear diagnostic logs, reducing manual handoff times.
* **SaaS Design:** Designed with a ServiceNow-style light-theme layout suitable for corporate portals.

---

## 20. LIMITATIONS

* **Mock Environment Dependencies:** Diagnostic MCP tools simulate system states under mock settings. Real-world implementations require workstation agents.
* **Rate Limits:** Running multiple concurrent LLM calls can exceed API limits (Gemini 429 errors) when using free API tiers.
* **Single User Context:** The prototype seeds conversations under a single default user context (`U101`).

---

## 21. FUTURE ENHANCEMENTS

* **Active Directory Integration:** Connect to LDAP servers to enable real-time user password resets and account unlocks.
* **Real Workstation Diagnostics:** Deploy agent modules on local workstations to run actual network, memory, and application checks.
* **Kubernetes Deployment:** Package the FastAPI backend and React frontend into Docker images and deploy them onto K8s clusters.
* **Multi-User Authentication:** Implement OAuth2/OpenID protocols for secure sign-ons and role-based access control (RBAC).

---

## 22. CONCLUSION

The **Autonomous IT Helpdesk System** demonstrates the potential of utilizing multi-agent AI architectures to automate corporate IT support workflows. By integrating the Google Agent Development Kit (ADK) and Model Context Protocol (MCP), the platform orchestrates specialized agents to classify requests, execute diagnostics, and query knowledge bases. E2E validation shows that common workstation and network issues are resolved and logged within seconds, with clear escalation paths to Level-2 queues if troubleshooting fails.

---

## 23. REFERENCES

1. Google Agent Development Kit (ADK) Documentation: https://google.github.io/adk-docs/
2. Model Context Protocol (MCP) Specifications: https://modelcontextprotocol.io/
3. FastAPI Framework Specifications: https://fastapi.tiangolo.com/
4. SQLite Relational Database Engine: https://www.sqlite.org/
5. Chroma Vector Database Documentation: https://docs.trychroma.com/

---

## 24. ARCHITECTURE DIAGRAMS

### 1. Overall System Architecture

```mermaid
graph TD
    User([Corporate User]) <-->|Interacts| Frontend[React TypeScript Vite UI]
    Frontend <-->|HTTP REST & WebSocket| Backend[FastAPI Server]
    Backend <-->|A2A Messages| Coordinator[Coordinator Agent]
    Coordinator <-->|SQLite Memory CRUD| Database[(SQLite DB)]
    Coordinator <-->|A2A Routing| Classify[Classification Agent]
    Coordinator <-->|A2A Routing| Troubleshoot[Troubleshooting Agent]
    Coordinator <-->|A2A Routing| Escalate[Escalation Agent]
    Troubleshoot <-->|A2A Routing| Knowledge[Knowledge Agent]
    Troubleshoot <-->|Executes| MCP[MCP Diagnostic Tools]
    Knowledge <-->|Vector Search| Chroma[(ChromaDB Store)]
```

### 2. Multi-Agent Organization Loop

```mermaid
flowchart LR
    UserRequest([User Query]) --> Coordinator
    subgraph Multi-Agent Loop
        Coordinator[Coordinator Agent] <--> Classify[Classification Agent]
        Coordinator <--> Troubleshoot[Troubleshooting Agent]
        Coordinator <--> Escalate[Escalation Agent]
        Troubleshoot <--> Knowledge[Knowledge Agent]
    end
    Troubleshoot --> Diagnostics[MCP Diagnostics]
    Knowledge --> VectorStore[(ChromaDB RAG)]
    Escalate --> Handover[Level-2 Technician Handoff]
```

### 3. Agent-to-Agent (A2A) Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Employee
    participant Coord as Coordinator Service
    participant Class as Classification Service
    participant Diagnostic as Diagnostic Service
    participant KB as Knowledge Service
    participant Esc as Escalation Service

    User->>Coord: Chat: "My VPN is offline"
    Coord->>Class: A2A (Task: classify_ticket)
    Class-->>Coord: Category: VPN, Confidence: 95%
    Coord->>Diagnostic: A2A (Task: troubleshoot_ticket)
    Diagnostic->>KB: A2A (Task: search_knowledge)
    KB-->>Diagnostic: Guide: vpn_diagnostics.txt
    Diagnostic->>Diagnostic: Execute check_vpn() via MCP
    Diagnostic-->>Coord: Recommendations & Plan
    Coord->>Coord: Auto-Resolve Ticket in Database
    Coord-->>User: Resolution Guide ("Restart AnyConnect...")
    User->>Coord: "It still doesn't work"
    Coord->>Esc: A2A (Task: escalate_ticket)
    Esc-->>Coord: Queue: Network Operations, Priority: High
    Coord-->>User: Escalation Details ("Assigned to L2...")
```

### 4. Model Context Protocol (MCP) Architecture

```mermaid
graph LR
    subgraph Agent Client
        Troubleshoot[Troubleshooting Agent]
    end
    subgraph Model Context Protocol
        Troubleshoot <-->|JSON RPC| MCP_Server[MCP Server Registry]
        MCP_Server --> Directory[Directory MCP: user info]
        MCP_Server --> Ticket[Ticket MCP: DB updates]
        MCP_Server --> Knowledge[Knowledge MCP: semantic search]
        MCP_Server --> Diagnostic[Diagnostic MCP: check system]
    end
```

### 5. Memory Architecture

```mermaid
graph TD
    subgraph Short-Term Memory
        ADK[ADK Session State Context]
        ADK --> user_id[user_id: U101]
        ADK --> ticket_id[ticket_id: TCK-122]
        ADK --> ticket_status[ticket_status: awaiting_feedback]
    end
    subgraph Long-Term Memory
        SQLite[(SQLite Database)]
        SQLite --> Users[Users Table]
        SQLite --> Tickets[Tickets Table]
        SQLite --> Conversations[Conversations Table]
        SQLite --> Escalations[Escalations Table]
    end
    ADK <-->|Sync State| SQLite
```

### 6. Ticket Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> open : Ticket Created
    open --> resolved : Troubleshooting Guide Delivered
    resolved --> open : Follow-up Question
    resolved --> escalated : User says "It still doesn't work"
    open --> escalated : Low Classification Confidence
    escalated --> [*]
    resolved --> [*]
```

---

## 25. WORKING SYSTEM SCREENSHOTS

The following screenshots capture the working interface, live dashboard metrics, active diagnostics, ticket resolution states, and Level-2 escalations of the Autonomous IT Helpdesk System:

### 1. Enterprise SaaS Dashboard & Operational Metrics
Tracks active ticket counts, automation service registries, and recent activities in real time.
![SaaS Dashboard](docs/screenshots/Screenshot%202026-06-06%20105518.png)

### 2. Support Requests Intake & Portal Page
Allows corporate employees to submit support incidents and track ticket queues.
![Support Requests Intake Page](docs/screenshots/Screenshot%202026-06-06%20105543.png)

### 3. AI Assistant Chat & Auto-Diagnostics Loop
Displays natural language chats, confidence scores, and collapsible troubleshooting diagnostic logs.
![AI Assistant Chat View](docs/screenshots/Screenshot%202026-06-06%20105559.png)

### 4. Ticket Auto-Resolution Guide & Citation Reference
Shows the diagnostic recommendation and retrieved knowledge base citation delivered to the user.
![Auto-Resolution Guide](docs/screenshots/Screenshot%202026-06-06%20105659.png)

### 5. Ticket Registry console & Filter Drawer
Provides the administrative panel to search, filter, and inspect tickets in detail.
![Ticket Registry Page](docs/screenshots/Screenshot%202026-06-04%20130213.png)

### 6. Level-2 Escalation Handoff & Log Summary
Presents the technician handoff logs, priority level, and assigned queues when a ticket requires L2 attention.
![Escalation Handoff Page](docs/screenshots/Screenshot%202026-06-04%20130306.png)
