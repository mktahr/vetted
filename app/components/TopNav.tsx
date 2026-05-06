'use client'

// Shared global header. Replaces the bespoke header divs that were
// scattered across each page. Single source of truth for navigation.
//
// Renders:
//   [optional back link]
//   <h1>{title}</h1>
//
//   [Candidates] [Companies] [Lists] [Import] {rightActions} [theme]
//
// Pages that need page-specific buttons (e.g. "+ Add Company" on the
// companies list) pass them via `rightActions`.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ThemeToggle from './ThemeToggle'

interface TopNavProps {
  title?: React.ReactNode
  /** Optional context-specific JSX rendered immediately before the theme toggle */
  rightActions?: React.ReactNode
  /** Optional back link (rendered above the title) */
  backHref?: string
  backLabel?: string
  /** Subtitle / blurb below the title */
  subtitle?: React.ReactNode
}

const NAV_ITEMS: Array<{ href: string; label: string; matches: (path: string) => boolean }> = [
  { href: '/',                        label: 'Candidates', matches: (p) => p === '/' || p.startsWith('/profile') },
  { href: '/admin/companies',         label: 'Companies',  matches: (p) => p.startsWith('/admin/companies') },
  { href: '/lists',                   label: 'Lists',      matches: (p) => p.startsWith('/lists') },
  { href: '/admin/import',            label: 'Import',     matches: (p) => p.startsWith('/admin/import') },
]

export default function TopNav({ title, rightActions, backHref, backLabel, subtitle }: TopNavProps) {
  const pathname = usePathname() || '/'
  return (
    <header className="mb-6">
      {/* Persistent top nav strip — same on every page */}
      <div
        className="flex items-center justify-between mb-5 pb-3"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <nav className="flex items-center gap-0.5" aria-label="Primary">
          {NAV_ITEMS.map(item => {
            const active = item.matches(pathname)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative px-3 py-1.5 text-sm transition"
                style={{
                  color: active ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg-primary)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--fg-tertiary)' }}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 12,
                      right: 12,
                      bottom: -13,
                      height: 2,
                      background: 'var(--accent)',
                      borderRadius: 1,
                    }}
                  />
                )}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          {rightActions}
          <ThemeToggle />
        </div>
      </div>

      {/* Page title block (optional) */}
      {(title || subtitle || backHref) && (
        <div>
          {backHref && (
            <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground inline-block mb-2">
              {backLabel || '← Back'}
            </Link>
          )}
          {title && <h1 className="text-3xl font-bold tracking-tight">{title}</h1>}
          {subtitle && <div className="text-sm text-muted-foreground mt-1">{subtitle}</div>}
        </div>
      )}
    </header>
  )
}
