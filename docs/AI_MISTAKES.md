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

**How to prevent it:** Every `setTimeout`, `setInterval`, `addEventListener`, or `subscribe` in a component setup needs a corresponding cleanup in `onUnmounted`. Track timeout IDs in an array and clear them all on unmount. See CLAUDE.md Implementation Patterns (Source of Truth) for the pattern.

## Documentation not updated after renames and migrations (2026-03-02–03)

**What went wrong:** After renaming Budget→Workspace (v4 migration) and category→tags (v5 migration), several documentation files still referenced the old terminology: README.md project structure listed `useCategoryAutocomplete.ts` and `usePWA.ts`, PRODUCT_DEFINITION.md used "budget" throughout and listed dependencies not in the project (ApexCharts, Fuse.js, date-fns, Papa Parse), USER_GUIDE.md still said "Category" for the tag input field.

**Why it happened:** Large cross-cutting renames touch many files. Documentation updates were done for some files but missed others — particularly PRODUCT_DEFINITION.md which is long and wasn't re-read after the rename.

**How to prevent it:** After any rename or migration, grep the entire project for the old term (including docs). Use a checklist: README, PRODUCT_DEFINITION, USER_GUIDE, TESTING_GUIDE, CLAUDE.md, SESSION_NOTES, code comments. Verify the project structure section in README matches actual `ls` output.

## Using AskUserQuestion tool — breaks the session UI (2026-03-04)

**What went wrong:** Repeatedly used the AskUserQuestion tool to present options to the user. The input modal covers the conversation context, gets stuck awaiting input that can't be given, and disrupts the entire session workflow. The user has had to deal with this across multiple sessions.

**Why it happened:** The tool exists so it seemed appropriate. But in practice the UI overlay is broken — it blocks context, hangs, and forces session restarts.

**How to prevent it:** NEVER use the AskUserQuestion tool. This is a hard rule. If you need user input, list options as numbered text in your message and let the user respond with a number or free text. This is documented in CLAUDE.md AI Notes. No exceptions, ever, for any project.

## Documentation updates treated as afterthought, not part of the task (2026-03-13)

**What went wrong:** After fixing 8 review findings (kebab hint, pull-to-refresh, ML retry, transaction deletion, etc.), committed and pushed the code changes without updating TODO.md (remove completed items, add deferred items). User had to explicitly ask "everything documented in TODO that was deferred?" to trigger the doc updates.

**Why it happened:** Treated documentation as a separate cleanup task instead of an integral part of each fix. The mental model was "fix → commit → docs later" instead of the correct "fix → update docs → commit."

**How to prevent it:** Documentation updates are part of the task, not a follow-up. Before committing any fix batch:
1. Update TODO.md — remove completed items, add any deferred findings
2. Then commit everything together
This is explicitly documented in CLAUDE.md Documentation section: "Update them as you work — don't wait for the user to ask."

## Build verification didn't match CI pipeline (2026-03-30)

**What went wrong:** Dark mode implementation passed local build checks but failed on Vercel. The CI runs `vue-tsc -b && vite build` (from `npm run build`), but the verification used `./node_modules/.bin/vite build` directly — which skips TypeScript strict checking. An unused `onUnmounted` import in `useDarkMode.ts` caused `TS6133` on CI.

**Why it happened:** Two compounding errors: (1) Build check used the wrong command — `vite build` instead of `npm run build` — so `vue-tsc` never ran. (2) The cleanup audit agent used manual code reading to check for unused imports instead of running the actual type checker, and missed the unused import.

**How to prevent it:** Always run `npm run build` (the same command CI uses), not `vite build` directly. For unused import detection, run `vue-tsc --noEmit` — visual inspection is unreliable for `TS6133`. Check `package.json` scripts to understand what CI actually executes before choosing a build verification command.

## Replaced branded status bar color with page backgrounds (2026-03-30)

**What went wrong:** The dark mode implementation replaced the branded PWA theme-color (`#10b981`, brand green) with generic page background colors (`#f9fafb` light / `#14142a` dark) in `<meta name="theme-color">` tags and the `useDarkMode.ts` constants. This caused the status bar to lose its branded appearance and created a visibility problem: if the phone's OS color scheme differed from the app's theme, status bar text (time, battery, wifi) could become invisible — light text on a light background, or dark text on a dark background.

**Why it happened:** Followed the glow-props pattern too literally. The glow-props docs say "values should match your palette" and show surface colors as examples — but the intent is theme-appropriate colors, not necessarily page backgrounds. The status bar is a branding surface, not a content surface.

**How to prevent it:** Meta theme-color values must provide sufficient contrast for status bar text (time, battery, wifi icons) in both light and dark OS modes. With DaisyUI, meta colors are computed from the active theme's oklch values (primary for light themes, base-100 for dark themes) — defined per-combo in `src/config/themes.ts`. Don't use page background colors — they cause visibility problems when the OS color scheme differs from the app's theme. Test by asking: "If the OS is in opposite color scheme from the app, will the status bar text be readable?"

## Fetched wrong source, then built 107 phases on wrong foundation (2026-04-08)

**What went wrong:** User asked to "get the full step by step todos from glow-props for this repo." The actual source is `docs/TODO.md` in glow-props, which has a budgy-ting section with 25 specific items. Instead, fetched the 8 implementation pattern docs (`docs/implementations/*.md`) and exploded them into 107 granular phases — none of which matched what glow-props actually tracks.

**Why it happened:** Assumed "todos" meant the implementation patterns rather than checking if glow-props has an actual TODO file. Found both the patterns and `docs/TODO.md` during the repo listing but chose the wrong one without asking. Then compounded the error by building an entire analysis workflow on the wrong foundation across multiple "next" cycles without ever verifying the source was correct.

**How to prevent it:** When told to fetch something from an external repo, find the actual file first and confirm it's the right one before proceeding. If multiple candidates exist (patterns vs TODO.md), show what was found and ask which one is meant. Don't assume.

## Kept going despite repeated instructions (2026-04-08)

**What went wrong:** User pasted the same multi-step plan 5+ times across the session. Each time, the AI acknowledged it but continued the same wrong approach — analyzing all 8 pattern docs, creating 107 phases, running codebase exploration agents — instead of stopping to re-read and course-correct.

**Why it happened:** Once committed to the wrong interpretation, each "next" from the user was treated as approval to continue the current approach rather than a prompt to re-check the plan. The AI prioritized momentum over accuracy.

**How to prevent it:** When a user repeats instructions, that's a signal something is wrong — not a signal to keep going. Stop, re-read the instructions literally, and check if the current approach actually matches what's being asked. If the user has to paste the same instructions more than once, the AI has already failed.

## Over-expanded scope instead of showing raw source (2026-04-08)

**What went wrong:** Step 1 of the plan was "show me the result" — meaning show the raw glow-props items as-is. Instead, produced thousands of lines of formatted analysis, pattern summaries, and comparison tables. Step 2 was "break into smaller phases, no analysis" — instead ran Explore agents against the codebase and wrote status assessments for every item.

**Why it happened:** Default behavior is to add value by analyzing and expanding. The user explicitly said "no analysis, no codebase exploration, no opinions" but the AI treated those as soft guidelines rather than hard constraints.

**How to prevent it:** When instructions say "just show the raw items" or "no analysis," output only the source material. Don't reformat, summarize, compare, or assess. When instructions say "no codebase exploration," don't spawn agents or read project files. Treat explicit constraints as absolute.

## Created todos before agreeing on phases (2026-04-08)

**What went wrong:** Started creating TodoWrite entries during the analysis step, before the user had reviewed or approved the phase breakdown. By the time the user saw the phases, there were already 107 todo items committed.

**Why it happened:** The plan said "create proper todos with success measures" as a later step, but the AI jumped ahead and created todos during the analysis step to appear productive.

**How to prevent it:** Follow the plan's step order literally. Don't create todos until the step that says "create todos." Don't start implementation during planning. Each step has a gate — the user's "next" — and no work from a later step should bleed into an earlier one.

## Did not stop between steps (2026-04-08)

**What went wrong:** The plan has clear gates: "show result → break into phases → analyze → create todos → execute." The AI blurred these boundaries — analysis started during the phase breakdown, todos were created during analysis, and the execution mindset was present from step 1.

**Why it happened:** The AI optimizes for throughput and tries to batch related work. The user's plan deliberately separates steps to maintain control and catch errors early. These goals conflict, and the user's plan should win.

**How to prevent it:** After completing each step, output the result and stop. Don't preview the next step. Don't prepare for it. Don't "get ahead." Wait for the explicit go-ahead. The user's workflow is: review output → decide → approve next step. Skipping the review window removes the user's control.

## Deleted entire UI instead of migrating it (2026-03-04)

**What went wrong:** User asked to clean up deprecated type tags and legacy hacks. Instead of removing the `@deprecated` annotations and fixing the code properly, deleted 25 files — every view, engine, and component that used the old types — leaving the app as an empty shell with only workspace CRUD. The workspace list detail tabs, import wizard, export/import, and all comparison views were gone.

**Why it happened:** Misinterpreted "clean all of it up completely" as "delete everything legacy" rather than "remove the hacks and do it right." Took the lazy path of deletion instead of the correct path of migration. Failed to consider that the UI is the product — removing it leaves nothing.

**How to prevent it:** "Clean up" means fix, not delete. Before deleting any user-facing code, ask: what replaces it? If the answer is "nothing" or "a placeholder," that's wrong. The correct approach was to either (1) build the new Phase 4 single-screen UI first, then delete the old views, or (2) migrate the existing views to work with the new Transaction model. Never delete working features without building their replacement first.
