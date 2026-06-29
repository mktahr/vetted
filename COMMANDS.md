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
| "block" (exact, single word) | Re-outputs CC's immediately preceding response as ONE self-contained plain-text copyable code block (full substance, plain text, no new analysis), so you can one-click copy + forward it to a Claude chat, Codex, or a fresh session |
| "pack codex" | OUTBOUND. Bundles CC's current work (task, approach, progress, files/branches, the specific thing to pressure-test) into ONE copyable plain-text block to paste into Codex, framed as Claude's work for review |
| "review codex" | INBOUND. You paste Codex's work/critique; CC evaluates it against the actual codebase + CLAUDE.md rules, verifies claims against real files, and reports where Codex is right/wrong/missing context + a recommendation |
| "codex loop" | BIDIRECTIONAL (orchestrated). The hands-free version of pack codex + review codex — no copy-pasting, no separate Codex window. CC states its proposal, sends it to Codex via the openai-codex plugin (read-only), Codex pressure-tests per point (right/wrong/missing), CC ingests + revises, then does ONE more round on contested points only (max 2 round-trips). Then: EXECUTE if converged on implementation-only decisions; STOP and ask you if a product/UX/scope call or unresolved disagreement remains. On execute of a production-touching/user-visible change it fires ONE /codex:adversarial-review on the diff (dormant/trivial skips it). Vercel-preview-before-merge still applies — never merges to prod unseen. NOT /codex:review and NOT /loop. |

## Codex cross-check commands (say these to Codex, not CC)

| Phrase | What Codex does |
|---|---|
| "pack claude" | OUTBOUND from Codex. Bundles Codex's current work into a copyable plain-text block to paste into Claude Code, framed as Codex's work for review |
| "review claude" | INBOUND to Codex. You paste Claude's work; Codex evaluates it against the actual codebase + CLAUDE.md rules and flags where Claude is right/wrong/missing context |

Both agents' cross-check commands are defined in one place — see "Cross-Agent Pressure-Testing Commands" in CLAUDE.md (Codex inherits its commands from there via AGENTS.md). **If you type "pack claude" / "review claude" to CC by mistake, CC will tell you it's the wrong agent and remind you CC uses "pack codex" / "review codex".**

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
