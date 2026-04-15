import { WifiOff } from 'lucide-react';

interface ServerOfflineScreenProps {
  onProceedOffline: () => void;
}

export default function ServerOfflineScreen({ onProceedOffline }: ServerOfflineScreenProps) {
  const handleClick = () => {
    console.log('Offline button clicked!');
    onProceedOffline();
  };
  
  return (
    <div className="fixed inset-0 z-[999999] min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <img
          src="/logo.png"
          alt="SMSystem Logo"
          className="w-52 h-auto max-h-24 object-contain mx-auto mb-5"
        />

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-6 py-7">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-7 h-7" />
          </div>

          <h1 className="text-lg font-semibold text-gray-900">Server unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            We can’t reach the server right now. You can continue in offline mode and sync everything once the connection returns.
          </p>

          <button
            onClick={handleClick}
            className="w-full mt-5 py-2.5 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors cursor-pointer"
          >
            Proceed to Offline Mode
          </button>

          <p className="mt-3 text-xs text-gray-400">
            Offline orders and customer updates will sync automatically when you’re back online.
          </p>
        </div>
      </div>
    </div>
  );
}
