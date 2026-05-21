# Vetted

Elite recruiting intelligence platform — talent and company discovery, ranked by signal. Think of it as the top 10% of LinkedIn profiles, structured, scored, and ranked using a deterministic rules-based system instead of AI inference.

Built on Next.js 14 + Supabase + Vercel. Data flows in via a Chrome extension (single-profile scrape) and Crust Data API (bulk filter-builder import), then through a normalized schema with dictionary-driven title / function / specialty / seniority / degree resolution, deterministic per-stage scoring, and bucket assignment with admin override.

## Documentation

| File | What's in it |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Engineering context — architecture, schema, scoring spec, migration ledger, hard rules. **Read first every session.** |
| [ROADMAP.md](ROADMAP.md) | Current build, sequenced next-up work, recently completed (with PR links) |
| [BACKLOG.md](BACKLOG.md) | Major deferred features (>0.5 day each), sub-sectioned by domain |
| [BUGS.md](BUGS.md) | Small fixes (<0.5 day each) |
| [POSITIONING.md](POSITIONING.md) | Product positioning + differentiators |
| [COMMANDS.md](COMMANDS.md) | Plain-English commands for Claude Code sessions + technical command reference + glossary |
| [GETTING_STARTED.md](GETTING_STARTED.md) | New-machine setup. ⚠ Currently stale; references old build phases |

## Live

- Production: [vetted-self.vercel.app](https://vetted-self.vercel.app) (deploys from `main`)
- Repo: [github.com/mktahr/vetted](https://github.com/mktahr/vetted)
- Chrome extension: [github.com/mktahr/vetted-extension](https://github.com/mktahr/vetted-extension)
