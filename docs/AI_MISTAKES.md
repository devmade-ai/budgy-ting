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
