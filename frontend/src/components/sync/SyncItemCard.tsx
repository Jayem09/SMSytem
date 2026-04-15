import type { SyncQueueItem } from '../../services/syncQueue';
import SyncStatusBadge from './SyncStatusBadge';

interface SyncItemCardProps {
  item: SyncQueueItem;
  onRetry: (itemId: string) => void;
  onResolve: (item: SyncQueueItem) => void;
  onManualReview: (itemId: string) => void;
}

export default function SyncItemCard({ item, onRetry, onResolve, onManualReview }: SyncItemCardProps) {
  const canRetry = item.status === 'failed';
  const canResolve = item.status === 'conflicted';
  const canMarkManualReview = item.status === 'failed' && item.entityType === 'order';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">
            {item.entityType} · {item.operation}
          </p>
          <p className="text-xs text-gray-500">Ref: {item.entityLocalId}</p>
          <p className="text-xs text-gray-500">Attempts: {item.attemptCount}</p>
          {item.lastError ? <p className="text-xs text-red-600">{item.lastError}</p> : null}
        </div>
        <SyncStatusBadge status={item.status} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canRetry ? (
          <button
            onClick={() => onRetry(item.id)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
          >
            Retry
          </button>
        ) : null}
        {canResolve ? (
          <button
            onClick={() => onResolve(item)}
            className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-400"
          >
            Resolve conflict
          </button>
        ) : null}
        {canMarkManualReview ? (
          <button
            onClick={() => onManualReview(item.id)}
            className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-500"
          >
            Mark manual review
          </button>
        ) : null}
      </div>
    </div>
  );
}
