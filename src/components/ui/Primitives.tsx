import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-[--color-graphite-100] bg-white shadow-[0_1px_2px_rgba(18,24,31,0.04)] transition-shadow duration-200 hover:shadow-[0_12px_32px_rgba(18,24,31,0.08)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[--color-graphite-100] px-6 py-5">
      <div>
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-[--color-graphite-900]">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-[--color-graphite-500]">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40'
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
  const variants: Record<string, string> = {
    primary: 'bg-[--color-graphite-900] text-white hover:bg-[--color-graphite-800]',
    secondary: 'border border-[--color-graphite-200] bg-white text-[--color-graphite-900] hover:bg-[--color-graphite-50]',
    ghost: 'text-[--color-graphite-500] hover:bg-[--color-graphite-100] hover:text-[--color-graphite-900]',
    danger: 'bg-[--color-status-critical] text-white hover:brightness-95',
  }
  return <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest} />
}

export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full bg-[--color-graphite-100] px-2.5 py-1 text-[11px] font-medium text-[--color-graphite-700] ${className}`}>
      {children}
    </span>
  )
}
