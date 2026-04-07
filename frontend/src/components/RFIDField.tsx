import { useState, useEffect, useCallback } from 'react';
import { Wifi, Scan, Check, X } from 'lucide-react';

interface RFIDFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function RFIDField({ value, onChange, disabled }: RFIDFieldProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [buffer, setBuffer] = useState('');
  const SCAN_TIMEOUT = 50; // ms between keystrokes for RFID scanner

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isScanning || disabled) return;

    // Ignore if not a digit
    if (!/^\d$/.test(e.key) && e.key !== 'Enter') return;

    const now = Date.now();
    
    if (e.key === 'Enter') {
      if (buffer.length >= 8) {
        onChange(buffer);
        setIsScanning(false);
        setBuffer('');
      } else {
        // Invalid scan, reset
        setBuffer('');
      }
      return;
    }

    // Reset buffer if too much time passed
    if (now - lastKeyTime > SCAN_TIMEOUT && buffer.length > 0) {
      setBuffer('');
    }

    setBuffer(prev => prev + e.key);
    setLastKeyTime(now);
  }, [isScanning, buffer, lastKeyTime, onChange, disabled]);

  useEffect(() => {
    if (isScanning) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isScanning, handleKeyDown]);

  const startScan = () => {
    setIsScanning(true);
    setBuffer('');
  };

  const cancelScan = () => {
    setIsScanning(false);
    setBuffer('');
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
        RFID Card ID
      </label>
      
      {isScanning ? (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-2xl animate-pulse border-2 border-dashed border-indigo-400" />
          <div className="relative bg-gray-50 border-2 border-indigo-500 rounded-2xl p-4 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center animate-bounce">
                <Scan className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <p className="font-bold text-indigo-900">Scanning for card...</p>
                <p className="text-xs text-indigo-600">Tap RFID card on reader now</p>
              </div>
              {buffer && (
                <div className="bg-indigo-900 text-white px-4 py-1 rounded-full font-mono text-sm">
                  {buffer}
                </div>
              )}
              <button
                type="button"
                onClick={cancelScan}
                className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        </div>
      ) : value ? (
        <div className="relative">
          <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-wider">Card Linked</p>
                  <p className="font-mono font-bold text-emerald-900">{value}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                disabled={disabled}
                className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter card UID or scan"
            disabled={disabled}
            className="w-full px-4 py-3 pr-24 border border-gray-100 rounded-2xl text-sm text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900 transition-all bg-gray-50/50 hover:bg-white placeholder:text-gray-400 pl-11"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Wifi className="w-4 h-4" />
          </div>
          <button
            type="button"
            onClick={startScan}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5"
          >
            <Scan className="w-3 h-3" />
            Scan
          </button>
        </div>
      )}
    </div>
  );
}
