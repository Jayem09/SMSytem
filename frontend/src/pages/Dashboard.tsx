import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const stats = [
    { label: 'Total Users', value: '—', icon: '👥', color: 'from-primary to-primary-dark' },
    { label: 'Products', value: '—', icon: '📦', color: 'from-accent to-cyan-700' },
    { label: 'Revenue', value: '—', icon: '💰', color: 'from-success to-emerald-700' },
    { label: 'Orders', value: '—', icon: '📋', color: 'from-warning to-amber-700' },
  ];

  return (
    <div className="min-h-screen relative z-10">
      {/* Top Navigation */}
      <nav className="glass-card rounded-none border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-text-primary">SMSystem</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-text-primary">{user?.name}</p>
              <p className="text-xs text-text-muted capitalize">{user?.role}</p>
            </div>

            {/* User Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary border border-glass-border hover:bg-glass-hover hover:text-danger transition-all duration-200 cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-bold text-text-primary">
            Welcome back, <span className="bg-gradient-to-r from-primary-light to-accent bg-clip-text text-transparent">{user?.name}</span>
          </h1>
          <p className="text-text-secondary mt-2">Here's what's happening with your system today.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="glass-card p-6 animate-fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center text-2xl shadow-lg`}>
                  {stat.icon}
                </div>
                <span className="text-text-muted text-xs font-medium uppercase tracking-wide">{stat.label}</span>
              </div>
              <div className="text-3xl font-bold text-text-primary">{stat.value}</div>
              <p className="text-text-muted text-sm mt-1">Coming in Phase 2</p>
            </div>
          ))}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* User Info */}
          <div className="glass-card p-6 animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Your Profile
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-glass-border">
                <span className="text-text-secondary text-sm">Name</span>
                <span className="text-text-primary font-medium">{user?.name}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-glass-border">
                <span className="text-text-secondary text-sm">Email</span>
                <span className="text-text-primary font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-glass-border">
                <span className="text-text-secondary text-sm">Role</span>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-light capitalize">
                  {user?.role}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-text-secondary text-sm">Joined</span>
                <span className="text-text-primary font-medium">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="glass-card p-6 animate-fade-in-up" style={{ animationDelay: '500ms' }}>
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              System Status
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/10">
                <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Backend API</p>
                  <p className="text-xs text-text-muted">Go + Gin running on port 8080</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/10">
                <div className="w-3 h-3 rounded-full bg-success animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Database</p>
                  <p className="text-xs text-text-muted">MySQL 8.0 via Docker</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/10">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Core Modules</p>
                  <p className="text-xs text-text-muted">Phase 2 — Coming soon</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-text-muted/5 border border-text-muted/10">
                <div className="w-3 h-3 rounded-full bg-text-muted" />
                <div>
                  <p className="text-sm font-medium text-text-primary">Desktop App</p>
                  <p className="text-xs text-text-muted">Phase 4 — Tauri packaging</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
