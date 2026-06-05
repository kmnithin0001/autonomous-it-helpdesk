import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchHealth, fetchAgents, fetchTickets, fetchSystemLogs } from '../api';
import {
  Database,
  Cpu,
  Server,
  Layers,
  Terminal,
  AlertOctagon,
  RefreshCw,
  Search,
  Shuffle
} from 'lucide-react';

export default function SystemHealth() {
  const [selectedLogFile, setSelectedLogFile] = useState('system.log');
  const [logSearch, setLogSearch] = useState('');
  const [linesCount, setLinesCount] = useState(60);

  // Queries
  const { data: health, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5000,
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 5000,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
  });

  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['systemLogs', selectedLogFile, linesCount],
    queryFn: () => fetchSystemLogs(selectedLogFile, linesCount),
    refetchInterval: 5000,
  });

  // Calculate statistics
  const escalatedTicketsList = tickets.filter((t: any) => t.status === 'escalated');
  const dbHealth = health?.database?.status === 'Online';
  const chromaHealth = health?.vector_db?.status === 'Online';

  const mcpServers = [
    { name: 'User Directory MCP Service', desc: 'Queries employee profiles database', status: 'Online' },
    { name: 'Ticket Operations MCP Service', desc: 'Updates tickets and escalates to human teams', status: 'Online' },
    { name: 'Knowledge Base MCP Service', desc: 'Indexes knowledge guides inside vector storage', status: 'Online' },
    { name: 'System Diagnostics MCP Service', desc: 'Performs hardware and network check utilities', status: 'Online' },
  ];

  const handleRefreshAll = () => {
    refetchHealth();
    refetchLogs();
  };

  // Filter logs
  const filteredLogs = logs.filter((line: string) =>
    line.toLowerCase().includes(logSearch.toLowerCase())
  );

  // Translate agents to service names
  const getCleanServiceName = (id: string) => {
    switch (id) {
      case 'coordinator_agent': return 'Coordinator Service';
      case 'classification_agent': return 'Classification Service';
      case 'knowledge_agent': return 'Knowledge Service';
      case 'troubleshooting_agent': return 'Diagnostic Service';
      case 'escalation_agent': return 'Escalation Service';
      default: return id.replace('_', ' ');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-905">
            System Health & Diagnostics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Expose internal configurations, database records, ADK orchestration registers, and FastMCP daemon streams.
          </p>
        </div>
        <button
          onClick={handleRefreshAll}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition cursor-pointer"
        >
          <RefreshCw size={12} className={(healthLoading || logsLoading) ? 'animate-spin' : ''} />
          <span>Refresh System Checks</span>
        </button>
      </div>

      {/* Grid: Health Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Card 1: Relational Database */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              Database Status
            </span>
            <Database size={16} className={dbHealth ? 'text-emerald-500' : 'text-slate-400'} />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900">
              {dbHealth ? 'Healthy' : 'Offline'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
              Seeded: {health?.database?.seeded_users || 0} profiles
            </span>
          </div>
          <div className={`w-full h-1 rounded-full ${dbHealth ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            <div className={`h-full rounded-full ${dbHealth ? 'bg-emerald-500 w-full' : 'bg-slate-400 w-0'}`} />
          </div>
        </div>

        {/* Card 2: Vector Store */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              ChromaDB Status
            </span>
            <Layers size={16} className={chromaHealth ? 'text-emerald-500' : 'text-slate-400'} />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900">
              {chromaHealth ? 'Online' : 'Offline'}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
              Indexed: {health?.vector_db?.indexed_segments || 0} segments
            </span>
          </div>
          <div className={`w-full h-1 rounded-full ${chromaHealth ? 'bg-emerald-100' : 'bg-slate-200'}`}>
            <div className={`h-full rounded-full ${chromaHealth ? 'bg-emerald-500 w-full' : 'bg-slate-400 w-0'}`} />
          </div>
        </div>

        {/* Card 3: ADK Services */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              ADK Services
            </span>
            <Cpu size={16} className="text-blue-500" />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900">
              {agents.filter((a: any) => a.status === 'Online').length} / {agents.length} Online
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
              Mode: {health?.execution_mode || 'MOCK'}
            </span>
          </div>
          <div className="w-full h-1 bg-emerald-100 rounded-full">
            <div className="h-full bg-emerald-500 rounded-full w-full" />
          </div>
        </div>

        {/* Card 4: MCP Services */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              MCP Services
            </span>
            <Server size={16} className="text-blue-500" />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900">
              {mcpServers.length} / {mcpServers.length} Active
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
              FastMCP Gateways
            </span>
          </div>
          <div className="w-full h-1 bg-emerald-100 rounded-full">
            <div className="h-full bg-emerald-500 rounded-full w-full" />
          </div>
        </div>

        {/* Card 5: WebSocket Status */}
        <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
              WebSocket Status
            </span>
            <Shuffle size={16} className="text-blue-500" />
          </div>
          <div>
            <span className="text-xl font-bold text-slate-900 capitalize">
              Connected
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-semibold">
              Real-time events
            </span>
          </div>
          <div className="w-full h-1 bg-emerald-100 rounded-full">
            <div className="h-full bg-emerald-500 rounded-full w-full" />
          </div>
        </div>
      </div>

      {/* Row 2: Service registry diagnostics & Level-2 Escalations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ADK Services diagnostics list */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400">
            <Cpu size={14} className="text-blue-600" />
            ADK Services Registry
          </h2>

          <div className="flex-1 space-y-3">
            {agentsLoading ? (
              <div className="space-y-2.5 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 bg-slate-100 rounded" />
                ))}
              </div>
            ) : (
              agents.map((agent: any) => (
                <div key={agent.name} className="flex justify-between items-center text-xs border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-700 capitalize">
                      {getCleanServiceName(agent.name)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {agent.type}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[9px]">
                    {agent.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Escalations */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-1.5 text-xs uppercase tracking-wider text-slate-400">
            <AlertOctagon size={14} className="text-rose-500" />
            Recent Level-2 Escalations & Errors
          </h2>

          <div className="flex-1 overflow-y-auto max-h-[180px] space-y-2 pr-1">
            {ticketsLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded" />
                ))}
              </div>
            ) : escalatedTicketsList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                No active escalated ticket handoffs recorded.
              </div>
            ) : (
              escalatedTicketsList.map((t: any) => (
                <div
                  key={t.ticket_id}
                  className="p-3 bg-rose-50 border border-rose-150 rounded-lg text-xs flex justify-between items-center shadow-3xs"
                >
                  <div className="truncate pr-4">
                    <span className="font-mono font-bold text-rose-700">
                      TCK-{t.ticket_id}
                    </span>
                    <span className="text-slate-600 block font-semibold truncate mt-0.5">
                      {t.summary}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 bg-rose-600/10 text-rose-700 border border-rose-200 rounded font-bold text-[9px] shrink-0">
                    Escalated
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Terminal logs viewer (Service Diagnostics) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col">
        {/* Terminal Header controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-150 gap-3">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-blue-600" />
            <h2 className="font-bold text-sm text-slate-900">Service Diagnostics Log Terminal</h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* File selector pills */}
            <div className="flex bg-slate-100 p-1 rounded-lg text-[9px] font-bold border border-slate-200">
              {['system.log', 'a2a.log', 'mcp.log', 'agent.log'].map((file) => (
                <button
                  key={file}
                  onClick={() => setSelectedLogFile(file)}
                  className={`px-2 py-0.5 rounded transition cursor-pointer ${
                    selectedLogFile === file
                      ? 'bg-white text-blue-600 shadow'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {file.replace('.log', '')}
                </button>
              ))}
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={12} />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Filter diagnostics trail..."
                className="w-40 pl-7 pr-3 py-1 border border-slate-200 rounded-lg text-[10px] font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
              />
            </div>

            {/* Line tail selector */}
            <select
              value={linesCount}
              onChange={(e) => setLinesCount(Number(e.target.value))}
              className="px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-bold focus:outline-none bg-white"
            >
              <option value={30}>30 Lines</option>
              <option value={60}>60 Lines</option>
              <option value={100}>100 Lines</option>
            </select>
          </div>
        </div>

        {/* Terminal Text block */}
        <div className="mt-4 bg-slate-950 text-slate-355 p-4 rounded-lg border border-slate-900 font-mono text-[9px] leading-relaxed min-h-[300px] max-h-[380px] overflow-y-auto space-y-0.5 select-text shadow-inner">
          {logsLoading ? (
            <div className="text-slate-500 text-center py-16 animate-pulse">Streaming logs trail...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-16 font-semibold">
              No matching log records found in {selectedLogFile}.
            </div>
          ) : (
            filteredLogs.map((line: string, index: number) => {
              const isError = line.includes('ERROR') || line.includes('Exception') || line.includes('Traceback');
              const isWarning = line.includes('WARNING');
              const colorClass = isError
                ? 'text-rose-450 font-bold'
                : isWarning
                ? 'text-amber-500 font-semibold'
                : 'text-slate-350';
              return (
                <div key={index} className={colorClass}>
                  {line}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
