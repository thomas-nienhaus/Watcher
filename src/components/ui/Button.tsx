import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const VARIANT: Record<string, string> = {
  primary:   'bg-primary text-white hover:bg-emerald-600 shadow-sm',
  secondary: 'bg-surface border border-gray-600 text-white hover:border-gray-400',
  danger:    'bg-danger text-white hover:bg-red-600',
  ghost:     'text-gray-300 hover:text-white hover:bg-white/10',
}

const SIZE: Record<string, string> = {
  sm: 'px-3 py-2 text-sm min-h-[40px]',
  md: 'px-4 py-3 text-base min-h-[48px]',
  lg: 'px-6 py-4 text-lg min-h-[56px]',
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
        inline-flex items-center justify-center rounded-2xl font-semibold
        transition-all active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANT[variant]} ${SIZE[size]} ${className}
      `}
      {...props}
    >
      {children}
    </button>
  )
}
