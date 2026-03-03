import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 mb-6">The application encountered an unexpected error. Please try refreshing the page.</p>
            <div className="bg-red-50 rounded-xl p-4 mb-6">
              <p className="text-xs font-mono text-red-700 break-words">{this.state.error?.message}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors"
            >
              REFRESH PAGE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
