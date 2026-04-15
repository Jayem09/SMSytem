import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <img
          src="/logo.png"
          alt="SMSystem Logo"
          className="w-52 h-auto max-h-24 object-contain mx-auto mb-5"
        />

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-6 py-7">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <h1 className="text-base font-semibold text-gray-900">Checking connection</h1>
          <p className="mt-1 text-sm text-gray-500">Preparing your workspace…</p>
        </div>
      </div>
    </div>
  );
}
