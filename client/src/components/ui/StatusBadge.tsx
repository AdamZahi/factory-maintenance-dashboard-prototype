import type { StatusLevel } from '../../types'
import { statusLabel } from '../../lib/validation'

const STYLES: Record<StatusLevel, string> = {
  normal: 'bg-[--color-status-normal-bg] text-[--color-status-normal] ring-1 ring-inset ring-[--color-status-normal]/10',
  warning: 'bg-[--color-status-warning-bg] text-[--color-status-warning] ring-1 ring-inset ring-[--color-status-warning]/10',
  critical: 'bg-[--color-status-critical-bg] text-[--color-status-critical] ring-1 ring-inset ring-[--color-status-critical]/10',
  unknown: 'bg-[--color-status-unknown-bg] text-[--color-status-unknown] ring-1 ring-inset ring-[--color-status-unknown]/10',
}

const DOT: Record<StatusLevel, string> = {
  normal: 'bg-[--color-status-normal]',
  warning: 'bg-[--color-status-warning]',
  critical: 'bg-[--color-status-critical]',
  unknown: 'bg-[--color-status-unknown]',
}

export function StatusDot({ status, pulse = false }: { status: StatusLevel; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {pulse && status === 'critical' && (
        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${DOT[status]} opacity-60`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${DOT[status]}`} />
    </span>
  )
}

export function StatusBadge({ status, compact = false }: { status: StatusLevel; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-display font-medium uppercase tracking-[0.12em] ${STYLES[status]} ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'
      }`}
    >
      <StatusDot status={status} pulse={!compact} />
      {statusLabel(status)}
    </span>
  )
}
