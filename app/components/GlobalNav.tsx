'use client'

// Persistent global app bar. Rendered once in app/layout.tsx — present on
// every page. Pages render their own title + page-specific action buttons
// in a separate row below.
//
// Layout:
//   [Vetted brand →/]   [Candidates] [Companies] [Lists] [Import▾]   [theme]

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS: Array<{ href: string; label: string; matches: (path: string) => boolean }> = [
  { href: '/',                    label: 'Candidates', matches: (p) => p === '/' || p.startsWith('/profile') },
  { href: '/admin/companies',     label: 'Companies',  matches: (p) => p.startsWith('/admin/companies') },
  { href: '/lists',               label: 'Lists',      matches: (p) => p.startsWith('/lists') },
]

const IMPORT_ITEMS: Array<{ href: string; label: string }> = [
  { href: '/admin/import',           label: 'Import candidates' },
  { href: '/admin/import/companies', label: 'Import companies' },
]

export default function GlobalNav() {
  const pathname = usePathname() || '/'
  const importActive = pathname.startsWith('/admin/import')
  const [importOpen, setImportOpen] = useState(false)
  const importRef = useRef<HTMLDivElement | null>(null)
  const importBtnRef = useRef<HTMLButtonElement | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Reposition portal menu under the trigger button
  useLayoutEffect(() => {
    if (!importOpen || !importBtnRef.current) return
    function position() {
      const r = importBtnRef.current!.getBoundingClientRect()
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
    }
  }, [importOpen])

  // Close on outside click / Escape
  useEffect(() => {
    if (!importOpen) return
    function onClick(e: MouseEvent) {
      const target = e.target as Node
      if (importRef.current && importRef.current.contains(target)) return
      // also ignore clicks inside the portal menu
      if ((target as HTMLElement).closest?.('[data-import-menu]')) return
      setImportOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setImportOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [importOpen])

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'var(--bg-canvas)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center px-6 py-3">
        {/* Brand — left edge */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          style={{ color: 'var(--fg-primary)', textDecoration: 'none' }}
        >
          <span
            aria-hidden
            style={{
              display: 'inline-flex',
              width: 22,
              height: 22,
              borderRadius: 5,
              background: 'var(--accent)',
              color: 'white',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            V
          </span>
          <span style={{ fontSize: 'var(--fs-14)' }}>Vetted</span>
        </Link>

        {/* Nav + theme cluster — right edge */}
        <nav className="flex items-center gap-1 ml-auto" aria-label="Primary">
          {NAV_ITEMS.map(item => {
            const active = item.matches(pathname)
            return <NavLinkButton key={item.href} href={item.href} label={item.label} active={active} />
          })}

          {/* Import dropdown */}
          <div ref={importRef} className="relative">
            <NavTriggerButton
              ref={importBtnRef}
              active={importActive}
              expanded={importOpen}
              onClick={() => setImportOpen(o => !o)}
              label="Import"
              hasCaret
            />
          </div>
          {/* Theme toggle — far right of cluster */}
          <span className="ml-2 inline-flex items-center">
            <ThemeToggle />
          </span>
        </nav>

        {/* Import menu — portaled out of the sticky header so it can never be clipped by overflow/stacking */}
        {mounted && importOpen && menuPos && createPortal(
          <div
            role="menu"
            data-import-menu
            style={{
              position: 'fixed',
              top: menuPos.top,
              right: menuPos.right,
              zIndex: 1000,
              minWidth: 200,
              backgroundColor: 'var(--bg-elevated, #1f1f24)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
              padding: 4,
            }}
          >
            {IMPORT_ITEMS.map(item => (
              <ImportMenuItem
                key={item.href}
                href={item.href}
                label={item.label}
                onSelect={() => setImportOpen(false)}
              />
            ))}
          </div>,
          document.body,
        )}
      </div>
    </header>
  )
}

// Inline-styled link/button helpers — the global `a:hover { color: var(--accent-strong) }`
// in design-system.css beats Tailwind's `hover:text-foreground` on specificity. Inline
// styles win, so we drive color from local hover state.

function NavLinkButton({ href, label, active }: { href: string; label: string; active: boolean }) {
  const [hover, setHover] = useState(false)
  const baseColor = active ? 'var(--fg-primary)' : 'var(--fg-tertiary)'
  const hoverColor = 'var(--fg-primary)'
  return (
    <Link
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 'var(--fs-13)',
        fontWeight: active ? 'var(--fw-medium)' : 'var(--fw-regular)',
        color: hover ? hoverColor : baseColor,
        background: active ? 'var(--bg-surface)' : (hover ? 'var(--bg-surface)' : 'transparent'),
        border: '1px solid',
        borderColor: active ? 'var(--border-subtle)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 120ms var(--ease), color 120ms var(--ease)',
      }}
    >
      {label}
    </Link>
  )
}

const NavTriggerButton = forwardRef<HTMLButtonElement, {
  active: boolean
  expanded: boolean
  onClick: () => void
  label: string
  hasCaret?: boolean
}>(function NavTriggerButton({ active, expanded, onClick, label, hasCaret }, ref) {
  const [hover, setHover] = useState(false)
  const baseColor = active ? 'var(--fg-primary)' : 'var(--fg-tertiary)'
  const hoverColor = 'var(--fg-primary)'
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-expanded={expanded}
      aria-haspopup="menu"
      style={{
        padding: '6px 12px',
        borderRadius: 6,
        fontSize: 'var(--fs-13)',
        fontWeight: active ? 'var(--fw-medium)' : 'var(--fw-regular)',
        color: hover ? hoverColor : baseColor,
        background: active ? 'var(--bg-surface)' : (hover ? 'var(--bg-surface)' : 'transparent'),
        border: '1px solid',
        borderColor: active ? 'var(--border-subtle)' : 'transparent',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-sans)',
        transition: 'background 120ms var(--ease), color 120ms var(--ease)',
      }}
    >
      {label}
      {hasCaret && <span aria-hidden style={{ fontSize: 10, opacity: 0.6 }}>▾</span>}
    </button>
  )
})

function ImportMenuItem({ href, label, onSelect }: { href: string; label: string; onSelect: () => void }) {
  const [hover, setHover] = useState(false)
  return (
    <Link
      href={href}
      onClick={onSelect}
      role="menuitem"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        padding: '8px 12px',
        borderRadius: 4,
        fontSize: 'var(--fs-13)',
        color: 'var(--fg-primary)',
        background: hover ? 'var(--bg-surface)' : 'transparent',
        textDecoration: 'none',
      }}
    >
      {label}
    </Link>
  )
}
