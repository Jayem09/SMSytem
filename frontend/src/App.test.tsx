import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';

const {
  mockWaitForConnection,
  mockCheckServerConnection,
  mockSetOfflineMode,
  mockSetUserOfflineMode,
  mockStartReconnectChecker,
} = vi.hoisted(() => ({
  mockWaitForConnection: vi.fn(),
  mockCheckServerConnection: vi.fn(),
  mockSetOfflineMode: vi.fn(),
  mockSetUserOfflineMode: vi.fn(),
  mockStartReconnectChecker: vi.fn(),
}));

vi.mock('./services/connectionCheck', () => ({
  waitForConnection: mockWaitForConnection,
  checkServerConnection: mockCheckServerConnection,
}));

vi.mock('./services/syncManager', () => ({
  setUserOfflineMode: mockSetUserOfflineMode,
  startReconnectChecker: mockStartReconnectChecker,
}));

vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  setOfflineMode: mockSetOfflineMode,
  getIsOfflineMode: () => false,
}));

vi.mock('./context/ToastContext', () => ({
  ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/Toast', () => ({
  default: () => null,
}));

vi.mock('./components/ProtectedRoute', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/Layout', () => ({
  default: () => <div>Online App</div>,
}));

vi.mock('./components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/MaintenanceGuard', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/LoadingScreen', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('./pages/Login', () => ({ default: () => <div>Login</div> }));
vi.mock('./pages/Register', () => ({ default: () => <div>Register</div> }));
vi.mock('./pages/Dashboard', () => ({ default: () => <div>Dashboard</div> }));
vi.mock('./pages/Products', () => ({ default: () => <div>Products</div> }));
vi.mock('./pages/Categories', () => ({ default: () => <div>Categories</div> }));
vi.mock('./pages/Brands', () => ({ default: () => <div>Brands</div> }));
vi.mock('./pages/Customers', () => ({ default: () => <div>Customers</div> }));
vi.mock('./pages/CRM', () => ({ default: () => <div>CRM</div> }));
vi.mock('./pages/Orders', () => ({ default: () => <div>Orders</div> }));
vi.mock('./pages/Expenses', () => ({ default: () => <div>Expenses</div> }));
vi.mock('./pages/ActivityLogs', () => ({ default: () => <div>Activity Logs</div> }));
vi.mock('./pages/POS', () => ({ default: () => <div>POS</div> }));
vi.mock('./pages/Suppliers', () => ({ default: () => <div>Suppliers</div> }));
vi.mock('./pages/PurchaseOrders', () => ({ default: () => <div>Purchase Orders</div> }));
vi.mock('./pages/Staff', () => ({ default: () => <div>Staff</div> }));
vi.mock('./pages/Inventory', () => ({ default: () => <div>Inventory</div> }));
vi.mock('./pages/Settings', () => ({ default: () => <div>Settings</div> }));
vi.mock('./pages/DailyReport', () => ({ default: () => <div>Daily Report</div> }));
vi.mock('./pages/Branches', () => ({ default: () => <div>Branches</div> }));
vi.mock('./pages/Transfers', () => ({ default: () => <div>Transfers</div> }));
vi.mock('./pages/Analytics', () => ({ default: () => <div>Analytics</div> }));
vi.mock('./pages/PromoEmail', () => ({ default: () => <div>Promo Email</div> }));
vi.mock('./pages/Monitoring', () => ({ default: () => <div>Monitoring</div> }));
vi.mock('./pages/Backups', () => ({ default: () => <div>Backups</div> }));
vi.mock('./pages/SyncCenter', () => ({ default: () => <div>Sync Center</div> }));

describe('App connection monitoring', () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/dashboard');
    document.body.innerHTML = '<div id="root"></div>';
    mockWaitForConnection.mockResolvedValue(true);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root?.unmount();
      });
      root = null;
    }
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  async function renderApp() {
    const { default: App } = await import('./App');
    const container = document.getElementById('root');

    if (!container) {
      throw new Error('Missing root container');
    }

    root = createRoot(container);

    await act(async () => {
      root?.render(<App />);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });
  }

  it('does not show the offline screen after a single failed periodic health check', async () => {
    mockCheckServerConnection.mockResolvedValueOnce(false);

    await renderApp();

    expect(document.body.textContent).toContain('Online App');
    expect(document.body.textContent).not.toContain('Server unavailable');

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('Online App');
    expect(document.body.textContent).not.toContain('Server unavailable');
  });
});
