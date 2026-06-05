import { useState } from 'react';
import {
  Database,
  Cpu,
  Server,
  User,
  Workflow,
  ShieldCheck,
  ArrowDown
} from 'lucide-react';

export default function Architecture() {
  const [selectedNode, setSelectedNode] = useState<string>('coordinator');

  const nodes = {
    user: {
      title: 'Employee Support Portal',
      subtitle: 'Incident Ingestion Point',
      desc: 'Employees submit diagnostic requests via the Support Portal or ask natural language queries through the AI assistant chatbot. The request packages trace IDs, user profile data (e.g. U101), and query text.',
      role: 'Initiator of helpdesk request',
      inputs: 'User Incident Description',
      outputs: 'A2AMessage payload (directed to Coordinator Agent)'
    },
    coordinator: {
      title: 'Coordinator Agent',
      subtitle: 'System Orchestration Router',
      desc: 'The central supervisor in the Google ADK multi-agent collective. Resolves session state, initiates logs trace ids, routes messages to sub-agents via the A2A Router, and packages final text responses to the user.',
      role: 'Supervises, validates, and coordinates task sequences.',
      inputs: 'User Query message, agent feedback responses',
      outputs: 'IPC messages dispatched to Classification, Knowledge, or Troubleshooting agents'
    },
    classification: {
      title: 'Classification Agent',
      subtitle: 'Intent Categorization & Scoring',
      desc: 'Analyzes user query semantics to identify ticket category (e.g., VPN, Password) and determines classification confidence scores. Integrates with SQLite to map requestor profile detail data.',
      role: 'Identifies query category and computes confidence margins.',
      inputs: 'Payload query from Coordinator',
      outputs: 'Category classification code and confidence percentage value'
    },
    troubleshooting: {
      title: 'Troubleshooting Agent',
      subtitle: 'Diagnostics Tool Executor',
      desc: 'Invokes external FastMCP tools to diagnose device or connection states. Interacts with diagnostics scripts to query VPN statuses, accounts flags, or local system diagnostics.',
      role: 'Runs diagnostic commands and parses exit status codes.',
      inputs: 'User parameters (e.g., user IP, VPN flags)',
      outputs: 'Exit status code details and diagnostics logs output text'
    },
    knowledge: {
      title: 'Knowledge Agent',
      subtitle: 'Vector Database Semantic Searcher',
      desc: 'Performs semantic searches across guide document segments. Communicates directly with ChromaDB vector storage collections to index and match troubleshooting manuals.',
      role: 'Retrieves matched guides and compiles confidence rank metrics.',
      inputs: 'Problem description query',
      outputs: 'Citations metadata (document path, section headers, confidence percentages)'
    },
    escalation: {
      title: 'Escalation Agent',
      subtitle: 'Human Handoff Supervisor',
      desc: 'Evaluates agent findings to determine if a human Level-2 technician is required. Determines severity priority (Low to Urgent) and logs handoff diagnostics inside SQLite.',
      role: 'Performs automated routing to specialized human IT desks.',
      inputs: 'Diagnostics summary, user profile parameters',
      outputs: 'SQLite Escalation registry record, assigned engineering queue'
    },
    mcp: {
      title: 'FastMCP Servers Registry',
      subtitle: 'Unified MCP Integrations Layer',
      desc: 'Unified Model Context Protocol gateway. Hosts individual servers providing tools like checking VPN statuses, account credentials, and system ping tests to the Troubleshooting Agent.',
      role: 'Safely exposes system capabilities and scripts via json API.',
      inputs: 'Agent JSON parameters schema',
      outputs: 'Tool script execution return payload'
    },
    sqlite: {
      title: 'SQLite Relational Database',
      subtitle: 'Transactional Persistence Layer',
      desc: 'Stores helpdesk state, tickets history, employee details directories, A2A communication trace logs, escalation handoffs, and customer feedback loop results.',
      role: 'Acts as the source of truth for configuration and tracking databases.',
      inputs: 'SQL Insert/Update statements',
      outputs: 'Database rows (Tickets, Conversations, Escalations, Users)'
    },
    chromadb: {
      title: 'ChromaDB Vector Store',
      subtitle: 'Semantic Reference Indexes',
      desc: 'Indices troubleshooting guides and document guides. Computes cosine similarity values between user query vectors and indexed document embedding arrays.',
      role: 'Provides semantic text matching capabilities.',
      inputs: 'Cosine query vectors (768-dim values)',
      outputs: 'Top-K documents chunks and metadata tags'
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-zinc-850">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          System Architecture Flow
        </h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Map showcasing A2A Multi-Agent routing sequence, FastMCP diagnostic tool integrations, and database persistent storage.
        </p>
      </div>

      {/* Grid: Map + Detail Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left Grid: Visual Flow Diagram */}
        <div className="lg:col-span-8 bg-white border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl shadow-xs p-6 flex flex-col justify-between">
          <h2 className="font-bold text-slate-905 dark:text-white mb-6 flex items-center gap-1.5 text-sm">
            <Workflow size={16} className="text-blue-600 dark:text-blue-400" />
            Interactive Agent Collaboration Pipeline
          </h2>

          {/* Top-To-Bottom Sequence */}
          <div className="flex-1 flex flex-col items-center py-4 gap-3">
            {/* 1. User */}
            <button
              onClick={() => setSelectedNode('user')}
              className={`p-3.5 rounded-lg border flex items-center gap-3.5 transition cursor-pointer w-72 text-left shadow-2xs ${
                selectedNode === 'user'
                  ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 text-slate-600'
              }`}
            >
              <span className="p-1 bg-blue-600 text-white rounded"><User size={14} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">1. Employee User Portal</div>
                <div className="text-[9px] text-slate-400">Triggers support incident</div>
              </div>
            </button>

            <ArrowDown className="text-slate-300" size={16} />

            {/* 2. Coordinator */}
            <button
              onClick={() => setSelectedNode('coordinator')}
              className={`p-3.5 rounded-lg border flex items-center gap-3.5 transition cursor-pointer w-72 text-left shadow-2xs ${
                selectedNode === 'coordinator'
                  ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 text-slate-600'
              }`}
            >
              <span className="p-1 bg-blue-600 text-white rounded"><Cpu size={14} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">2. Coordinator Agent</div>
                <div className="text-[9px] text-slate-400">A2A Supervisor Router</div>
              </div>
            </button>

            <ArrowDown className="text-slate-300" size={16} />

            {/* 3. Classification */}
            <button
              onClick={() => setSelectedNode('classification')}
              className={`p-3.5 rounded-lg border flex items-center gap-3.5 transition cursor-pointer w-72 text-left shadow-2xs ${
                selectedNode === 'classification'
                  ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 text-slate-600'
              }`}
            >
              <span className="p-1 bg-blue-600 text-white rounded"><Cpu size={14} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">3. Classification Agent</div>
                <div className="text-[9px] text-slate-400">Categorizes incident & score</div>
              </div>
            </button>

            <ArrowDown className="text-slate-300" size={16} />

            {/* 4. Troubleshooting */}
            <button
              onClick={() => setSelectedNode('troubleshooting')}
              className={`p-3.5 rounded-lg border flex items-center gap-3.5 transition cursor-pointer w-72 text-left shadow-2xs ${
                selectedNode === 'troubleshooting'
                  ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 text-slate-600'
              }`}
            >
              <span className="p-1 bg-blue-600 text-white rounded"><Cpu size={14} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">4. Troubleshooting Agent</div>
                <div className="text-[9px] text-slate-400">Executes diagnostics tool checks</div>
              </div>
            </button>

            <ArrowDown className="text-slate-300" size={16} />

            {/* 5. Knowledge */}
            <button
              onClick={() => setSelectedNode('knowledge')}
              className={`p-3.5 rounded-lg border flex items-center gap-3.5 transition cursor-pointer w-72 text-left shadow-2xs ${
                selectedNode === 'knowledge'
                  ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 text-slate-600'
              }`}
            >
              <span className="p-1 bg-blue-600 text-white rounded"><Cpu size={14} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">5. Knowledge Agent</div>
                <div className="text-[9px] text-slate-400">ChromaDB similarity citations</div>
              </div>
            </button>

            <ArrowDown className="text-slate-300" size={16} />

            {/* 6. Escalation */}
            <button
              onClick={() => setSelectedNode('escalation')}
              className={`p-3.5 rounded-lg border flex items-center gap-3.5 transition cursor-pointer w-72 text-left shadow-2xs ${
                selectedNode === 'escalation'
                  ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                  : 'border-slate-200 hover:border-slate-350 bg-slate-50/50 text-slate-600'
              }`}
            >
              <span className="p-1 bg-blue-600 text-white rounded"><Cpu size={14} /></span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold">6. Escalation Agent</div>
                <div className="text-[9px] text-slate-400">Compiles L2 handoff summary</div>
              </div>
            </button>

            {/* Separate Divider for Infrastructure Resources */}
            <div className="w-full flex items-center gap-3 py-3 mt-3">
              <hr className="flex-1 border-slate-150" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Resource & Storage Pools</span>
              <hr className="flex-1 border-slate-150" />
            </div>

            {/* MCP & Databases row */}
            <div className="grid grid-cols-3 gap-4 w-full">
              {[
                { key: 'mcp', name: 'FastMCP Servers', icon: Server, desc: 'API Gateways' },
                { key: 'sqlite', name: 'SQLite Database', icon: Database, desc: 'Relational DB' },
                { key: 'chromadb', name: 'ChromaDB Store', icon: Database, desc: 'Vector indexes' }
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setSelectedNode(item.key)}
                  className={`p-2.5 rounded-lg border flex flex-col items-center gap-1 transition cursor-pointer text-center shadow-2xs ${
                    selectedNode === item.key
                      ? 'border-blue-600 bg-blue-50/50 text-blue-700 font-semibold'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-600'
                  }`}
                >
                  <item.icon size={16} />
                  <span className="font-bold text-[11px] block">{item.name}</span>
                  <span className="text-[9px] text-slate-400">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Grid: Inspector Panel details */}
        <div className="lg:col-span-4 bg-white border border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 rounded-xl shadow-xs p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">
                Component Inspector
              </span>
              <h2 className="text-base font-bold text-slate-905 mt-0.5">
                {nodes[selectedNode as keyof typeof nodes].title}
              </h2>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                {nodes[selectedNode as keyof typeof nodes].subtitle}
              </p>
            </div>

            <div className="text-xs text-slate-655 leading-relaxed font-semibold">
              {nodes[selectedNode as keyof typeof nodes].desc}
            </div>

            <hr className="border-slate-150" />

            {/* Meta schemas */}
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-400 text-[9px] uppercase block mb-1">
                  Primary Duty
                </span>
                <span className="text-slate-800 font-semibold block leading-normal">
                  {nodes[selectedNode as keyof typeof nodes].role}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 text-[9px] uppercase block mb-1">
                  Payload Inputs
                </span>
                <span className="font-mono text-slate-700 bg-slate-50 border border-slate-150 p-2 rounded-lg block text-[10px] whitespace-normal leading-normal">
                  {nodes[selectedNode as keyof typeof nodes].inputs}
                </span>
              </div>
              <div>
                <span className="font-bold text-slate-400 text-[9px] uppercase block mb-1">
                  Payload Outputs
                </span>
                <span className="font-mono text-slate-700 bg-slate-50 border border-slate-150 p-2 rounded-lg block text-[10px] whitespace-normal leading-normal">
                  {nodes[selectedNode as keyof typeof nodes].outputs}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-3 py-2 border border-emerald-200 rounded-lg uppercase tracking-wider justify-center shrink-0">
            <ShieldCheck size={14} className="text-emerald-505 text-emerald-600" />
            <span>Secure ADK Sandbox Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
