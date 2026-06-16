import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { type ReactNode } from 'react'
import { cn } from '../../lib/cn'

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in" />
        <RadixDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl focus:outline-none dark:border-slate-700 dark:bg-slate-900',
            'max-h-[90vh] overflow-y-auto',
            className,
          )}
        >
          <div className="mb-4 flex items-center justify-between">
            <RadixDialog.Title className="text-lg font-semibold">
              {title}
            </RadixDialog.Title>
            <RadixDialog.Close className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">
              <X className="h-5 w-5" />
            </RadixDialog.Close>
          </div>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
