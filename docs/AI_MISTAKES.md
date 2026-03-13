# AI Mistakes

<!-- Record significant AI mistakes and learnings to prevent repetition. -->

## Fuzzy matching scored order-blind (2026-02-24)

**What went wrong:** The original fuzzy matching algorithm used character-presence scoring — it checked if characters existed in the target string but ignored order. "abc" vs "cba" scored as a perfect match.

**Why it happened:** Quick initial implementation prioritized getting the 3-pass system working without testing edge cases in the scoring function itself.

**How to prevent it:** Always test scoring/comparison functions with adversarial inputs (reversed strings, substrings, completely different strings of same length). Levenshtein distance was the correct approach.

## Used Math.min instead of Math.max for fuzzy thresholds (2026-02-24)

**What went wrong:** Medium-confidence matching used `Math.min` to pick the best of two fuzzy scores, which meant any single good score (even if the other was terrible) would pass the threshold. Should have used `Math.max` to require both scores to be reasonable.

**Why it happened:** Logical error in threshold logic — "best score" was misinterpreted as "lowest score" without considering that both dimensions should pass.

**How to prevent it:** When combining multiple match scores, decide explicitly whether the threshold is "any match" (min) or "all must match" (max). Document the intent in the code.

## Day-of-month subtraction for date ranges (2026-02-24)

**What went wrong:** Daily/weekly projection calculations used simple day-of-month subtraction (`endDay - startDay`) to count days in a month range. This broke across month boundaries — Jan 25 to Feb 4 calculated as -20 days instead of 10.

**Why it happened:** Took a shortcut assuming start and end would always be within the same month. Cross-month expenses (clamped to month boundaries) violated this assumption.

**How to prevent it:** Always use Date objects for date arithmetic. Simple integer subtraction on day-of-month values doesn't handle month/year boundaries. The `daysBetween()` helper using `(end - start) / 86400000` is correct.

## Prop mutation in Vue child components (2026-03-02)

**What went wrong:** ImportStepReview.vue directly mutated prop objects (`toggleApproval`, `reassignExpense`, `approveAll` modified the parent's array items). This works in practice (objects are passed by reference) but violates Vue's one-way data flow and causes hard-to-debug state issues.

**Why it happened:** During initial implementation of the import wizard split, the child component kept the mutation logic that was originally in the parent, without converting to emit-based communication.

**How to prevent it:** When extracting child components, always convert direct state mutations to emits. The parent owns the data, children request changes. Check for `.value =` and direct property assignment on props.

## Timer leaks on component unmount (2026-03-02)

**What went wrong:** Four components had `setTimeout` calls that weren't cleaned up on unmount. If the component unmounted mid-timeout, the callback would fire on a stale component, potentially causing errors or orphaned DOM updates.

**Why it happened:** `setTimeout` feels "fire and forget" — easy to forget that the callback captures component state and can outlive the component.

**How to prevent it:** Every `setTimeout`, `setInterval`, `addEventListener`, or `subscribe` in a component setup needs a corresponding cleanup in `onUnmounted`. Track timeout IDs in an array and clear them all on unmount. See CLAUDE.md Suggested Implementations for the pattern.

## Documentation not updated after renames and migrations (2026-03-02–03)

**What went wrong:** After renaming Budget→Workspace (v4 migration) and category→tags (v5 migration), several documentation files still referenced the old terminology: README.md project structure listed `useCategoryAutocomplete.ts` and `usePWA.ts`, PRODUCT_DEFINITION.md used "budget" throughout and listed dependencies not in the project (ApexCharts, Fuse.js, date-fns, Papa Parse), USER_GUIDE.md still said "Category" for the tag input field.

**Why it happened:** Large cross-cutting renames touch many files. Documentation updates were done for some files but missed others — particularly PRODUCT_DEFINITION.md which is long and wasn't re-read after the rename.

**How to prevent it:** After any rename or migration, grep the entire project for the old term (including docs). Use a checklist: README, PRODUCT_DEFINITION, USER_GUIDE, TESTING_GUIDE, CLAUDE.md, SESSION_NOTES, code comments. Verify the project structure section in README matches actual `ls` output.

## Using AskUserQuestion tool — breaks the session UI (2026-03-04)

**What went wrong:** Repeatedly used the AskUserQuestion tool to present options to the user. The input modal covers the conversation context, gets stuck awaiting input that can't be given, and disrupts the entire session workflow. The user has had to deal with this across multiple sessions.

**Why it happened:** The tool exists so it seemed appropriate. But in practice the UI overlay is broken — it blocks context, hangs, and forces session restarts.

**How to prevent it:** NEVER use the AskUserQuestion tool. This is a hard rule. If you need user input, list options as numbered text in your message and let the user respond with a number or free text. This is documented in CLAUDE.md AI Notes. No exceptions, ever, for any project.

## Documentation updates treated as afterthought, not part of the task (2026-03-13)

**What went wrong:** After fixing 8 review findings (kebab hint, pull-to-refresh, ML retry, transaction deletion, etc.), committed and pushed the code changes without updating TODO.md (remove completed items, add deferred items) or HISTORY.md. User had to explicitly ask "everything documented in TODO that was deferred?" to trigger the doc updates.

**Why it happened:** Treated documentation as a separate cleanup task instead of an integral part of each fix. The mental model was "fix → commit → docs later" instead of the correct "fix → update docs → commit."

**How to prevent it:** Documentation updates are part of the task, not a follow-up. Before committing any fix batch:
1. Update TODO.md — remove completed items, add any deferred findings
2. Update HISTORY.md — record what was done
3. Then commit everything together
This is explicitly documented in CLAUDE.md Documentation section: "Update them as you work — don't wait for the user to ask."

## Deleted entire UI instead of migrating it (2026-03-04)

**What went wrong:** User asked to clean up deprecated type tags and legacy hacks. Instead of removing the `@deprecated` annotations and fixing the code properly, deleted 25 files — every view, engine, and component that used the old types — leaving the app as an empty shell with only workspace CRUD. The workspace list detail tabs, import wizard, export/import, and all comparison views were gone.

**Why it happened:** Misinterpreted "clean all of it up completely" as "delete everything legacy" rather than "remove the hacks and do it right." Took the lazy path of deletion instead of the correct path of migration. Failed to consider that the UI is the product — removing it leaves nothing.

**How to prevent it:** "Clean up" means fix, not delete. Before deleting any user-facing code, ask: what replaces it? If the answer is "nothing" or "a placeholder," that's wrong. The correct approach was to either (1) build the new Phase 4 single-screen UI first, then delete the old views, or (2) migrate the existing views to work with the new Transaction model. Never delete working features without building their replacement first.
