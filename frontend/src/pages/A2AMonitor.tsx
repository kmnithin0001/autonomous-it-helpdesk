import { useState, useEffect, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchA2ALogs, useWebSocket } from '../api';
import {
  Shuffle,
  Search,
  Filter,
  Clock,
  ChevronLeft,
  ChevronRight,
  Terminal,
  Activity,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export default function A2AMonitor() {
  const [search, setSearch] = useState('');
  const [senderFilter, setSenderFilter] = useState('All');
  const [receiverFilter, setReceiverFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Load history from DB
  const { data: initialLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['a2aLogs'],
    queryFn: fetchA2ALogs,
  });

  // Local state to merge history + real-time WS events
  const [logsList, setLogsList] = useState<any[]>([]);

  useEffect(() => {
    if (initialLogs.length > 0) {
      setLogsList(initialLogs);
    }
  }, [initialLogs]);

  // Hook into WS for real-time appends
  useWebSocket((event) => {
    if (event.event === 'a2a_message' || event.event.startsWith('a2a_')) {
      const formattedLog = {
        id: event.id || Math.floor(Math.random() * 1000000),
        trace_id: event.trace_id || 'TRC-WS',
        session_id: event.session_id || 'SES-WS',
        ticket_id: event.ticket_id || null,
        sender: event.sender || 'unknown',
        receiver: event.receiver || 'unknown',
        task: event.task || 'unknown',
        payload: event.payload || {},
        timestamp: event.timestamp || new Date().toISOString()
      };
      setLogsList((prev) => [formattedLog, ...prev]);
    }
  });

  // Senders & receivers lists translation mapping
  const getCleanServiceName = (id: string) => {
    if (!id) return '';
    const clean = id.toLowerCase();
    if (clean === 'coordinator_agent' || clean === 'coordinator') return 'Coordinator Service';
    if (clean === 'classification_agent' || clean === 'classification') return 'Classification Service';
    if (clean === 'knowledge_agent' || clean === 'knowledge') return 'Knowledge Service';
    if (clean === 'troubleshooting_agent' || clean === 'troubleshooting') return 'Diagnostic Service';
    if (clean === 'escalation_agent' || clean === 'escalation') return 'Escalation Service';
    return id.replace('_', ' ');
  };

  const rawSenders = ['All', ...new Set(logsList.map((l) => l.sender))];
  const rawReceivers = ['All', ...new Set(logsList.map((l) => l.receiver))];

  // Filtering
  const filteredLogs = logsList.filter((log) => {
    const cleanSender = getCleanServiceName(log.sender);
    const cleanReceiver = getCleanServiceName(log.receiver);
    const queryLower = search.toLowerCase();
    
    const matchesSearch =
      log.trace_id.toLowerCase().includes(queryLower) ||
      (log.ticket_id && log.ticket_id.toString().includes(queryLower)) ||
      log.sender.toLowerCase().includes(queryLower) ||
      log.receiver.toLowerCase().includes(queryLower) ||
      cleanSender.toLowerCase().includes(queryLower) ||
      cleanReceiver.toLowerCase().includes(queryLower) ||
      log.task.toLowerCase().includes(queryLower);

    const matchesSender = senderFilter === 'All' || log.sender === senderFilter;
    const matchesReceiver = receiverFilter === 'All' || log.receiver === receiverFilter;

    return matchesSearch && matchesSender && matchesReceiver;
  });

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Helper to resolve status from payload
  const getLogStatus = (log: any) => {
    if (log.payload && log.payload._status) {
      return log.payload._status;
    }
    return 'SUCCESS';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Activity Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logs tracking ticket events, escalations, knowledge searches, and background automation activity.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-sm transition cursor-pointer"
        >
          Refresh Event Trail
        </button>
      </div>

      {/* Toolbar Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search events, services, trace IDs..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Filter size={12} />
            <span>Filters</span>
          </div>

          {/* Sender */}
          <select
            value={senderFilter}
            onChange={(e) => {
              setSenderFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="All">Sender: All Services</option>
            {rawSenders.filter(s => s !== 'All').map(s => (
              <option key={s} value={s}>{getCleanServiceName(s)}</option>
            ))}
          </select>

          {/* Receiver */}
          <select
            value={receiverFilter}
            onChange={(e) => {
              setReceiverFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="All">Receiver: All Services</option>
            {rawReceivers.filter(r => r !== 'All').map(r => (
              <option key={r} value={r}>{getCleanServiceName(r)}</option>
            ))}
          </select>
        </div>

        {/* Status Indicator */}
        <div className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-700 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse">
          <Activity size={10} />
          <span>Sync Active</span>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-4 p-6 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded" />
              ))}
            </div>
          ) : totalItems === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <Shuffle size={36} className="text-slate-300 mx-auto mb-2" />
              <span>No activity events matched your criteria.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold bg-slate-50/50">
                  <th className="px-5 py-3.5">Sender</th>
                  <th className="px-5 py-3.5">Receiver</th>
                  <th className="px-5 py-3.5">Activity/Task</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.map((log: any) => {
                  const isExpanded = expandedRowId === log.id;
                  const logStatus = getLogStatus(log);
                  
                  return (
                    <Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-700">
                          {getCleanServiceName(log.sender)}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-700">
                          {getCleanServiceName(log.receiver)}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-slate-600 font-mono">
                          {log.task}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold ${
                            logStatus === 'SUCCESS'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                              : 'bg-rose-50 text-rose-700 border-rose-150'
                          }`}>
                            {logStatus === 'SUCCESS' ? <CheckCircle2 size={8} /> : <XCircle size={8} />}
                            {logStatus}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-450 font-bold flex items-center gap-1">
                          <Clock size={12} className="text-slate-400" />
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => setExpandedRowId(isExpanded ? null : log.id)}
                            className="p-1 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-blue-600 transition cursor-pointer"
                          >
                            {isExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Payload block */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="px-5 py-3.5 bg-slate-50/70">
                            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-inner">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-150 text-[10px] text-slate-400 font-semibold">
                                <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Terminal size={12} className="text-blue-600" />
                                  Automation Payload Data
                                </span>
                                <span className="font-mono">Trace ID: {log.trace_id}</span>
                              </div>
                              <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto whitespace-pre-wrap max-h-48 leading-relaxed font-semibold">
                                {JSON.stringify(log.payload, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-400">
            <span>
              Showing <span className="text-slate-700">{indexOfFirstItem + 1}</span> to{' '}
              <span className="text-slate-700">{Math.min(indexOfLastItem, totalItems)}</span> of{' '}
              <span className="text-slate-700">{totalItems}</span> automation events
            </span>

            <div className="flex gap-2">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
