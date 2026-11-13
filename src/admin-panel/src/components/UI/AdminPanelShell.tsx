import React, { type ReactNode, useState, useRef, useEffect } from 'react'

export const AdminPanelCard = ({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) => (
  <div
    className={`rounded-2xl border border-emerald-500/15 dark:border-emerald-500/20 bg-white/95 dark:bg-[#0a0e0c]/95 backdrop-blur-xl shadow-[0_8px_30px_-4px_rgba(16,185,129,0.04),0_2px_6px_-1px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.7),0_0_15px_rgba(16,185,129,0.08)] transition-all ${className}`}
  >
    {children}
  </div>
)

export const AdminPanelHeader = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => (
  <div>
    <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h1>
    {description ? <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">{description}</p> : null}
  </div>
)

export const AdminSectionTitle = ({
  title,
  description,
}: {
  title: string
  description?: string
}) => (
  <div>
    <h2 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{title}</h2>
    {description ? <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">{description}</p> : null}
  </div>
)

export const AdminInput = ({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className={`rounded-xl border border-zinc-200 dark:border-emerald-500/25 bg-white/95 dark:bg-black/90 px-3.5 py-2 text-sm text-zinc-900 dark:text-white outline-none transition placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-black focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 ${className}`}
  />
)

export const AdminSelect = ({
  value,
  onChange,
  className = '',
  children,
  disabled,
}: {
  value?: string | number | string[]
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  className?: string
  children: React.ReactNode
  disabled?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Extract options from children
  const options: { value: string; label: string }[] = []
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === 'option') {
      const optionElement = child as React.ReactElement<any>
      options.push({
        value: String(optionElement.props.value ?? ''),
        label: String(optionElement.props.children ?? ''),
      })
    }
  })

  // Determine current active label
  const currentValueStr = value !== undefined ? String(value) : ''
  const selectedOption = options.find((opt) => opt.value === currentValueStr) || options[0]

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (val: string) => {
    if (disabled) return
    if (onChange) {
      const mockEvent = {
        target: {
          value: val,
        },
      } as React.ChangeEvent<HTMLSelectElement>
      onChange(mockEvent)
    }
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-emerald-500/25 bg-white/95 dark:bg-black/90 px-3.5 py-2 text-left text-sm font-medium text-zinc-900 dark:text-zinc-100 shadow-2xs outline-none transition hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-400/20 ${
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        }`}
      >
        <span className="truncate">{selectedOption?.label ?? 'Select option...'}</span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180 transform' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Modern Frosted Dropdown Popover */}
      <div
        className={`absolute left-0 z-50 mt-1.5 w-full min-w-[140px] origin-top-left rounded-xl border border-zinc-200/90 dark:border-emerald-500/30 bg-white/95 dark:bg-[#0a0e0c]/95 p-1.5 shadow-xl backdrop-blur-xl transition-all duration-150 ${
          isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible pointer-events-none'
        }`}
      >
        <div className="max-h-60 overflow-y-auto space-y-0.5">
          {options.map((opt) => {
            const isSelected = opt.value === currentValueStr
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white font-bold shadow-xs dark:bg-emerald-600 dark:text-white'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const AdminTabClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-4 py-2 text-sm font-semibold transition ${
    isActive
      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 font-bold dark:bg-emerald-600 dark:text-white dark:shadow-[0_0_15px_rgba(16,185,129,0.35)]'
      : 'border border-zinc-200/80 dark:border-emerald-500/20 bg-white/80 dark:bg-[#0a0e0c]/80 text-zinc-700 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-800 dark:hover:text-emerald-300'
  }`

export const AdminStatCard = ({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: 'green' | 'red'
}) => (
  <div className="rounded-2xl border border-emerald-500/15 dark:border-emerald-500/20 bg-white/95 dark:bg-[#0a0e0c]/95 backdrop-blur-xl p-5 shadow-[0_8px_30px_-4px_rgba(16,185,129,0.04)] dark:shadow-[0_12px_36px_rgba(0,0,0,0.7)]">
    <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{label}</p>
    <p
      className={`mt-2 text-2xl font-extrabold tracking-tight ${
        tone === 'red' ? 'text-rose-600 dark:text-rose-400' : tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'
      }`}
    >
      {value}
    </p>
  </div>
)
