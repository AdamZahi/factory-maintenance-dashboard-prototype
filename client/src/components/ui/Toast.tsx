import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  kind: ToastKind
  title: string
  description?: string
  duration: number
}

interface ToastInput {
  kind?: ToastKind
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  toast: (input: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_META: Record<ToastKind, { icon: React.ReactNode; accent: string; bg: string }> = {
  success: { icon: <CheckCircle2 className="h-5 w-5" />, accent: 'text-[--color-status-normal]', bg: 'bg-[--color-status-normal-bg]' },
  error: { icon: <XCircle className="h-5 w-5" />, accent: 'text-[--color-status-critical]', bg: 'bg-[--color-status-critical-bg]' },
  warning: { icon: <AlertTriangle className="h-5 w-5" />, accent: 'text-[--color-status-warning]', bg: 'bg-[--color-status-warning-bg]' },
  info: { icon: <Info className="h-5 w-5" />, accent: 'text-[--color-graphite-700]', bg: 'bg-[--color-graphite-100]' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((input: ToastInput) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const next: Toast = {
      id,
      kind: input.kind ?? 'info',
      title: input.title,
      description: input.description,
      duration: input.duration ?? 4200,
    }
    setToasts((prev) => [...prev, next])
  }, [])

  const value: ToastContextValue = {
    toast,
    success: (title, description) => toast({ kind: 'success', title, description }),
    error: (title, description) => toast({ kind: 'error', title, description, duration: 6000 }),
    warning: (title, description) => toast({ kind: 'warning', title, description }),
    info: (title, description) => toast({ kind: 'info', title, description }),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-3 sm:left-auto sm:right-5 sm:w-full sm:max-w-sm">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const meta = KIND_META[toast.kind]

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), toast.duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  return (
    <div className="animate-slide-in pointer-events-auto flex items-start gap-3 overflow-hidden rounded-2xl border border-[--color-graphite-100] bg-white p-4 shadow-[0_16px_40px_rgba(18,24,31,0.16)]">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg} ${meta.accent}`}>{meta.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[--color-graphite-900]">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-xs text-[--color-graphite-500]">{toast.description}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[--color-graphite-400] transition-colors hover:bg-[--color-graphite-100] hover:text-[--color-graphite-900]"
        aria-label="Fermer"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
