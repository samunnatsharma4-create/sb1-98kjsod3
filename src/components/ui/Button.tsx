import React from 'react';
import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glass';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const variants = {
      primary: 'premium-gradient text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]',
      secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700',
      outline: 'border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300',
      ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-white/5 text-slate-600 dark:text-slate-400',
      danger: 'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600',
      glass: 'glass-card border-none hover:bg-white/90 dark:hover:bg-slate-900/80 text-slate-700 dark:text-slate-200',
    };

    const sizes = {
      xs: 'px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg',
      sm: 'px-4 py-2 text-xs font-bold rounded-xl',
      md: 'px-6 py-2.5 text-sm font-bold rounded-2xl',
      lg: 'px-8 py-4 text-base font-black uppercase tracking-widest rounded-[2rem]',
      icon: 'p-2.5 rounded-xl',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
