import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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
import Orders from './pages/Orders';
import Expenses from './pages/Expenses';
import ActivityLogs from './pages/ActivityLogs';
import POS from './pages/POS';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Staff from './pages/Staff';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected with sidebar layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            {/* Shared roles (Admin & Cashier) */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/orders" element={<Orders />} />

            {/* Admin only */}
            <Route path="/products" element={<ProtectedRoute requiredRole="admin"><Products /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute requiredRole="admin"><Categories /></ProtectedRoute>} />
            <Route path="/brands" element={<ProtectedRoute requiredRole="admin"><Brands /></ProtectedRoute>} />
            <Route path="/expenses" element={<ProtectedRoute requiredRole="admin"><Expenses /></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute requiredRole="admin"><Suppliers /></ProtectedRoute>} />
            <Route path="/purchase-orders" element={<ProtectedRoute requiredRole="admin"><PurchaseOrders /></ProtectedRoute>} />
            <Route path="/logs" element={<ProtectedRoute requiredRole="admin"><ActivityLogs /></ProtectedRoute>} />
            <Route path="/staff" element={<ProtectedRoute requiredRole="admin"><Staff /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
