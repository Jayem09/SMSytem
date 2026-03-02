import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-10">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent to-primary mb-4 shadow-lg shadow-accent/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Create Account</h1>
          <p className="text-text-secondary mt-2">Join SMSystem today</p>
        </div>

        {/* Register Card */}
        <div className="glass-card p-8">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm flex items-center gap-3">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-700/50 border border-glass-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
                placeholder="Johnmark Dinglasan"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-700/50 border border-glass-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-surface-700/50 border border-glass-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
                placeholder="Min. 6 characters"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-700/50 border border-glass-border text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-accent to-primary hover:from-accent-light hover:to-primary-light shadow-lg shadow-accent/25 hover:shadow-accent/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-text-secondary text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-light hover:text-primary font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
