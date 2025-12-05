'use client';

import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  status: 'paid' | 'unpaid';
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        status === 'paid' 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        className
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current mr-1.5"></span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
