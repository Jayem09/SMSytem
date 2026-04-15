import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ToastContainer from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Brands from './pages/Brands';
import Customers from './pages/Customers';
import CRM from './pages/CRM';
import Orders from './pages/Orders';
import Expenses from './pages/Expenses';
import ActivityLogs from './pages/ActivityLogs';
import POS from './pages/POS';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Staff from './pages/Staff';
import Inventory from './pages/Inventory';
import SettingsPage from './pages/Settings';
import DailyReport from './pages/DailyReport';
import Branches from './pages/Branches';
import Transfers from './pages/Transfers';
import Analytics from './pages/Analytics';
import PromoEmail from './pages/PromoEmail';
import Monitoring from './pages/Monitoring';
import Backups from './pages/Backups';
import SyncCenter from './pages/SyncCenter';
import MaintenanceGuard from './components/MaintenanceGuard';
import { useState, useEffect } from 'react';
import LoadingScreen from './components/LoadingScreen';
import ServerOfflineScreen from './components/ServerOfflineScreen';
import { waitForConnection, checkServerConnection } from './services/connectionCheck';
import { setUserOfflineMode, startReconnectChecker } from './services/syncManager';
import { setOfflineMode } from './context/AuthContext';
import offlineStorage from './services/offlineStorage';

function App() {
  // Startup health check to auto-retry until backend is online
  const [booting, setBooting] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [offlineModeActive, setOfflineModeActive] = useState(false);

  useEffect(() => {
    let retryInterval: ReturnType<typeof setInterval>;
    const bootstrap = async () => {
      try {
        // Wait up to 5 seconds for connection
        const connected = await waitForConnection(5000);
        if (connected) {
          setConnectionStatus('online');
          setBackendOnline(true);
          setBooting(false);
        } else {
          // Show offline option after timeout
          setConnectionStatus('offline');
          setBooting(false);
        }
      } catch {
        setConnectionStatus('offline');
        setBooting(false);
      }
    };
    bootstrap();
    return () => {
      if (retryInterval) clearInterval(retryInterval);
    };
  }, []);

  // Auto-detect connection recovery while in offline mode - NO PAGE RELOAD NEEDED
  useEffect(() => {
    if (!offlineModeActive) return;

    // Check immediately on mount
    const doCheck = async () => {
      const connected = await checkServerConnection();
      console.log('[App] Offline mode - connection check:', connected);

      if (connected) {
        console.log('[App] Connection restored! Auto-transitioning to online...');

        // Clear offline mode flags
        setOfflineMode(false);
        setUserOfflineMode(false);
        setConnectionStatus('online');
        setBackendOnline(true);

        // Set flag for login page banner
        localStorage.setItem('restored_from_offline', 'true');

        console.log('[App] Auto-restored to online mode');
      }
    };

    doCheck();

    // Then check every 5 seconds
    const checkInterval = setInterval(doCheck, 5000);

    return () => clearInterval(checkInterval);
  }, [offlineModeActive]);

  // Also continuously check connection even when online - to auto-detect going offline
  useEffect(() => {
    const connectionCheckInterval = setInterval(async () => {
      // Only check if we're showing as online and not already in offline mode
      if (connectionStatus === 'online' && !offlineModeActive) {
        const connected = await checkServerConnection();
        if (!connected) {
          console.log('[App] Connection lost! Showing offline screen...');
          setConnectionStatus('offline');
          setBackendOnline(false);
        }
      }
    }, 5000);

    return () => clearInterval(connectionCheckInterval);
  }, [connectionStatus, offlineModeActive]);

  // Startup screen conditions
  if (booting) {
    return <LoadingScreen />;
  }

  // If offline and user hasn't proceeded to offline mode yet
  if (connectionStatus === 'offline' && !offlineModeActive) {
    return (
      <ServerOfflineScreen
        onProceedOffline={() => {
          console.log('[App] Proceed offline clicked, starting...');

          // Check for any existing cached data first
          const existingProducts = offlineStorage.getProducts();
          const existingCategories = offlineStorage.getCategories();
          const existingCustomers = offlineStorage.getCustomers();

          console.log('[App] Existing cache:', { products: existingProducts.length, categories: existingCategories.length, customers: existingCustomers.length });

          const hasCachedData = existingProducts.length > 0 || existingCategories.length > 0;
          console.log('[App] Has cached data:', hasCachedData);

          // Set offline mode FIRST
          setOfflineMode(true);
          setUserOfflineMode(true); // User explicitly chose offline
          console.log('[App] setOfflineMode(true) called');

          // Start reconnection checker (to auto-detect when internet is back)
          startReconnectChecker();
          setOfflineModeActive(true);
          setBackendOnline(true);

          // Auto-login as offline user with cached profile
          const cachedProfile = localStorage.getItem('cached_user_profiles');
          if (cachedProfile) {
            // Try to use the last logged in user's profile
            const profiles = JSON.parse(cachedProfile);
            const email = Object.keys(profiles)[0]; // First profile
            if (email && profiles[email]) {
              const p = profiles[email];
              const offlineUser = {
                id: 0,
                email: p.email,
                name: p.name,
                role: p.role,
                branch_id: p.branch_id,
              };
              localStorage.setItem('token', 'offline_token');
              localStorage.setItem('user', JSON.stringify(offlineUser));
              console.log('[App] Auto-logged in as offline user:', p.email);
            }
          }

          // DON'T redirect - just let the app continue rendering
          console.log('[App] Offline mode ready, continuing to app...');
        }}
      />
    );
  }

  // Normal boot - backend online OR offline mode active
  if (!backendOnline && !offlineModeActive) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <MaintenanceGuard>
                <ToastContainer />
                <Routes>
                  { }
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  { }
                  <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    { }
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/sync-center" element={<ProtectedRoute requiredRole={["admin", "super_admin"]}><SyncCenter /></ProtectedRoute>} />

                    { }
                    <Route path="/crm" element={<ProtectedRoute requiredRole="admin"><CRM /></ProtectedRoute>} />
                    <Route path="/products" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><Products /></ProtectedRoute>} />
                    <Route path="/daily-report" element={<ProtectedRoute requiredRole="admin"><DailyReport /></ProtectedRoute>} />
                    <Route path="/categories" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><Categories /></ProtectedRoute>} />
                    <Route path="/brands" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><Brands /></ProtectedRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><Inventory /></ProtectedRoute>} />
                    <Route path="/expenses" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><Expenses /></ProtectedRoute>} />
                    <Route path="/suppliers" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><Suppliers /></ProtectedRoute>} />
                    <Route path="/purchase-orders" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser"]}><PurchaseOrders /></ProtectedRoute>} />
                    <Route path="/logs" element={<ProtectedRoute requiredRole="admin"><ActivityLogs /></ProtectedRoute>} />
                    <Route path="/staff" element={<ProtectedRoute requiredRole="admin"><Staff /></ProtectedRoute>} />
                    <Route path="/branches" element={<ProtectedRoute requiredRole="admin"><Branches /></ProtectedRoute>} />
                    <Route path="/transfers" element={<ProtectedRoute requiredRole={["admin", "purchasing", "purchaser", "cashier", "user"]}><Transfers /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute requiredRole="admin"><SettingsPage /></ProtectedRoute>} />
                    <Route path="/monitoring" element={<ProtectedRoute requiredRole="admin"><Monitoring /></ProtectedRoute>} />
                    <Route path="/backups" element={<ProtectedRoute requiredRole="admin"><Backups /></ProtectedRoute>} />
                    <Route path="/promo-email" element={<ProtectedRoute requiredRole="admin"><PromoEmail /></ProtectedRoute>} />
                  </Route>

                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </MaintenanceGuard>
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
