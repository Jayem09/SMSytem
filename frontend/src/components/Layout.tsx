import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Settings, Monitor, FileText, Upload, ChevronDown, LogOut, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/axios';
import GlobalSearch from './GlobalSearch';
import { getIsOfflineMode } from '../context/AuthContext';
import { getBranchDisplayName } from '../utils/branchDisplay';

const allNavItems = [
  { to: '/dashboard', label: 'Dashboard', roles: ['super_admin', 'admin', 'cashier', 'purchasing', 'purchaser'] },
  { to: '/analytics', label: 'AI Analytics', roles: ['super_admin', 'admin', 'cashier', 'purchasing', 'purchaser'] },
  { to: '/pos', label: 'POS Checkout', roles: ['admin', 'cashier'] },
  { to: '/orders', label: 'Orders', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/transfers', label: 'Branch Transfers', roles: ['super_admin', 'admin', 'cashier', 'user', 'purchasing', 'purchaser'] },
  { to: '/inventory', label: 'Inventory Management', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/products', label: 'Products', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/categories', label: 'Categories', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/brands', label: 'Brands', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/purchase-orders', label: 'Purchase Orders', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/suppliers', label: 'Suppliers', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/customers', label: 'Customers', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/crm', label: 'CRM Analysis', roles: ['super_admin', 'admin'] },
  { to: '/daily-report', label: 'Daily Summary', roles: ['super_admin', 'admin'] },
  { to: '/promo-email', label: 'Promo Emails', roles: ['super_admin', 'admin'] },
  { to: '/expenses', label: 'Expenses', roles: ['super_admin', 'admin', 'purchasing', 'purchaser'] },
  { to: '/staff', label: 'Staff & Roles', roles: ['super_admin', 'admin'] },
  { to: '/branches', label: 'Branches', roles: ['super_admin'] },
];

// Offline mode: only show POS, Orders, and Customers
const offlineNavItems = [
  { to: '/pos', label: 'POS Checkout', roles: ['admin', 'cashier'] },
  { to: '/orders', label: 'Orders', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/customers', label: 'Customers', roles: ['super_admin', 'admin', 'cashier'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCounts, setPendingCounts] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const fetchCounts = async () => {
      // Skip API call if offline
      if (getIsOfflineMode()) {
        setPendingCounts(0);
        return;
      }
      try {
        const res = await api.get('/api/transfers/pending-counts');
        const data = res.data as { total_actionable?: number };
        setPendingCounts(data.total_actionable || 0);
      } catch (err) {
        console.error('Failed to fetch pending transfer counts', err);
      }
    };

    if (user) {
      fetchCounts();

      const interval = setInterval(fetchCounts, 30000);
      window.addEventListener('transfer_updated', fetchCounts);
      return () => {
        clearInterval(interval);
        window.removeEventListener('transfer_updated', fetchCounts);
      };
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };


  const currentRole = user?.role || 'guest';

  if (user?.role === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-xl">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Pending Approval</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            Your account has been successfully created. For security, a <strong>Super Admin</strong> must assign your role and branch before you can access the system.
          </p>
          <div className="space-y-3">
            <div className="p-4 bg-gray-50 rounded-xl text-sm text-gray-600 border border-gray-100 italic">
              "Please contact your Manager or Super Admin to set up your access."
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
            >
              LOGOUT & TRY LATER
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      { }
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed h-screen no-print">
        <div className="px-4 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">SMSystem</h1>
            {getIsOfflineMode() && (
              <span className="flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded text-xs">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Offline
              </span>
            )}
          </div>
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link to="/settings" className="text-gray-400 hover:text-gray-900 transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </Link>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {/* Use offline nav items if offline, otherwise show all */}
          {(getIsOfflineMode() ? offlineNavItems : allNavItems)
            .filter((item) => item.roles.includes(currentRole))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all duration-200 hover:bg-gray-100 ${isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium border-l-4 border-indigo-600'
                    : 'text-gray-600'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.to === '/transfers' && pendingCounts > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-red-200">
                    {pendingCounts}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          {/* User Profile - Clickable Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 mb-2 hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-bold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.email || user?.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {/* Monitoring Section - Only for admin/superadmin */}
                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                  <div>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b bg-gray-50">
                      System
                    </div>
                    <a href="/monitoring" className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                      <Monitor className="mr-2 h-4 w-4" /> Monitoring
                    </a>
                    <a href="/logs" className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                      <FileText className="mr-2 h-4 w-4" /> Logs
                    </a>
                    <a href="/backups" className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                      <Upload className="mr-2 h-4 w-4" /> Backup
                    </a>
                    <a href="/sync-center" className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center">
                      <RefreshCw className="mr-2 h-4 w-4" /> Sync Center
                    </a>
                    <div className="border-t border-gray-100" />
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2 text-sm text-left text-red-600 hover:bg-red-50 flex items-center"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      { }
      <main className="flex-1 ml-56 min-h-screen flex flex-col">
        <header className="h-16 bg-white border-b border-gray-100 shadow-sm flex items-center px-6 sticky top-0 z-40 no-print">
          <div className="flex-1 flex justify-center">
            <GlobalSearch />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              <p className="text-xs font-bold text-gray-900">{getBranchDisplayName(user)}</p>
            </div>
          </div>
        </header>
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
