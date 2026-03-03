import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/pos', label: 'POS Checkout' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/products', label: 'Products' },
  { to: '/categories', label: 'Categories' },
  { to: '/brands', label: 'Brands' },
  { to: '/customers', label: 'Customers' },
  { to: '/orders', label: 'Orders' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/logs', label: 'Activity Logs' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col fixed h-screen">
        <div className="px-4 py-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">SMSystem</h1>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200 px-4 py-3">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
          <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          <button
            onClick={handleLogout}
            className="mt-2 w-full px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-56 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
