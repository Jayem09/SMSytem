import { queryClient } from '../lib/queryClient';
import { invalidateDashboardQueries } from './dashboardRefresh';
import { checkServerConnection } from './connectionCheck';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';

// Event types broadcast by the backend SSE broadcaster
export type DashboardEventType =
  | 'order_created'
  | 'order_completed'
  | 'order_deleted'
  | 'stock_adjusted'
  | 'expense_added'
  | 'transfer_updated';

export interface DashboardEvent {
  event_type: DashboardEventType;
  branch_id: number;
  payload: unknown;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'polling' | 'disconnected';

type StatusCallback = (status: ConnectionStatus) => void;

// Module-level singleton state
let eventSource: EventSource | null = null;
let currentStatus: ConnectionStatus = 'disconnected';
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pollingTimer: ReturnType<typeof setInterval> | null = null;

// Callbacks registered via onEvent
type EventCallback = (event: DashboardEvent) => void;
const eventCallbacks: Set<EventCallback> = new Set();

// Status change callbacks
const statusCallbacks: Set<StatusCallback> = new Set();

const MAX_RECONNECT_DELAY = 30000;
const POLLING_INTERVAL = 15000;

function isPackagedTauriApp(): boolean {
  if (typeof window === 'undefined' || !("__TAURI_INTERNALS__" in window)) {
    return false;
  }

  const isViteDevWindow = window.location.protocol === 'http:'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    && window.location.port === '5173';

  return !isViteDevWindow;
}

function getReconnectDelay(): number {
  return Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
}

function buildEventSourceUrl(): string {
  const token = localStorage.getItem('token');
  const userRaw = localStorage.getItem('user');
  const branchId = userRaw ? (JSON.parse(userRaw) as { branch_id?: number }).branch_id ?? 0 : 0;

  let url = `${API_BASE}/api/events?branch_id=${branchId}`;
  if (token && token !== 'offline_token') {
    url += `&token=${encodeURIComponent(token)}`;
  }
  return url;
}

function notifyStatus(status: ConnectionStatus) {
  currentStatus = status;
  statusCallbacks.forEach((cb) => cb(status));
}

function handleEvent(event: MessageEvent) {
  let parsed: DashboardEvent | null = null;
  try {
    parsed = JSON.parse(event.data) as DashboardEvent;
  } catch {
    console.warn('[eventService] Failed to parse SSE message:', event.data);
    return;
  }

  // Invalidate React Query dashboard cache so data refreshes automatically
  invalidateDashboardQueries(queryClient);

  // Notify all registered callbacks
  eventCallbacks.forEach((cb) => cb(parsed as DashboardEvent));
}

async function pollDashboardUpdates() {
  const connected = await checkServerConnection();

  if (!connected) {
    notifyStatus('disconnected');
    return;
  }

  notifyStatus('polling');
  await invalidateDashboardQueries(queryClient);
}

function startPollingFallback() {
  if (pollingTimer) {
    return;
  }

  notifyStatus('connecting');
  void pollDashboardUpdates();
  pollingTimer = setInterval(() => {
    void pollDashboardUpdates();
  }, POLLING_INTERVAL);
}

function connect() {
  if (eventSource) {
    eventSource.close();
  }

  notifyStatus('connecting');

  const url = buildEventSourceUrl();
  console.debug('[eventService] Connecting to SSE:', url.replace(/token=[^&]+/, 'token=***'));
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.debug('[eventService] SSE connected');
    reconnectAttempts = 0;
    notifyStatus('connected');
  };

  eventSource.onerror = (err) => {
    console.warn('[eventService] SSE error:', err);
    eventSource?.close();
    eventSource = null;
    notifyStatus('disconnected');

    // Exponential backoff reconnect
    const delay = getReconnectDelay();
    reconnectAttempts++;
    console.debug(`[eventService] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);

    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connect();
    }, delay);
  };

  // Listen for all dashboard event types
  const eventTypes: DashboardEventType[] = [
    'order_created',
    'order_completed',
    'order_deleted',
    'stock_adjusted',
    'expense_added',
    'transfer_updated',
  ];

  for (const type of eventTypes) {
    eventSource.addEventListener(type, handleEvent as EventListener);
  }
}

export function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  notifyStatus('disconnected');
}

/**
 * Register a callback for all dashboard SSE events.
 * Returns an unsubscribe function.
 */
export function onEvent(callback: EventCallback): () => void {
  eventCallbacks.add(callback);
  return () => eventCallbacks.delete(callback);
}

/**
 * Register a callback for connection status changes.
 * Returns an unsubscribe function.
 */
export function onStatusChange(callback: StatusCallback): () => void {
  statusCallbacks.add(callback);
  // Immediately notify of current status
  callback(currentStatus);
  return () => statusCallbacks.delete(callback);
}

/** Start the SSE connection. Idempotent — safe to call multiple times. */
export function startEventService(): void {
  if (isPackagedTauriApp()) {
    startPollingFallback();
    return;
  }

  if (eventSource) return; // already connected
  connect();
}
