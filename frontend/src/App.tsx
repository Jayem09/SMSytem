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
import Monitoring from './pages/Monitoring';
import Backups from './pages/Backups';
import MaintenanceGuard from './components/MaintenanceGuard';
import { checkHealthNative } from './api/axios';
import { useState, useEffect } from 'react';
function App() {
  // Startup health check to auto-retry until backend is online
  const [booting, setBooting] = useState(true);
  const [backendOnline, setBackendOnline] = useState(false);
  useEffect(() => {
    let retryInterval: ReturnType<typeof setInterval>;
    const bootstrap = async () => {
      try {
        const ok = await checkHealthNative();
        if (ok) {
          setBackendOnline(true);
          setBooting(false);
        } else {
          // Retry every 5 seconds until success
          retryInterval = setInterval(async () => {
            const ok2 = await checkHealthNative();
            if (ok2) {
              clearInterval(retryInterval);
              setBackendOnline(true);
              setBooting(false);
            }
          }, 5000);
        }
      } catch {
        // Startup health check failed
      }
    };
    bootstrap();
    return () => {
      if (retryInterval) clearInterval(retryInterval);
    };
  }, []);

  // Inline startup overlay while booting
  if (booting || !backendOnline) {
    return (
      <div style={{
        position: 'fixed', left: 0, top: 0, right: 0, bottom: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', zIndex: 9999
      }}>
        <div style={{ textAlign: 'center' }}>
           <div className="mb-4" style={{ display: 'inline-flex', width: 40, height: 40,
               borderRadius: '50%', border: '4px solid rgba(255,255,255,.3)', borderTopColor: 'white', animation: 'spin 1s linear infinite'}} />
        </div>
      </div>
    );
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
              {}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {}
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                {}
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/orders" element={<Orders />} />

                {}
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
