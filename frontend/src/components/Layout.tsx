import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../api/axios';

const navItems = [
  { to: '/pos', label: 'POS Checkout', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/dashboard', label: 'Dashboard', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/customers', label: 'Customers', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/crm', label: 'CRM Analysis', roles: ['super_admin', 'admin'] },
  { to: '/inventory', label: 'Inventory Management', roles: ['super_admin', 'admin'] },
  { to: '/orders', label: 'Orders', roles: ['super_admin', 'admin', 'cashier'] },
  { to: '/products', label: 'Products', roles: ['super_admin', 'admin'] },
  { to: '/daily-report', label: 'Daily Summary', roles: ['super_admin', 'admin'] },
  { to: '/categories', label: 'Categories', roles: ['super_admin', 'admin'] },
  { to: '/brands', label: 'Brands', roles: ['super_admin', 'admin'] },
  { to: '/suppliers', label: 'Suppliers', roles: ['super_admin', 'admin'] },
  { to: '/purchase-orders', label: 'Purchase Orders', roles: ['super_admin', 'admin'] },
  { to: '/expenses', label: 'Expenses', roles: ['super_admin', 'admin'] },
  { to: '/logs', label: 'Activity Logs', roles: ['super_admin', 'admin'] },
  { to: '/staff', label: 'Staff & Roles', roles: ['super_admin', 'admin'] },
  { to: '/branches', label: 'Branches', roles: ['super_admin'] },
  { to: '/transfers', label: 'Branch Transfers', roles: ['super_admin', 'admin', 'cashier', 'user'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCounts, setPendingCounts] = useState(0);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await api.get('/api/transfers/pending-counts');
        setPendingCounts(res.data.total_actionable || 0);
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

  
  const currentRole = user?.role || 'user';

  return (
    <div className="min-h-screen flex bg-gray-50">
      {}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed h-screen no-print">
        <div className="px-4 py-4 border-b border-gray-200 flex justify-between items-center">
          <h1 className="text-lg font-semibold text-gray-900">SMSystem</h1>
          {(user?.role === 'admin' || user?.role === 'super_admin') && (
            <Link to="/settings" className="text-gray-400 hover:text-gray-900 transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </Link>
          )}
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => item.roles.includes(currentRole))
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
            {user?.branch && (
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter">
                {user.branch.name}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {}
      <main className="flex-1 ml-56 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
