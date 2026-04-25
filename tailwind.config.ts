import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Semantic surface tokens — resolve via CSS custom properties
        // defined in design-system.css, which respond to data-theme.
        background: 'var(--bg-canvas)',
        foreground: 'var(--fg-primary)',
        card: 'var(--bg-surface)',
        'card-foreground': 'var(--fg-primary)',
        muted: 'var(--bg-surface-raised)',
        'muted-foreground': 'var(--fg-secondary)',
        tertiary: 'var(--fg-tertiary)',
        disabled: 'var(--fg-disabled)',
        border: 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        input: 'var(--border-subtle)',
        hover: 'var(--bg-hover)',
        selected: 'var(--bg-selected)',
        // Brand accent (Ember)
        primary: 'var(--accent-500)',
        'primary-foreground': 'var(--fg-on-accent)',
        accent: 'var(--accent-500)',
        'accent-strong': 'var(--accent-400)',
        'accent-quiet': 'var(--accent-200)',
        // Semantic signals
        destructive: 'var(--signal-negative)',
        positive: 'var(--signal-positive)',
        watch: 'var(--signal-watch)',
        info: 'var(--signal-info)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        chip: 'var(--r-chip)',
        btn: 'var(--r-button)',
        logo: 'var(--r-logo)',
        card: 'var(--r-card)',
      },
    },
  },
  plugins: [],
}
export default config
