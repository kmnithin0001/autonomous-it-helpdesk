import { useEffect, useState, useRef } from 'react';

// API Configurations
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000/ws/events';

// --- REST CLIENT API LAYER ---

export async function fetchTickets() {
  const res = await fetch(`${API_BASE_URL}/tickets`);
  if (!res.ok) throw new Error('Failed to fetch tickets');
  return res.json();
}

export async function fetchTicketDetails(id: number) {
  const res = await fetch(`${API_BASE_URL}/ticket/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch ticket ${id}`);
  return res.json();
}

export async function createTicket(userId: string, category: string, summary: string) {
  const res = await fetch(`${API_BASE_URL}/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, category, summary }),
  });
  if (!res.ok) throw new Error('Failed to create ticket');
  return res.json();
}

export async function sendChatMessage(query: string, sessionId: string, userId: string) {
  const res = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, session_id: sessionId, user_id: userId }),
  });
  if (!res.ok) throw new Error('Failed to send chat query');
  return res.json();
}

export async function fetchKnowledgeSearch(q: string) {
  const res = await fetch(`${API_BASE_URL}/knowledge/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Failed to perform knowledge search');
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/health`);
  if (!res.ok) throw new Error('Failed to fetch health check details');
  return res.json();
}

export async function fetchAgents() {
  const res = await fetch(`${API_BASE_URL}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents details');
  return res.json();
}

export async function fetchMemory(sessionId: string) {
  const res = await fetch(`${API_BASE_URL}/memory?session_id=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error('Failed to fetch session memory context');
  return res.json();
}

export async function fetchA2ALogs() {
  const res = await fetch(`${API_BASE_URL}/a2a/logs`);
  if (!res.ok) throw new Error('Failed to fetch agent to agent logs');
  return res.json();
}

export async function fetchSystemLogs(file: string, lines: number = 50) {
  const res = await fetch(`${API_BASE_URL}/logs?file=${encodeURIComponent(file)}&lines=${lines}`);
  if (!res.ok) throw new Error(`Failed to fetch log file ${file}`);
  return res.json();
}

// --- REAL-TIME WEBSOCKETS CLIENT HOOK ---

export interface WebSocketEvent {
  event: string;
  timestamp: string;
  [key: string]: any;
}

export function useWebSocket(onEventReceived?: (event: WebSocketEvent) => void) {
  const [status, setStatus] = useState<'CONNECTING' | 'OPEN' | 'CLOSED'>('CLOSED');
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('CONNECTING');
    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('OPEN');
      console.log('WebSocket connection established.');
    };

    ws.onmessage = (event) => {
      try {
        const parsed: WebSocketEvent = JSON.parse(event.data);
        setLastEvent(parsed);
        if (onEventReceived) {
          onEventReceived(parsed);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      setStatus('CLOSED');
      console.log('WebSocket connection closed. Reconnecting in 3s...');
      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      ws.close();
    };
  };

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        // Remove close listener to prevent loop re-triggering during cleanup
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  return { status, lastEvent };
}
