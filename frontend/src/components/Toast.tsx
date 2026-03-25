import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto
            flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border 
            animate-in slide-in-from-right-full duration-300
            ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : ''}
            ${toast.type === 'error' ? 'bg-rose-50 border-rose-100 text-rose-800' : ''}
            ${toast.type === 'info' ? 'bg-blue-50 border-blue-100 text-blue-800' : ''}
            backdrop-blur-md bg-opacity-90
          `}
        >
          <div className={`p-1.5 rounded-lg ${
            toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
            toast.type === 'error' ? 'bg-rose-100 text-rose-600' : 
            'bg-blue-100 text-blue-600'
          }`}>
            {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
            {toast.type === 'info' && <Info className="w-5 h-5" />}
          </div>
          
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-bold tracking-tight">{toast.message}</p>
          </div>

          <button 
            onClick={() => removeToast(toast.id)}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
