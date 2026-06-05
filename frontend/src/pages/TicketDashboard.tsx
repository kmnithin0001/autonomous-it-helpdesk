import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTickets, fetchTicketDetails } from '../api';
import {
  Database,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  X,
  ShieldAlert
} from 'lucide-react';

export default function TicketDashboard() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Queries
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 5000,
  });

  const { data: ticketDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['ticketDetails', selectedTicketId],
    queryFn: () => fetchTicketDetails(selectedTicketId!),
    enabled: selectedTicketId !== null,
  });

  // Calculate SLA counts
  const openCount = tickets.filter((t: any) => t.status === 'open').length;
  const pendingCount = tickets.filter((t: any) => t.status === 'escalated').length;
  const resolvedCount = tickets.filter((t: any) => t.status === 'resolved').length;

  // Category and Escalation mapping rules to render realistic priorities & assigned teams
  const getTicketMetadata = (t: any) => {
    if (t.status === 'escalated') {
      if (t.category.includes('VPN') || t.category.includes('Network')) {
        return { priority: 'High', team: 'Network Operations' };
      }
      if (t.category.includes('Password') || t.category.includes('Access')) {
        return { priority: 'Medium', team: 'Access Management' };
      }
      return { priority: 'High', team: 'SysOps Engineering' };
    }
    if (t.category.includes('VPN')) {
      return { priority: 'High', team: 'IT Helpdesk' };
    }
    if (t.category.includes('Password') || t.category.includes('Access')) {
      return { priority: 'Medium', team: 'IT Service Desk' };
    }
    if (t.category.includes('Hardware')) {
      return { priority: 'Medium', team: 'Hardware Diagnostics' };
    }
    if (t.category.includes('Software')) {
      return { priority: 'Low', team: 'Software Licensing' };
    }
    return { priority: 'Low', team: 'IT Service Desk' };
  };

  // Filter logic
  const filteredTickets = tickets.filter((t: any) => {
    const meta = getTicketMetadata(t);
    const matchesSearch =
      t.ticket_id.toString().includes(search) ||
      t.summary.toLowerCase().includes(search.toLowerCase()) ||
      t.user_id.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'All' || t.status === statusFilter.toLowerCase();
    const matchesCategory = categoryFilter === 'All' || t.category.toLowerCase().includes(categoryFilter.toLowerCase());
    const matchesPriority = priorityFilter === 'All' || meta.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  // Sort
  const sortedTickets = [...filteredTickets].sort((a: any, b: any) => {
    const timeA = new Date(a.created_at).getTime();
    const timeB = new Date(b.created_at).getTime();
    return sortBy === 'desc' ? timeB - timeA : timeA - timeB;
  });

  // Pagination
  const totalItems = sortedTickets.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedTickets.slice(indexOfFirstItem, indexOfLastItem);

  const paginate = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const toggleSort = () => {
    setSortBy(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  // Badge styles
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'escalated':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'Urgent':
      case 'High':
        return 'bg-rose-50 text-rose-700 border-rose-150 font-bold';
      case 'Medium':
        return 'bg-amber-50 text-amber-705 border-amber-150 font-semibold';
      default:
        return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Tickets Registry
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Query registered support tickets, track SLA deadlines, and audit agent-to-human escalation chains.
        </p>
      </div>

      {/* Ticket Counts / SLA Status Row */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Open Count', value: openCount, color: 'text-amber-705 bg-amber-50 border-amber-100' },
          { label: 'Pending Count', value: pendingCount, color: 'text-rose-700 bg-rose-50 border-rose-100' },
          { label: 'Resolved Count', value: resolvedCount, color: 'text-emerald-705 bg-emerald-50 border-emerald-100' }
        ].map((card) => (
          <div key={card.label} className={`p-4 rounded-xl border flex flex-col justify-between shadow-2xs ${card.color}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">
              {card.label}
            </span>
            <span className="text-2xl font-bold block mt-1">
              {isLoading ? '...' : card.value}
            </span>
          </div>
        ))}
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
            placeholder="Search incident ID, keyword, user..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <Filter size={12} />
            <span>Filters</span>
          </div>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Escalated">Escalated</option>
            <option value="Resolved">Resolved</option>
          </select>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="All">All Categories</option>
            <option value="VPN">VPN</option>
            <option value="Password">Password</option>
            <option value="Hardware">Hardware</option>
            <option value="Software">Software</option>
            <option value="Email">Email</option>
            <option value="Other">Other</option>
          </select>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="All">All Priorities</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </div>

        {/* Sort Trigger */}
        <button
          onClick={toggleSort}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
        >
          <ArrowUpDown size={12} />
          <span>{sortBy === 'desc' ? 'Newest' : 'Oldest'}</span>
        </button>
      </div>

      {/* Service Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="space-y-3.5 p-6 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 bg-slate-100 rounded" />
              ))}
            </div>
          ) : totalItems === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs font-semibold">
              <Database size={36} className="text-slate-350 mx-auto mb-2" />
              <span>No incident tickets match the filters.</span>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase font-bold bg-slate-50/50">
                  <th className="px-5 py-3.5">Ticket ID</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5">Priority</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Assigned Team</th>
                  <th className="px-5 py-3.5">Created Date</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentItems.map((t: any) => {
                  const meta = getTicketMetadata(t);
                  return (
                    <tr
                      key={t.ticket_id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-mono font-bold text-slate-905">
                        TCK-{t.ticket_id}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {t.category}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 border rounded-md font-bold text-[9px] ${getPriorityBadgeClass(meta.priority)}`}>
                          {meta.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full font-bold text-[10px] ${getStatusBadgeClass(t.status)}`}>
                          {t.status === 'resolved' ? (
                            <CheckCircle size={9} />
                          ) : t.status === 'escalated' ? (
                            <AlertTriangle size={9} />
                          ) : (
                            <Clock size={9} />
                          )}
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-semibold">
                        {meta.team}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400 font-semibold">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedTicketId(t.ticket_id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg transition cursor-pointer"
                        >
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
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
              <span className="text-slate-700">
                {Math.min(indexOfLastItem, totalItems)}
              </span>{' '}
              of <span className="text-slate-700">{totalItems}</span> incidents
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

      {/* Ticket Details Drawer */}
      {selectedTicketId !== null && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-xs z-50 flex justify-end">
          <div
            className="w-full max-w-md bg-white border-l border-slate-200 h-full p-6 shadow-xl flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-150">
                <div>
                  <h3 className="font-bold text-base text-slate-900 font-mono">
                    TCK-{selectedTicketId}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Incident Handoff Diagnostics Log
                  </p>
                </div>
                <button
                  onClick={() => setSelectedTicketId(null)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {detailsLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-5 bg-slate-100 rounded w-1/3" />
                  <div className="h-14 bg-slate-100 rounded" />
                </div>
              ) : (
                <div className="space-y-5 text-xs">
                  {/* Status info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                        SLA State
                      </span>
                      <span className="font-semibold text-slate-800 capitalize mt-0.5 block">
                        {ticketDetails?.ticket?.status}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg">
                      <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">
                        Employee ID
                      </span>
                      <span className="font-semibold text-slate-800 font-mono mt-0.5 block">
                        {ticketDetails?.ticket?.user_id}
                      </span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-1">
                      Incident Summary
                    </span>
                    <div className="p-3 bg-slate-50 border border-slate-155 rounded-lg text-slate-700 font-semibold leading-relaxed">
                      {ticketDetails?.ticket?.summary}
                    </div>
                  </div>

                  {/* Escalation info */}
                  {ticketDetails?.escalation && (
                    <div className="p-4 border border-rose-200 bg-rose-50/50 rounded-lg space-y-2">
                      <div className="flex items-center gap-1 text-rose-700 font-bold text-[10px] uppercase tracking-wider">
                        <ShieldAlert size={12} />
                        <span>Escalated Handoff Active</span>
                      </div>
                      <div className="text-[11px] text-slate-600 space-y-1">
                        <div>
                          <span className="font-bold text-slate-700">Reason:</span>{' '}
                          {ticketDetails.escalation.reason}
                        </div>
                        <div>
                          <span className="font-bold text-slate-700">Recommended Team:</span>{' '}
                          <span className="px-2 py-0.5 bg-rose-65 bg-rose-600/10 text-rose-700 border border-rose-200 rounded font-bold text-[9px]">
                            {ticketDetails.escalation.recommended_team}
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white rounded text-[10px] font-mono text-slate-700 border border-slate-150 leading-normal">
                        <span className="font-bold text-slate-400 block text-[8px] uppercase tracking-wider mb-1">Handoff Notes:</span>
                        {ticketDetails.escalation.handoff_notes}
                      </div>
                    </div>
                  )}

                  {/* Conversation History */}
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider mb-2">
                      Automation Conversation Dialog
                    </span>
                    {ticketDetails?.conversation?.length === 0 ? (
                      <span className="text-[10px] text-slate-400 text-center block py-4 bg-slate-50/50 rounded-lg font-semibold">
                        No automation dialog context registered.
                      </span>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {ticketDetails?.conversation?.map((msg: any) => (
                          <div
                            key={msg.id}
                            className={`p-2.5 rounded-lg border text-[11px] ${
                              msg.speaker === 'user'
                                ? 'bg-blue-50/30 border-blue-100 ml-6'
                                : 'bg-slate-50 border-slate-150 mr-6'
                            }`}
                          >
                            <span className="font-bold text-slate-700 block mb-0.5 capitalize">
                              {msg.speaker === 'user' ? 'Employee Requestor' : getCleanServiceName(msg.speaker)}
                            </span>
                            <span className="text-slate-650 leading-relaxed font-semibold">
                              {msg.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedTicketId(null)}
              className="mt-6 w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition cursor-pointer"
            >
              Close Details View
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Service Terminology Translation Helper
const getCleanServiceName = (id: string) => {
  if (!id) return 'Coordinator Service';
  const clean = id.toLowerCase();
  if (clean === 'coordinator_agent' || clean === 'coordinator') return 'Coordinator Service';
  if (clean === 'classification_agent' || clean === 'classification') return 'Classification Service';
  if (clean === 'knowledge_agent' || clean === 'knowledge') return 'Knowledge Service';
  if (clean === 'troubleshooting_agent' || clean === 'troubleshooting') return 'Diagnostic Service';
  if (clean === 'escalation_agent' || clean === 'escalation') return 'Escalation Service';
  return id.replace('_', ' ');
};
