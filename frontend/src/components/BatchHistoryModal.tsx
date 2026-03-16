import { useState, useEffect } from 'react';
import Modal from './Modal';
import api from '../api/axios';
import { Clock, ArrowUpRight, ArrowDownLeft, RefreshCcw, Truck } from 'lucide-react';

interface Movement {
  id: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  reference: string;
  created_at: string;
  warehouse?: { name: string };
  user?: { name: string };
}

interface BatchHistoryModalProps {
  open: boolean;
  onClose: () => void;
  batchId: number;
  batchNumber: string;
  productName: string;
}

export default function BatchHistoryModal({ open, onClose, batchId, batchNumber, productName }: BatchHistoryModalProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && batchId) {
      const fetchHistory = async () => {
        setLoading(true);
        try {
          const res = await api.get(`/api/inventory/batches/${batchId}/history`);
          setMovements(res.data.movements || []);
        } catch (err) {
          console.error('Failed to fetch batch history', err);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [open, batchId]);

  const getMovementIcon = (type: string) => {
    switch (type) {
      case 'IN': return <ArrowDownLeft className="w-4 h-4 text-green-500" />;
      case 'OUT': return <ArrowUpRight className="w-4 h-4 text-red-500" />;
      case 'ADJUSTMENT': return <RefreshCcw className="w-4 h-4 text-amber-500" />;
      case 'TRANSFER': return <Truck className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Batch Movement Audit">
      <div className="mb-6">
        <h3 className="text-xl font-black text-gray-900 tracking-tighter uppercase">{productName}</h3>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tracking Batch: {batchNumber}</p>
      </div>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {loading ? (
          <div className="py-12 text-center text-gray-400 font-bold animate-pulse text-xs uppercase tracking-widest">Decrypting Audit Logs...</div>
        ) : movements.length > 0 ? (
          movements.map((m, idx) => (
            <div key={m.id} className={`flex gap-4 items-start p-4 rounded-2xl border ${idx === 0 ? 'bg-indigo-50/50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                m.type === 'IN' ? 'bg-green-100' : 
                m.type === 'OUT' ? 'bg-red-100' : 
                m.type === 'TRANSFER' ? 'bg-blue-100' : 'bg-amber-100'
              }`}>
                {getMovementIcon(m.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <p className="text-sm font-black text-gray-900 uppercase">
                    {m.type} 
                    <span className={`ml-2 ${m.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {m.quantity > 0 ? '+' : ''}{m.quantity}
                    </span>
                  </p>
                  <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs font-bold text-gray-500 mb-2 truncate">Ref: {m.reference || 'N/A'}</p>
                <div className="flex gap-4">
                   {m.warehouse && (
                     <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">
                       WH: {m.warehouse.name}
                     </div>
                   )}
                   {m.user && (
                     <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                       BY: {m.user.name}
                     </div>
                   )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-gray-400 font-medium">No movement history found for this batch.</div>
        )}
      </div>
    </Modal>
  );
}
