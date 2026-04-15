import type { ReactNode } from 'react';

interface SyncSectionProps {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}

export default function SyncSection({ title, description, count, children }: SyncSectionProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-700">{count}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
