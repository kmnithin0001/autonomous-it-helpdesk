import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import {
  fetchTickets,
  fetchAgents,
  fetchA2ALogs,
  useWebSocket
} from '../api';
import {
  Layers,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Cpu,
  PlusCircle,
  FileText,
  Search,
  BookOpen,
  TrendingUp,
  Award
} from 'lucide-react';

export default function Dashboard() {
  // Queries
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 5000,
  });

  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 5000,
  });

  const { data: initialLogs = [] } = useQuery({
    queryKey: ['a2aLogs'],
    queryFn: fetchA2ALogs,
  });

  // Calculate ticket counts
  const openTickets = tickets.filter((t: any) => t.status === 'open').length;
  const resolvedTickets = tickets.filter((t: any) => t.status === 'resolved').length;
  const escalatedTickets = tickets.filter((t: any) => t.status === 'escalated').length;

  // Real-time activity updates from WebSocket + Initial Logs
  const [activities, setActivities] = useState<any[]>([]);

  useEffect(() => {
    if (initialLogs.length > 0) {
      // Map initial logs to dashboard activity format
      const mappedLogs = initialLogs.slice(0, 10).map((log: any) => {
        let type = 'Ticket Updated';
        if (log.task.includes('classify') || log.sender === 'coordinator_agent') {
          type = 'Ticket Created';
        } else if (log.task.includes('escalat')) {
          type = 'Escalation Triggered';
        } else if (log.task.includes('knowledge') || log.sender === 'knowledge_agent') {
          type = 'Knowledge Search';
        }
        return {
          event: type,
          timestamp: log.timestamp,
          summary: log.task,
          ticket_id: log.ticket_id,
          user_id: log.payload?.user_id || 'System'
        };
      });
      setActivities(mappedLogs);
    }
  }, [initialLogs]);

  // Hook into WS for real-time appends
  useWebSocket((event) => {
    let type = 'Ticket Updated';
    if (event.event === 'ticket_created') {
      type = 'Ticket Created';
    } else if (event.event === 'escalation_triggered') {
      type = 'Escalation Triggered';
    } else if (event.event === 'agent_started' && event.agent === 'knowledge_agent') {
      type = 'Knowledge Search';
    } else if (event.event === 'knowledge_search') {
      type = 'Knowledge Search';
    }

    const newActivity = {
      event: type,
      timestamp: event.timestamp || new Date().toISOString(),
      summary: event.summary || event.task || 'Activity registered',
      ticket_id: event.ticket_id,
      user_id: event.user_id || 'System'
    };

    setActivities((prev) => [newActivity, ...prev].slice(0, 10));
  });

  // Knowledge Searches count: calculated based on knowledge search activities + static base
  const knowledgeSearchesCount = 28 + activities.filter(a => a.event === 'Knowledge Search').length;

  // Priority mapping based on Ticket ID or Category (Since DB schema does not store priority)
  const getTicketPriority = (ticketId: number, category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('vpn') || cat.includes('network') || cat.includes('access')) {
      return ticketId % 2 === 0 ? 'Urgent' : 'High';
    }
    if (cat.includes('hardware') || cat.includes('printer')) {
      return 'Medium';
    }
    return 'Low';
  };

  // Service Terminology Translation Helper
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

  const getServiceStatus = (serviceId: string) => {
    const service = agents.find((a: any) => a.name === serviceId);
    if (!service || service.status === 'Offline') {
      return { label: 'Offline', color: 'bg-red-50 text-red-700 border-red-200' };
    }
    // Check if active in current activities
    const isActive = activities.length > 0 && 
      (activities[0].summary && activities[0].summary.toLowerCase().includes(serviceId.split('_')[0]));
    if (isActive) {
      return { label: 'Busy', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'Online', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-800">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Autonomous IT Helpdesk System
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational dashboard tracking current user support tickets, knowledge searches, and automation activity.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NavLink
            to="/support"
            className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg shadow-sm hover:shadow transition-all shrink-0"
          >
            <PlusCircle size={14} />
            <span>Create Support Request</span>
          </NavLink>
        </div>
      </div>

      {/* Section 1: Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Open Tickets', value: openTickets, icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100', trend: '-8% vs yesterday' },
          { label: 'Resolved Today', value: resolvedTickets, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', trend: '94% SLA compliance' },
          { label: 'Pending Escalations', value: escalatedTickets, icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-100', trend: 'L2 Handover active' },
          { label: 'Knowledge Searches', value: knowledgeSearchesCount, icon: Search, color: 'text-blue-600 bg-blue-50 border-blue-100', trend: 'Popular guides active' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {stat.label}
                </span>
                <span className="text-2xl font-bold text-slate-900 block">
                  {ticketsLoading ? '...' : stat.value}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold block">{stat.trend}</span>
              </div>
              <div className={`p-2 rounded-lg border shrink-0 ${stat.color}`}>
                <Icon size={18} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 2: Recent Tickets Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-150 flex justify-between items-center">
          <h2 className="font-bold text-sm text-slate-905 flex items-center gap-2">
            <Layers size={16} className="text-blue-600" />
            Recent Service Desk Tickets
          </h2>
          <NavLink to="/tickets" className="text-xs text-blue-600 hover:text-blue-500 font-semibold flex items-center gap-0.5">
            <span>View All Tickets</span>
            <ArrowUpRight size={14} />
          </NavLink>
        </div>
        <div className="overflow-x-auto">
          {ticketsLoading ? (
            <div className="p-5 space-y-3 animate-pulse">
              <div className="h-10 bg-slate-100 rounded" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-semibold">No tickets registered yet.</div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider font-bold bg-slate-50/50">
                  <th className="px-5 py-3">Ticket ID</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Summary</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.slice(0, 5).map((t: any) => {
                  const priorityVal = getTicketPriority(t.ticket_id, t.category);
                  return (
                    <tr key={t.ticket_id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 font-bold text-slate-900 font-mono">TCK-{t.ticket_id}</td>
                      <td className="px-5 py-3 font-semibold text-slate-700">{t.category}</td>
                      <td className="px-5 py-3 text-slate-655 font-semibold max-w-xs truncate">{t.summary}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] border ${
                          t.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                            : t.status === 'escalated'
                            ? 'bg-rose-50 text-rose-700 border-rose-150'
                            : 'bg-amber-50 text-amber-700 border-amber-150'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                          priorityVal === 'Urgent'
                            ? 'bg-red-50 text-red-700 border border-red-150'
                            : priorityVal === 'High'
                            ? 'bg-orange-50 text-orange-700 border border-orange-150'
                            : priorityVal === 'Medium'
                            ? 'bg-blue-50 text-blue-700 border border-blue-150'
                            : 'bg-slate-50 text-slate-700 border border-slate-150'
                        }`}>
                          {priorityVal}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-400 font-semibold">{t.created_at.split('T')[0]}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Grid: Recent Activity & Knowledge Highlights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Section 3: Recent Activity Timeline */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col">
          <div className="px-5 py-4 border-b border-slate-150 flex justify-between items-center">
            <h2 className="font-bold text-sm text-slate-905 flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              Recent Service Activity
            </h2>
            <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 border border-blue-150 rounded-full">
              Live Monitor Active
            </span>
          </div>
          <div className="p-5 flex-1 max-h-[300px] overflow-y-auto space-y-3.5">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-xs">
                <span>No support activity registered. Submit a ticket to initialize tracking.</span>
              </div>
            ) : (
              <div className="relative border-l border-slate-150 pl-4 ml-2 space-y-3.5">
                {activities.slice(0, 5).map((act, index) => {
                  return (
                    <div key={index} className="relative text-xs">
                      {/* Left dot */}
                      <span className={`absolute -left-6 top-0.5 w-3 h-3 rounded-full border border-white shrink-0 ${
                        act.event === 'Ticket Created'
                          ? 'bg-blue-500'
                          : act.event === 'Escalation Triggered'
                          ? 'bg-rose-500'
                          : act.event === 'Knowledge Search'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`} />
                      
                      <div className="flex flex-col gap-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-bold text-slate-800">
                            {act.event} {act.ticket_id && <span className="font-mono text-blue-600">#TCK-{act.ticket_id}</span>}
                          </span>
                          <span className="text-slate-400 font-semibold">
                            {new Date(act.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold italic">
                          "{act.summary}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Section 4: Knowledge Highlights */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="px-5 py-4 border-b border-slate-150 flex items-center gap-2">
            <BookOpen size={16} className="text-blue-600" />
            <h2 className="font-bold text-sm text-slate-905">Knowledge Highlights</h2>
          </div>
          <div className="p-4 flex-1 space-y-3 text-xs leading-normal">
            <div>
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                Popular Articles
              </span>
              <ul className="space-y-1 text-slate-600 font-medium">
                <li className="flex items-center gap-1.5 truncate">
                  <FileText size={12} className="text-slate-400" />
                  <span>How to configure corporate VPN on macOS/Windows</span>
                </li>
                <li className="flex items-center gap-1.5 truncate">
                  <FileText size={12} className="text-slate-400" />
                  <span>Self-service employee password reset portal guide</span>
                </li>
              </ul>
            </div>

            <hr className="border-slate-100" />

            <div>
              <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">
                Most Viewed Guides
              </span>
              <ul className="space-y-1 text-slate-600 font-medium">
                <li className="flex items-center gap-1.5 truncate">
                  <Award size={12} className="text-slate-400" />
                  <span>Troubleshooting office printer connectivity status</span>
                </li>
                <li className="flex items-center gap-1.5 truncate">
                  <Award size={12} className="text-slate-400" />
                  <span>Configuring MFA authentication tokens</span>
                </li>
              </ul>
            </div>

            <hr className="border-slate-100" />

            <div>
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider block mb-1">
                Trending Topics
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {['MFA Reset', 'VPN Access', 'Printer Drivers', 'Email Config'].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-bold text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Section 5: Automation Services Summary */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="px-5 py-4 border-b border-slate-150 flex items-center gap-2">
          <Cpu size={16} className="text-blue-600" />
          <h2 className="font-bold text-sm text-slate-905">Automation Services Status</h2>
        </div>
        <div className="p-4">
          {agentsLoading ? (
            <div className="h-12 bg-slate-50 animate-pulse rounded" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { id: 'classification_agent', desc: 'Predicts category and route logs' },
                { id: 'troubleshooting_agent', desc: 'Executes scripts diagnostic tests' },
                { id: 'knowledge_agent', desc: 'Performs semantic database queries' },
                { id: 'escalation_agent', desc: 'Prepares Level-2 handoff summaries' }
              ].map((svc) => {
                const status = getServiceStatus(svc.id);
                return (
                  <div key={svc.id} className="p-3 bg-slate-50/50 border border-slate-200 rounded-lg flex flex-col justify-between gap-1 shadow-3xs">
                    <div>
                      <span className="font-bold text-xs text-slate-800 block">
                        {getCleanServiceName(svc.id)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold block leading-tight mt-0.5">
                        {svc.desc}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-150">
                      <span className="text-[8px] text-slate-450 uppercase font-bold tracking-wider">Status</span>
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}