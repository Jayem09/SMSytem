import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import api, { checkHealthNative } from '../api/axios';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [debugError, setDebugError] = useState<string>('');

  useEffect(() => {
    const initPage = async () => {
      try {
        const isOnline = await checkHealthNative();
        if (isOnline) {
          setBackendStatus('online');
        } else {
          setBackendStatus('offline');
          setDebugError('Native bridge failed to connect');
        }
      } catch (err) {
        console.error('Initialization failed:', err);
        setBackendStatus('offline');
        setDebugError(err instanceof Error ? err.message : String(err));
      }
    };
    initPage();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      await register(name, email, password);
      showToast('Account created successfully!', 'success');
      navigate('/dashboard');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Registration failed', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen items-center justify-center px-4 bg-gray-50 flex flex-col py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-xl font-semibold text-gray-900">SMSystem</h1>
          <p className="text-sm text-gray-500 mt-1">Create a new account</p>
          <div className="mt-2 flex justify-center">
            {backendStatus === 'checking' && <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest animate-pulse">Checking connection...</span>}
            {backendStatus === 'online' && <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest flex items-center gap-1">● Backend Online</span>}
            {backendStatus === 'offline' && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-1">● Backend Offline</span>
                <span className="text-[8px] text-gray-400 font-medium">Trying: {api.defaults.baseURL}</span>
                {debugError && <span className="text-[7px] text-red-400/70 block max-w-[200px] break-all text-center">Error: {debugError}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Manager Name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="you@smsystem.com"
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
                minLength={6}
                className="w-full px-3 py-2 rounded-md border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-900 mb-1">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-md border border-gray-200 text-gray-900 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || backendStatus !== 'online'}
              className="w-full py-2 px-4 rounded-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'CREATING...' : 'CREATE ACCOUNT'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
