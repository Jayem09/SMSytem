import Modal from '../Modal';
import type { SyncQueueItem } from '../../services/syncQueue';

interface ConflictResolutionModalProps {
  item: SyncQueueItem | null;
  open: boolean;
  onClose: () => void;
  onKeepLocal: (itemId: string) => void;
  onKeepServer: (itemId: string) => void;
}

export default function ConflictResolutionModal({
  item,
  open,
  onClose,
  onKeepLocal,
  onKeepServer,
}: ConflictResolutionModalProps) {
  if (!open || !item) {
    return null;
  }

  return (
    <Modal open={open} onClose={onClose} title="Resolve Customer Conflict">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose which version to keep for this customer record. Orders stay conservative and should use retry or manual review instead.
        </p>
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p><span className="font-semibold text-gray-900">Reference:</span> {item.entityLocalId}</p>
          {item.lastError ? <p className="mt-1"><span className="font-semibold text-gray-900">Reason:</span> {item.lastError}</p> : null}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onKeepLocal(item.id)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Keep Local
          </button>
          <button
            onClick={() => onKeepServer(item.id)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Keep Server
          </button>
        </div>
      </div>
    </Modal>
  );
}
