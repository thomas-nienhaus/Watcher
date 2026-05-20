'use client'

interface Props {
  children: React.ReactNode
  className?: string
}

export default function GlassPanel({ children, className = '' }: Props) {
  return (
    <div
      className={`glass rounded-[var(--radius-panel)] ${className}`}
    >
      {children}
    </div>
  )
}
