import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
