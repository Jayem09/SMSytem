import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, Scan, Check, X } from 'lucide-react';

interface RFIDFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function RFIDField({ value, onChange, disabled }: RFIDFieldProps) {
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastKeyTime, setLastKeyTime] = useState(0);
  const [buffer, setBuffer] = useState('');
  const [inputValue, setInputValue] = useState('');
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
    setInputValue('');
  };

  // Handle manual input - only accept numbers, require Enter to confirm
  const handleManualInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const input = e.currentTarget.value.trim();
      if (input.length >= 8) {
        onChange(input);
        setInputValue('');
      }
    }
  };

  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, ''); // Only allow numbers
    setInputValue(val);
  };

  // Show card linked only when confirmed (Enter pressed or scanned)
  const isCardLinked = value && value.length >= 8;

  return (
    <div className="mb-4">
      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
        RFID Card ID
      </label>
      
      {isScanning ? (
        <div className="relative">
          <input
            ref={scanInputRef}
            type="text"
            autoFocus
            readOnly
            placeholder="Tap RFID card or type ID..."
            className="w-full px-4 py-3 border-2 border-indigo-500 rounded-2xl text-sm font-medium bg-white"
            onChange={(e) => handleScanInput(e.target.value)}
          />
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
          {buffer && (
            <div className="text-xs text-gray-400 mt-1 ml-1">Receiving: {buffer}</div>
          )}
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={isCardLinked ? value : inputValue}
            onChange={handleManualChange}
            onKeyDown={handleManualInput}
            placeholder="Enter card UID manually (8+ digits)"
            disabled={disabled}
            className="w-full px-4 py-3 pr-24 border border-gray-100 rounded-2xl text-sm text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900 transition-all bg-gray-50/50 hover:bg-white placeholder:text-gray-400 pl-11"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Wifi className="w-4 h-4" />
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isCardLinked && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-lg">
                <Check className="w-3 h-3" />
                Linked
              </div>
            )}
            <button
              type="button"
              onClick={isCardLinked ? () => onChange('') : startScan}
              disabled={disabled}
              className={`px-3 py-1.5 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 ${isCardLinked ? 'bg-red-500 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'}`}
            >
              {isCardLinked ? <X className="w-3 h-3" /> : <Scan className="w-3 h-3" />}
              {isCardLinked ? 'Clear' : 'Scan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
