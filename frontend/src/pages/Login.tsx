import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import api, { checkHealthNative } from '../api/axios';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [debugError, setDebugError] = useState<string>('');

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const isOnline = await checkHealthNative();
        if (isOnline) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
          setDebugError('Native bridge failed to connect');
        }
      } catch (err) {
        console.error('Health check failed:', err);
        setBackendStatus('offline');
        setDebugError(err instanceof Error ? err.message : String(err));
      }
    };
    checkBackend();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      showToast(axiosError.response?.data?.error || 'Login failed. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="SMSystem Logo" className="w-20 h-20 object-contain mx-auto mb-4 drop-shadow-sm" />
          <h1 className="text-2xl font-bold text-gray-900">SMSystem</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
          <div className="mt-2 flex justify-center">
            {backendStatus === 'checking' && <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest animate-pulse">Checking connection...</span>}
            {backendStatus === 'online' && <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">● Backend Online</span>}
            {backendStatus === 'offline' && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1">● Backend Offline</span>
                <span className="text-[8px] text-gray-400 font-medium">Trying: {api.defaults.baseURL}</span>
                {debugError && <span className="text-[7px] text-red-400/70 block max-w-[200px] break-all">Error: {debugError}</span>}
              </div>
            )}
          </div>
        </div>

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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            No account?{' '}
            <Link to="/register" className="text-indigo-600 font-medium hover:underline">Register</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
