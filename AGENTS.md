# Codex Project Instructions

This file is a thin pointer for Codex. `CLAUDE.md` is authoritative for this
project.

At the start of every session, read these files before doing feature work:

- `CLAUDE.md` - architecture, hard rules, working conventions, session protocol,
  command definitions, and cross-check commands.
- `SESSION_HANDOFF.md` - current state and where the previous session left off.
- `COMMANDS.md` - command shortcuts.
- `ROADMAP.md`, `BUGS.md`, and `CHANGELOG.md` - as referenced by the above docs.

Follow the same session protocol, hard rules, and command vocabulary defined in
`CLAUDE.md`, including:

- `start session`
- `end session`
- `block`
- `pack claude` - bundle Codex's current work as a copyable package for the user
  to paste into Claude Code.
- `review claude` - evaluate pasted Claude work against the actual codebase and
  the rules in `CLAUDE.md`, flagging what is right, wrong, or missing context.

Wrong-agent guardrail: `pack codex` / `review codex` are Claude Code's commands,
not Codex's. If Matt types either to Codex, that's the wrong agent — tell him and
redirect to `pack claude` / `review claude`. (CLAUDE.md defines the symmetric
guardrail for the Claude side.)

When any instruction conflicts with `CLAUDE.md`, treat `CLAUDE.md` as the single
source of truth.
