import React from 'react';
import { cn } from '../../lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary' | 'emerald' | 'rose' | 'amber' | 'teal';
}

export const Badge = ({ className, variant = 'primary', ...props }: BadgeProps) => {
  const variants = {
    primary: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    secondary: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest transition-colors',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};
