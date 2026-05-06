'use client'

// Persistent global app bar. Rendered once in app/layout.tsx — present on
// every page. Pages render their own title + page-specific action buttons
// in a separate row below.
//
// Layout:
//   [Vetted brand →/]   [Candidates] [Companies] [Lists] [Import▾]   [theme]

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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

  // Close on outside click / Escape
  useEffect(() => {
    if (!importOpen) return
    function onClick(e: MouseEvent) {
      if (importRef.current && !importRef.current.contains(e.target as Node)) setImportOpen(false)
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
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm transition ${
                  active
                    ? 'bg-card text-foreground font-medium border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card border border-transparent'
                }`}
              >
                {item.label}
              </Link>
            )
          })}

          {/* Import dropdown */}
          <div ref={importRef} className="relative">
            <button
              type="button"
              onClick={() => setImportOpen(o => !o)}
              className={`px-3 py-1.5 rounded-md text-sm transition flex items-center gap-1 ${
                importActive
                  ? 'bg-card text-foreground font-medium border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card border border-transparent'
              }`}
              aria-expanded={importOpen}
              aria-haspopup="menu"
            >
              Import
              <span aria-hidden style={{ fontSize: 10, opacity: 0.6 }}>▾</span>
            </button>
            {importOpen && (
              <div
                role="menu"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  zIndex: 60,
                  minWidth: 200,
                  backgroundColor: '#1f1f24',
                  border: '1px solid #3a3a42',
                  borderRadius: 8,
                  boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
                  padding: 4,
                }}
              >
                {IMPORT_ITEMS.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setImportOpen(false)}
                    role="menuitem"
                    className="block px-3 py-2 rounded text-sm hover:bg-card"
                    style={{ color: 'var(--fg-primary)', textDecoration: 'none' }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          {/* Theme toggle — far right of cluster */}
          <span className="ml-2 inline-flex items-center">
            <ThemeToggle />
          </span>
        </nav>
      </div>
    </header>
  )
}
