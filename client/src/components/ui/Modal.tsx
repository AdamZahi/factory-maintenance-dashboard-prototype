import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const SIZES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

/** Accessible, animated modal rendered in a portal. Closes on backdrop click + Escape. */
export function Modal({ open, onClose, title, subtitle, icon, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="animate-overlay-in absolute inset-0 bg-[--color-graphite-950]/50 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`animate-scale-in relative z-10 w-full ${SIZES[size]} overflow-hidden rounded-3xl border border-[--color-graphite-100] bg-white shadow-[0_32px_80px_rgba(18,24,31,0.28)]`}
      >
        {(title || icon) && (
          <div className="flex items-start justify-between gap-3 border-b border-[--color-graphite-100] px-6 py-5">
            <div className="flex items-start gap-3">
              {icon && <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[--color-graphite-50] text-[--color-graphite-700]">{icon}</div>}
              <div>
                {title && <h3 className="font-display text-base font-semibold uppercase tracking-[0.1em] text-[--color-graphite-900]">{title}</h3>}
                {subtitle && <p className="mt-1 text-xs text-[--color-graphite-500]">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[--color-graphite-400] transition-colors hover:bg-[--color-graphite-100] hover:text-[--color-graphite-900]"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-3 border-t border-[--color-graphite-100] bg-[--color-graphite-50]/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
