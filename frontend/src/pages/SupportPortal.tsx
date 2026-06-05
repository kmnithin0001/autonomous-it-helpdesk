import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTickets,
  fetchTicketDetails,
  createTicket
} from '../api';
import {
  ClipboardList,
  AlertCircle,
  User,
  Activity,
  ArrowRight,
  Upload,
  Layers,
  HelpCircle
} from 'lucide-react';

export default function SupportPortal() {
  const queryClient = useQueryClient();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);

  // Form states
  const [userId, setUserId] = useState('U101');
  const [category, setCategory] = useState('VPN');
  const [summary, setSummary] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Queries
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets'],
    queryFn: fetchTickets,
    refetchInterval: 5000,
  });

  const { data: activeDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['ticketDetails', selectedTicketId],
    queryFn: () => fetchTicketDetails(selectedTicketId!),
    enabled: selectedTicketId !== null,
    refetchInterval: selectedTicketId !== null ? 5000 : false,
  });

  // Ticket creation mutation
  const createMutation = useMutation({
    mutationFn: (data: { userId: string; category: string; summary: string }) =>
      createTicket(data.userId, data.category, data.summary),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setSummary('');
      setScreenshot(null);
      setScreenshotPreview(null);
      setSubmitSuccess(true);
      setSelectedTicketId(res.raw_id); // Auto-select created ticket
      setTimeout(() => setSubmitSuccess(false), 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    createMutation.mutate({ userId, category, summary });
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setScreenshot(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper to calculate progress percentage
  const getProgress = (status: string) => {
    if (status === 'resolved') return 100;
    if (status === 'escalated') return 75;
    return 30; // open
  };


  return (
    <div className="space-y-6 max-w-7xl mx-auto text-slate-800">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Support Requests
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Submit helpdesk requests, manage active incidents, and track real-time resolution pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Form & History */}
        <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
          
          {/* Intake Form */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-150">
              <ClipboardList className="text-blue-600" size={18} />
              <h2 className="font-bold text-sm text-slate-900">Create Support Request</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {submitSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-xs font-semibold">
                  Request submitted successfully! Live tracking is active.
                </div>
              )}

              {/* User ID */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Requestor Employee ID
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    required
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20"
                    placeholder="e.g. U101"
                  />
                </div>
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20 font-medium"
                  >
                    <option value="VPN">VPN & Network</option>
                    <option value="Password">Access & Password</option>
                    <option value="Hardware">Hardware Issues</option>
                    <option value="Software">Software licenses</option>
                    <option value="Email">Email & Access</option>
                    <option value="Other">Other IT Issues</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20 font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Summary */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Request Summary
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/20 font-medium"
                  placeholder="Tell us what you need help with..."
                />
              </div>

              {/* File Attachment Dropzone */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  Attach Screenshot
                </label>
                <div className="border border-dashed border-slate-200 hover:border-blue-500 rounded-lg p-3.5 transition text-center cursor-pointer relative bg-slate-50/20">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleScreenshotChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-1">
                    <Upload size={16} className="text-slate-450" />
                    <span className="text-xs font-semibold text-slate-600">
                      {screenshot ? screenshot.name : 'Click to select files to upload'}
                    </span>
                    <span className="text-[9px] text-slate-400">PNG or JPG up to 5MB</span>
                  </div>
                </div>
                {screenshotPreview && (
                  <div className="mt-2.5 relative rounded-lg overflow-hidden border border-slate-200 h-28 bg-slate-50">
                    <img
                      src={screenshotPreview}
                      alt="Screenshot attachment preview"
                      className="object-contain w-full h-full"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{createMutation.isPending ? 'Logging request...' : 'Log Ticket'}</span>
                <ArrowRight size={14} />
              </button>
            </form>
          </div>

          {/* Recent Requests list */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-5">
            <h3 className="font-bold text-slate-900 mb-3 text-xs flex items-center gap-1.5 uppercase tracking-wider text-slate-400">
              <Layers size={14} />
              Recent Support Requests
            </h3>
            {ticketsLoading ? (
              <div className="space-y-2.5 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 bg-slate-100 rounded" />
                ))}
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-6">No requests submitted yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {tickets.map((t: any) => (
                  <button
                    key={t.ticket_id}
                    onClick={() => setSelectedTicketId(t.ticket_id)}
                    className={`w-full text-left p-2.5 rounded-lg border text-xs flex justify-between items-center transition ${
                      selectedTicketId === t.ticket_id
                        ? 'border-blue-600 bg-blue-50/50'
                        : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-800 font-mono block">
                        TCK-{t.ticket_id}
                      </span>
                      <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-semibold">
                        {t.summary}
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                      t.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        : t.status === 'escalated'
                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                        : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {t.status}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Ticket Status Tracker & Timeline */}
        <div className="lg:col-span-7">
          {selectedTicketId === null ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
              <HelpCircle size={40} className="text-slate-300 mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">Select Incident to Audit</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                Choose a ticket from your history list to review the live automation trace, diagnostic files, and service logs.
              </p>
            </div>
          ) : detailsLoading ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-6 h-full min-h-[400px] animate-pulse">
              <div className="h-6 bg-slate-100 rounded w-1/3" />
              <div className="h-24 bg-slate-100 rounded w-full" />
              <div className="space-y-3">
                <div className="h-4 bg-slate-100 rounded w-2/3" />
                <div className="h-4 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6 space-y-6">
              {/* Ticket Meta Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-150">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-slate-900 font-mono">
                      TCK-{activeDetails?.ticket?.ticket_id}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      activeDetails?.ticket?.status === 'resolved'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-150'
                        : activeDetails?.ticket?.status === 'escalated'
                        ? 'bg-rose-50 text-rose-700 border-rose-150'
                        : 'bg-amber-50 text-amber-700 border-amber-150'
                    }`}>
                      {activeDetails?.ticket?.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                    Category: <span className="text-slate-600">{activeDetails?.ticket?.category}</span> | Opened: {new Date(activeDetails?.ticket?.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="bg-slate-50 p-2 rounded-lg border border-slate-150 text-[10px]">
                  <span className="text-slate-400 block text-[8px] uppercase font-bold tracking-wider">Active Service</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">
                    {activeDetails?.escalation?.recommended_team
                      ? activeDetails.escalation.recommended_team
                      : 'Coordinator Service'}
                  </span>
                </div>
              </div>

              {/* Progress Slider Bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                  <span>Resolution Progress</span>
                  <span>{getProgress(activeDetails?.ticket?.status)}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      activeDetails?.ticket?.status === 'resolved'
                        ? 'bg-emerald-500'
                        : activeDetails?.ticket?.status === 'escalated'
                        ? 'bg-blue-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${getProgress(activeDetails?.ticket?.status)}%` }}
                  />
                </div>
              </div>

              {/* Summary Card */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-150">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Incident Description
                </span>
                <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                  {activeDetails?.ticket?.summary}
                </p>
              </div>

              {/* Ticket Resolution Handoff Notes if Escalated */}
              {activeDetails?.escalation && (
                <div className="p-4 border border-rose-200 bg-rose-50/50 rounded-xl space-y-2">
                  <div className="flex items-center gap-1 text-rose-700 font-bold text-[10px] uppercase tracking-wider">
                    <AlertCircle size={14} />
                    <span>L2 Operations Escalation active ({activeDetails.escalation.priority} Priority)</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    <span className="font-bold text-slate-700">Reason:</span> {activeDetails.escalation.reason}
                  </p>
                  <div className="bg-white p-3 rounded-lg text-[10px] font-mono text-slate-700 border border-slate-150 leading-normal">
                    <span className="font-bold text-slate-400 block text-[8px] uppercase tracking-wider mb-1">Diagnostics Notes:</span>
                    {activeDetails.escalation.handoff_notes}
                  </div>
                </div>
              )}

              {/* Timeline Flow */}
              <div>
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Activity size={12} className="text-blue-500" />
                  Service Operations Trail
                </h4>
                <div className="space-y-4 relative before:absolute before:left-2.5 before:top-1.5 before:bottom-1.5 before:w-px before:bg-slate-200">
                  {/* Step 1: Created */}
                  <div className="relative pl-7 flex gap-3 text-xs">
                    <div className="absolute left-1 top-0.5 w-3 h-3 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600 flex items-center justify-center font-bold text-[8px]">
                      ✓
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Incident Logged</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {new Date(activeDetails?.ticket?.created_at).toLocaleString()} | Metadata mapped in database
                      </p>
                    </div>
                  </div>

                  {/* Step 2: System Routing */}
                  <div className="relative pl-7 flex gap-3 text-xs">
                    <div className="absolute left-1 top-0.5 w-3 h-3 rounded-full bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-[8px]">
                      ✓
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">Classification and Diagnostic Routing</p>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Classification Service predicted routing queue. Diagnostic Service triggered checks.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Escalated / Assigned */}
                  {activeDetails?.ticket?.status === 'escalated' || activeDetails?.ticket?.status === 'resolved' ? (
                    <div className="relative pl-7 flex gap-3 text-xs">
                      <div className="absolute left-1 top-0.5 w-3 h-3 rounded-full bg-rose-50 border border-rose-250 text-rose-600 flex items-center justify-center font-bold text-[8px]">
                        ✓
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">Handoff to Level-2 Support ({activeDetails?.escalation?.recommended_team})</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {activeDetails?.escalation?.created_at ? new Date(activeDetails.escalation.created_at).toLocaleString() : 'Processing'} | Diagnostic logs compiled
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative pl-7 flex gap-3 text-xs">
                      <div className="absolute left-2 top-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <div>
                        <p className="font-bold text-slate-500">Awaiting Service Diagnostics</p>
                        <p className="text-[10px] text-slate-400">Coordinator Service evaluating system diagnostics...</p>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Resolution */}
                  {activeDetails?.ticket?.status === 'resolved' ? (
                    <div className="relative pl-7 flex gap-3 text-xs">
                      <div className="absolute left-1 top-0.5 w-3 h-3 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-600 flex items-center justify-center font-bold text-[8px]">
                        ✓
                      </div>
                      <div>
                        <p className="font-bold text-emerald-700">Incident Resolved</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Closed ticket resolved by Automation services or L2 technician.
                        </p>
                      </div>
                    </div>
                  ) : activeDetails?.ticket?.status === 'escalated' ? (
                    <div className="relative pl-7 flex gap-3 text-xs">
                      <div className="absolute left-2 top-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <div>
                        <p className="font-bold text-rose-700">Awaiting Technician Response</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          Assigned to Level-2 {activeDetails?.escalation?.recommended_team} queue.
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
