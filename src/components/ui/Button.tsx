import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const VARIANT: Record<string, string> = {
  primary:   'bg-accent-blue text-surface-0 hover:bg-accent-blue-dim font-semibold',
  secondary: 'bg-surface-2 border border-surface-3 text-white/80 hover:border-white/20 hover:text-white',
  danger:    'bg-live/90 text-white hover:bg-live',
  ghost:     'text-white/50 hover:text-white hover:bg-white/8',
}

const SIZE: Record<string, string> = {
  sm: 'px-4 py-2.5 text-sm min-h-[40px]',
  md: 'px-5 py-3 text-base min-h-[48px]',
  lg: 'px-6 py-4 text-base min-h-[56px]',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center gap-2
        rounded-[var(--radius-button)] font-medium
        transition-all duration-200 active:scale-[0.97]
        disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANT[variant]} ${SIZE[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
