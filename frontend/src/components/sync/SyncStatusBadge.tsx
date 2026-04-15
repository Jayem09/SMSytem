import type { SyncStatus } from '../../services/syncQueue';

const STATUS_CLASSES: Record<SyncStatus, string> = {
  pending: 'bg-slate-100 text-slate-700',
  syncing: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  conflicted: 'bg-amber-100 text-amber-800',
  manual_review: 'bg-purple-100 text-purple-700',
  synced: 'bg-emerald-100 text-emerald-700',
};

export default function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${STATUS_CLASSES[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
