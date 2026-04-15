import { useState } from 'react';
import { AlertTriangle, Clock3, RefreshCw, ShieldAlert, CheckCircle2 } from 'lucide-react';
import SyncItemCard from '../components/sync/SyncItemCard';
import ConflictResolutionModal from '../components/sync/ConflictResolutionModal';
import SyncSection from '../components/sync/SyncSection';
import {
  getRecentSyncHistory,
  getSyncQueue,
  getSyncQueueSummary,
  markQueueItemManualReview,
  resolveCustomerConflictKeepLocal,
  resolveCustomerConflictKeepServer,
  retryQueueItem,
  type SyncQueueItem,
} from '../services/syncQueue';
import { performFullSync } from '../services/syncManager';

interface SummaryCardProps {
  label: string;
  value: number | string;
  icon: typeof Clock3;
  tone: string;
}

function SummaryCard({ label, value, icon: Icon, tone }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function SyncCenter() {
  const [queue, setQueue] = useState<SyncQueueItem[]>(() => getSyncQueue());
  const [selectedConflict, setSelectedConflict] = useState<SyncQueueItem | null>(null);

  const refreshQueue = () => {
    setQueue(getSyncQueue());
  };

  const summary = getSyncQueueSummary();
  const pendingItems = queue.filter((item) => item.status === 'pending' || item.status === 'syncing');
  const failedItems = queue.filter((item) => item.status === 'failed' || item.status === 'manual_review');
  const conflictedItems = queue.filter((item) => item.status === 'conflicted');
  const historyItems = getRecentSyncHistory().slice().reverse();

  const handleRetry = (itemId: string) => {
    retryQueueItem(itemId);
    void performFullSync().then(refreshQueue);
    refreshQueue();
  };

  const handleRetryAll = () => {
    queue
      .filter((item) => item.status === 'failed')
      .forEach((item) => retryQueueItem(item.id));

    void performFullSync().then(refreshQueue);
    refreshQueue();
  };

  const handleManualReview = (itemId: string) => {
    markQueueItemManualReview(itemId, 'Marked for manual review by operator');
    refreshQueue();
  };

  const handleKeepLocal = (itemId: string) => {
    resolveCustomerConflictKeepLocal(itemId);
    setSelectedConflict(null);
    refreshQueue();
  };

  const handleKeepServer = (itemId: string) => {
    resolveCustomerConflictKeepServer(itemId);
    setSelectedConflict(null);
    refreshQueue();
  };

  return (
    <div className="mx-auto space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sync Center</h1>
          <p className="mt-1 text-gray-500">Monitor offline queue health, retry failed work, and resolve safe conflict cases.</p>
        </div>
        <button
          onClick={handleRetryAll}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <RefreshCw className="h-4 w-4" /> Retry all failed
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Pending" value={summary.pending} icon={Clock3} tone="bg-slate-100 text-slate-700" />
        <SummaryCard label="Syncing" value={summary.syncing} icon={RefreshCw} tone="bg-blue-100 text-blue-700" />
        <SummaryCard label="Failed" value={summary.failed} icon={AlertTriangle} tone="bg-red-100 text-red-700" />
        <SummaryCard label="Conflicted" value={summary.conflicted} icon={ShieldAlert} tone="bg-amber-100 text-amber-800" />
        <SummaryCard
          label="Last successful sync"
          value={summary.lastSuccessfulSync ? new Date(summary.lastSuccessfulSync).toLocaleString() : 'Never'}
          icon={CheckCircle2}
          tone="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SyncSection title="Queue" description="Pending and actively syncing items." count={pendingItems.length}>
          {pendingItems.length > 0 ? pendingItems.map((item) => (
            <SyncItemCard
              key={item.id}
              item={item}
              onRetry={handleRetry}
              onResolve={setSelectedConflict}
              onManualReview={handleManualReview}
            />
          )) : <p className="text-sm text-gray-500">No pending queue items.</p>}
        </SyncSection>

        <SyncSection title="Failures" description="Items that need a retry or manual review." count={failedItems.length}>
          {failedItems.length > 0 ? failedItems.map((item) => (
            <SyncItemCard
              key={item.id}
              item={item}
              onRetry={handleRetry}
              onResolve={setSelectedConflict}
              onManualReview={handleManualReview}
            />
          )) : <p className="text-sm text-gray-500">No failed items.</p>}
        </SyncSection>

        <SyncSection title="Conflicts" description="Safe conflicts that need human direction." count={conflictedItems.length}>
          {conflictedItems.length > 0 ? conflictedItems.map((item) => (
            <SyncItemCard
              key={item.id}
              item={item}
              onRetry={handleRetry}
              onResolve={setSelectedConflict}
              onManualReview={handleManualReview}
            />
          )) : <p className="text-sm text-gray-500">No active conflicts.</p>}
        </SyncSection>

        <SyncSection title="History" description="Recently completed sync work." count={historyItems.length}>
          {historyItems.length > 0 ? historyItems.map((item) => (
            <SyncItemCard
              key={item.id}
              item={item}
              onRetry={handleRetry}
              onResolve={setSelectedConflict}
              onManualReview={handleManualReview}
            />
          )) : <p className="text-sm text-gray-500">No completed history yet.</p>}
        </SyncSection>
      </div>

      <ConflictResolutionModal
        item={selectedConflict}
        open={selectedConflict !== null}
        onClose={() => setSelectedConflict(null)}
        onKeepLocal={handleKeepLocal}
        onKeepServer={handleKeepServer}
      />
    </div>
  );
}
