# Commands Cheat Sheet

## Plain-English Commands (say these to CC)

| Phrase | What CC does |
|---|---|
| "Add to roadmap" | Adds item to ROADMAP.md under appropriate section |
| "Add to backlog" | Adds item to BACKLOG.md (deferred features) |
| "Add to bugs" | Adds item to BUGS.md (small fixes) |
| "Add to CLAUDE.md" | Adds engineering note to CLAUDE.md |
| "start session" (primary) / "new session" (alias) | Runs the Start-of-Session Protocol: reads SESSION_HANDOFF + ROADMAP + latest CHANGELOG, synthesizes a kickoff message, asks whether to proceed or pivot |
| "end session" (primary) / "wrap session" (alias) | Runs the End-of-Session Protocol: pre-flight verification first, then docs update (CHANGELOG / ledger / ROADMAP / BACKLOG / BUGS) + commit + push + PR merge decision + SESSION_HANDOFF |
| "Status check" | Reports: current branch, what's in flight, last commit, what's on roadmap next |
| "What did we ship last session?" | Reports last merged PR with contents |
| "What's next on the roadmap?" | Reads ROADMAP.md "current build" section |
| "What did we last complete?" | Reads ROADMAP.md for most recently completed item |

## Technical Commands (run yourself when needed)

### Where am I and what's in flight?
```
git status                          # uncommitted changes
git branch --show-current           # what branch
git log --oneline -5                # recent commits
```

### Is my work merged to main?
```
git log main --oneline -10          # see if your commit hash is there
```

### What's on Vercel?
```
vercel ls                           # list deploys (recent first)
# Or: open vercel.com dashboard
```

### Recent migrations applied to prod?
```
ls supabase/migrations/ | tail -10  # latest 10 migration files
```

### What's deployed to prod?
vetted-self.vercel.app pulls from main. Whatever's in main = prod.

### Check if a PR is merged
Open https://github.com/mktahr/vetted/pulls

## Glossary

- **main**: the production branch. What's on main = what's at vetted-self.vercel.app.
- **PR (Pull Request)**: a proposed change to main from a feature branch. Has to be reviewed and merged before it hits prod.
- **Squash merge**: combines all commits in a PR into one commit on main. Cleaner history.
- **Rebase**: takes your branch's commits and replays them on top of latest main. Used to update a stale branch.
- **Vercel preview**: a deploy of a feature branch BEFORE merging to main. Lets you test before going to prod.
- **Vercel production deploy**: deploys main. Goes live at vetted-self.vercel.app.
- **Migration**: a SQL file that changes the database schema. Numbered sequentially (048, 049, etc.).
- **In flight**: work that's started but not yet merged to main.
- **Deferred**: in BACKLOG.md, not being built now.
- **Stale**: a branch that hasn't been updated with the latest main. Needs rebase before continuing work.
