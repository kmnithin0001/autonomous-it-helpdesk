import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  sendChatMessage,
  fetchMemory,
  useWebSocket
} from '../api';
import {
  Send,
  Bot,
  User,
  Terminal,
  Cpu,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  HelpCircle,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  traceId?: string;
  ticketId?: string;
  a2aLogs?: any[];
  confidenceScore?: number;
}

export default function AIChatbot() {
  const [query, setQuery] = useState('');
  const [sessionId] = useState(() => 'SES-' + Math.random().toString(36).substr(2, 9).toUpperCase());
  const [userId] = useState('U101');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am your AI Support Assistant. I can help classify your requests, run automated network and system diagnostics, search the knowledge base, and escalate tickets to Level-2 technicians if needed. What issue are you experiencing today?",
      timestamp: new Date()
    }
  ]);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const [showTechnicalDiagnostics, setShowTechnicalDiagnostics] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Suggested Questions
  const suggestedQuestions = [
    "I cannot connect to the corporate VPN",
    "How do I request a password reset?",
    "My office printer is showing offline",
    "I need a Microsoft Office license"
  ];

  // Previous conversations mock list
  const previousConversations = [
    { id: '1', title: 'VPN Login Error', date: 'Today' },
    { id: '2', title: 'Printer offline check', date: 'Yesterday' },
    { id: '3', title: 'MFA Token Setup', date: '3 days ago' },
    { id: '4', title: 'Software license inquiry', date: '1 week ago' },
  ];

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hook into WebSocket to capture agent starts, stops, and technical activities
  useWebSocket((event) => {
    if (event.event === 'agent_started' && event.agent) {
      setActiveAgents((prev) => [...new Set([...prev, event.agent])]);
    } else if (event.event === 'agent_completed' && event.agent) {
      setActiveAgents((prev) => prev.filter((a) => a !== event.agent));
    }
  });

  // Query memory context for the session
  const { refetch: refetchMemory } = useQuery({
    queryKey: ['sessionMemory', sessionId],
    queryFn: () => fetchMemory(sessionId),
    enabled: !!sessionId,
  });


  // Chat request mutation
  const chatMutation = useMutation({
    mutationFn: (data: { query: string; sessionId: string; userId: string }) =>
      sendChatMessage(data.query, data.sessionId, data.userId),
    onMutate: (variables) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'user',
          text: variables.query,
          timestamp: new Date()
        }
      ]);
    },
    onSuccess: (res) => {
      let confidenceScore = undefined;
      try {
        if (res.session_state?.classification?.confidence) {
          confidenceScore = res.session_state.classification.confidence;
        } else if (res.session_state?.classification_confidence) {
          confidenceScore = res.session_state.classification_confidence;
        }
      } catch (e) {}

      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: res.query_response || "I have processed your query but no response text was returned.",
          timestamp: new Date(),
          traceId: res.trace_id,
          ticketId: res.ticket_id,
          a2aLogs: res.a2a_logs || [],
          confidenceScore: confidenceScore
        }
      ]);
      refetchMemory();
    },
    onError: (err) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'bot',
          text: `An error occurred while routing your query: ${err.message}`,
          timestamp: new Date()
        }
      ]);
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || chatMutation.isPending) return;
    const q = query;
    setQuery('');
    chatMutation.mutate({ query: q, sessionId, userId });
  };

  const handleSuggestedClick = (qText: string) => {
    if (chatMutation.isPending) return;
    chatMutation.mutate({ query: qText, sessionId, userId });
  };

  // Helper to color confidence scores
  const getConfidenceStyle = (score: number) => {
    if (score >= 0.8) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (score >= 0.5) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-8.5rem)] flex border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white text-slate-800">
      
      {/* Left Panel: Conversations & Suggested Questions */}
      <div className="hidden md:flex flex-col w-60 bg-slate-50 border-r border-slate-200 p-4 justify-between shrink-0">
        
        {/* Top: Previous Conversations */}
        <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MessageSquare size={13} />
              Previous Chats
            </h3>
            <div className="space-y-1">
              {previousConversations.map((chat) => (
                <button
                  key={chat.id}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 rounded-lg transition truncate block"
                >
                  {chat.title}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-slate-200" />

          {/* Suggested Questions in Left Sidebar */}
          <div>
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <HelpCircle size={13} />
              Quick Questions
            </h3>
            <div className="space-y-1.5">
              {suggestedQuestions.map((qText) => (
                <button
                  key={qText}
                  onClick={() => handleSuggestedClick(qText)}
                  className="w-full text-left p-2 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg text-[10px] font-semibold text-slate-600 hover:text-blue-700 transition leading-snug shadow-3xs cursor-pointer"
                >
                  {qText}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom: Context diagnostic status */}
        <div className="pt-3 border-t border-slate-200 shrink-0">
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Session Context</div>
          <div className="font-mono text-[9px] text-slate-500 bg-slate-200/50 p-2 rounded border border-slate-200 truncate">
            {sessionId}
          </div>
        </div>

      </div>

      {/* Main Panel: Chat Interface */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Chat Header */}
        <div className="h-12 border-b border-slate-200 px-5 flex items-center justify-between shrink-0 bg-slate-50/20">
          <div className="flex items-center gap-2">
            <Bot size={16} className="text-blue-600" />
            <span className="font-bold text-xs text-slate-800">AI Support Assistant</span>
          </div>
          
          <button
            onClick={() => setShowTechnicalDiagnostics(!showTechnicalDiagnostics)}
            className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md border border-slate-250 transition cursor-pointer"
          >
            <Terminal size={12} />
            <span>{showTechnicalDiagnostics ? 'Hide Agent Traces' : 'Show Agent Traces'}</span>
          </button>
        </div>

        {/* Technical Active Agent registry (Visible if trace toggle is true) */}
        {showTechnicalDiagnostics && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-[9px] shrink-0 font-mono text-slate-500">
            <span className="font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={12} className="text-blue-600" />
              ADK Services Status
            </span>
            <div className="flex gap-1.5 font-bold">
              {['coordinator_agent', 'classification_agent', 'troubleshooting_agent', 'knowledge_agent', 'escalation_agent'].map((agent) => {
                const isActive = activeAgents.includes(agent) || (chatMutation.isPending && agent === 'coordinator_agent');
                return (
                  <span
                    key={agent}
                    className={`px-1.5 py-0.5 border rounded ${
                      isActive ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                  >
                    {agent.replace('_agent', '')}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat Messages and Help Blocks Viewport */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/20">
          
          {/* Main Messages list */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              <div
                className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center font-bold text-[10px] border shadow-xs ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 border-blue-700 text-white'
                    : 'bg-white border-slate-200 text-blue-600'
                }`}
              >
                {msg.sender === 'user' ? <User size={12} /> : <Bot size={12} />}
              </div>

              <div className="space-y-1.5 flex-1">
                <div
                  className={`p-3.5 rounded-xl text-xs leading-relaxed font-medium ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-2xs'
                      : 'bg-white border border-slate-150 text-slate-700 rounded-tl-none shadow-3xs'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Technical details trace panel - collapsed by default inside message */}
                {(msg.traceId || msg.ticketId || msg.confidenceScore !== undefined || (msg.a2aLogs && msg.a2aLogs.length > 0)) && (
                  <div className="p-3 bg-white border border-slate-150 rounded-lg space-y-2 text-[10px] shadow-3xs">
                    <div className="flex flex-wrap items-center gap-3 text-slate-400 font-semibold">
                      {msg.traceId && (
                        <span>
                          Trace ID: <span className="font-mono text-slate-600">{msg.traceId}</span>
                        </span>
                      )}
                      {msg.ticketId && (
                        <span className="text-blue-600 font-bold">
                          Ticket Assigned: TCK-{msg.ticketId}
                        </span>
                      )}
                      {msg.confidenceScore !== undefined && (
                        <span className={`px-2 py-0.5 border rounded font-bold ${getConfidenceStyle(msg.confidenceScore)}`}>
                          Confidence: {(msg.confidenceScore * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>

                    {/* Agent traces - collapsed by default */}
                    {msg.a2aLogs && msg.a2aLogs.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-100">
                        <button
                          onClick={() => setExpandedTraceId(expandedTraceId === msg.traceId ? null : (msg.traceId || null))}
                          className="flex items-center gap-1 font-bold text-blue-600 hover:text-blue-500 cursor-pointer"
                        >
                          {expandedTraceId === msg.traceId ? (
                            <>
                              <ChevronUp size={12} /> Hide Automated Diagnostic Sequence
                            </>
                          ) : (
                            <>
                              <ChevronDown size={12} /> View Automated Diagnostic Sequence ({msg.a2aLogs.length} steps)
                            </>
                          )}
                        </button>

                        {expandedTraceId === msg.traceId && (
                          <div className="mt-2 pl-3 border-l border-slate-200 space-y-2 font-mono text-[9px] text-slate-500">
                            {msg.a2aLogs.map((log: any, idx: number) => (
                              <div key={idx} className="p-2 bg-slate-50 border border-slate-150 rounded-lg space-y-1">
                                <div className="font-bold text-blue-600 flex justify-between">
                                  <span>{log.sender.replace('_agent', ' Service').replace('_', ' ')} {'→'} {log.receiver.replace('_agent', ' Service').replace('_', ' ')}</span>
                                  <span className="text-[8px] text-slate-400 font-semibold">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <div className="text-slate-700 font-medium">Action: {log.task}</div>
                                {log.payload && (
                                  <pre className="text-[8px] bg-white border border-slate-100 p-1.5 rounded text-slate-450 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(log.payload, null, 2)}
                                  </pre>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Welcome Dashboard block: shown if only 1 message (the welcome message) exists */}
          {messages.length === 1 && (
            <div className="max-w-xl mx-auto pt-6 space-y-6">
              
              {/* Suggested Actions */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2 text-center">
                  Suggested Actions
                </span>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { title: "Unlock Account", query: "My account is locked and I cannot sign in" },
                    { title: "Configure VPN", query: "How do I configure the corporate VPN connection?" },
                    { title: "Printer Troubleshooting", query: "My office printer shows status offline" },
                    { title: "Request License", query: "How do I request a license for Microsoft Office?" }
                  ].map((act) => (
                    <button
                      key={act.title}
                      onClick={() => handleSuggestedClick(act.query)}
                      className="p-3 bg-white hover:bg-blue-50/30 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition shadow-3xs cursor-pointer"
                    >
                      <span className="font-bold text-xs text-slate-800 block">{act.title}</span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block line-clamp-1">{act.query}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Related Articles & Resolution Steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3">
                {/* Related Articles */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Popular Guides
                  </span>
                  <ul className="space-y-2 text-[11px] font-medium text-slate-600">
                    <li className="flex items-start gap-1.5">
                      <FileText size={12} className="text-slate-400 mt-0.5 shrink-0" />
                      <span className="hover:text-blue-600 transition cursor-pointer">VPN connectivity diagnostics guide</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <FileText size={12} className="text-slate-400 mt-0.5 shrink-0" />
                      <span className="hover:text-blue-600 transition cursor-pointer">Self-service password portals</span>
                    </li>
                  </ul>
                </div>

                {/* Resolution Steps */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-3xs space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Automation Sequence
                  </span>
                  <div className="space-y-2 text-[11px] font-medium text-slate-600">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[8px] shrink-0">1</span>
                      <span>Category classification scoring</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[8px] shrink-0">2</span>
                      <span>FastMCP diagnostic health checks</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {chatMutation.isPending && (
            <div className="flex gap-3 max-w-[85%] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-white border border-slate-200 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                <Bot size={12} />
              </div>
              <div className="bg-white border border-slate-150 p-3.5 rounded-xl rounded-tl-none flex items-center gap-1 shadow-3xs">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200">
          <form onSubmit={handleSend} className="flex gap-2 max-w-3xl mx-auto">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask support assistant... (e.g. 'How do I reset my VPN passcode?')"
              className="flex-1 px-3.5 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
              disabled={chatMutation.isPending}
            />
            <button
              type="submit"
              disabled={chatMutation.isPending || !query.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg transition shrink-0 cursor-pointer shadow-sm"
            >
              <Send size={14} />
            </button>
          </form>
          <div className="text-[9px] text-slate-400 text-center mt-1.5 font-semibold flex items-center justify-center gap-1.5 uppercase tracking-wider">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span>Secure Local Diagnostic Sandbox Active</span>
          </div>
        </div>

      </div>
    </div>
  );
}
