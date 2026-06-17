# Session Notes

<!-- Compact context summary for session continuity. Rewritten at session end. -->

## Worked on

Broadened Farlume's positioning. User asked to drop the "personal/household" framing everywhere, permanently — the tool serves any cashflow context (household, freelance, small business, project budget, side hustle).

## Accomplished

- Replaced "household cashflow" / "personal finance" / "personal budget" language across 10 files (README, USER_GUIDE, PRODUCT_DEFINITION, TESTING_GUIDE, FORECASTING_RESEARCH, WorkspaceForm placeholder, demoData workspace name, forecast.ts comment, patterns.ts comments, useTagSuggestions.ts comment).
- Demo workspace display name: `Demo Household` → `Demo Workspace`. Internal id `demo-household` kept as-is — never user-visible and changing it would re-seed the dev's existing install (creating a duplicate).
- WorkspaceForm name placeholder: `e.g. Household, Side Hustle, Wedding` → `e.g. Main Account, Freelance, Project Budget`. Three contexts, none exclusively personal.
- README / USER_GUIDE / PRODUCT_DEFINITION: lead with "tracking cashflow" followed by a multi-context list (`household, freelance, small business, project budget, side hustle`) so "household" survives ONLY as one item in a breadth-list, never as the framing.
- LICENSE untouched — CC license boilerplate, not project copy.
- Demo transaction data (salary/rent/groceries) kept as-is. It's recognisable to most readers and demonstrates the FEATURES (recurring vs once-off, fixed vs variable, monthly cadence), not a statement of audience.
- Added positioning rule to CLAUDE.md AI Notes so future sessions don't reintroduce "personal/household only" framing. Rule covers ALL surfaces (docs, code comments, in-app strings, commit messages, marketing copy, conversational descriptions).

## Current state

Branch: `claude/lucid-fermat-501d0n`. One commit covering all 11 files. Verified by grep that the only surviving `household`/`personal finance` mentions are intentional: multi-context lists, LICENSE boilerplate, and the internal `demo-household` id constant.

## Key context

- The positioning is now: **general cashflow tracker, works for any context**. Mix examples when needed; never lead with "personal" or "household."
- The demo data still LOOKS household-flavored (salary, rent, groceries, Netflix, gym, medical aid, fuel, Uber, Takealot) — this is illustrative of features, not positioning. If we later want to rebuild the demo to mix business-flavor transactions (invoice income, software subs, contractor payments), that's a separate task.
- Internal id `demo-household` is intentionally left unchanged — renaming it would re-seed existing installs.
- The CLAUDE.md positioning note is the durable record. Future sessions reading CLAUDE.md will see it before doing any work.
