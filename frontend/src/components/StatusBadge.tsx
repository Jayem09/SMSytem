import type { ReactNode } from 'react';

interface StatusBadgeProps {
  status: string;
  children?: ReactNode;
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  success: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  in_transit: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  
  error: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  
  info: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  
  default: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500' },
};

const formatStatus = (status: string): string => {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export function StatusBadge({ status, children, size = 'md' }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase();
  const config = statusConfig[normalizedStatus] || statusConfig.default;
  
  const baseClasses = `inline-flex items-center gap-1.5 font-medium rounded-full ${config.bg} ${config.text}`;
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`${baseClasses} ${sizeClasses}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {children || formatStatus(status)}
    </span>
  );
}

interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'away';
}

export function StatusDot({ status }: StatusDotProps) {
  const config = {
    online: 'bg-emerald-500 animate-pulse',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-amber-500',
  };

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${config[status]}`} />
  );
}
