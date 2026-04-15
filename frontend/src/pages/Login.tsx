import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restoredFromOffline, setRestoredFromOffline] = useState(false);
  // Check localStorage directly since global flag might not be set yet on first render
  const isOffline = localStorage.getItem('token') === 'offline_token';
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const flag = localStorage.getItem('restored_from_offline');
    if (flag === 'true') {
      setRestoredFromOffline(true);
      localStorage.removeItem('restored_from_offline');
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // In offline mode, use 'offline_mode' as the password trigger
      const actualPassword = isOffline ? 'offline_mode' : password;
      await login(email, actualPassword);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      showToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SMSystem Logo" className="w-64 h-auto max-h-32 object-contain mx-auto mb-4 drop-shadow-md scale-110" />
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>

        </div>

        {restoredFromOffline && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-sm text-green-700 font-medium">
              Connection restored! Please log in to sync your offline transactions.
            </p>
          </div>
        )}

        {isOffline && !restoredFromOffline && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
            <p className="text-sm text-amber-700 font-medium">
              You are in offline mode. Enter your email — password is not required.
            </p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-6">

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                placeholder="you@example.com"
              />
            </div>

            {!isOffline && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-md border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  placeholder="Enter password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : isOffline ? 'Enter Offline Mode' : 'Sign In'}
            </button>
          </form>

          {!isOffline && (
            <p className="mt-4 text-center text-sm text-gray-500">
              No account?{' '}
              <Link to="/register" className="text-indigo-600 font-medium hover:underline">Register</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
