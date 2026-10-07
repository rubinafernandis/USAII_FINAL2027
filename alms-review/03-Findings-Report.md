# Findings Report

Each finding: what was found, why it matters, evidence, the fix, effort, and status. Line numbers refer to 5.6.0.

## Serious

### S-01 Forecast gave full marks for any submitted activity (Fixed)
- **Claims:** C19, C2, C15
- **What we found:** `computePrediction` scored "Applied activities" as submitted divided by started, so a poor submission counted as 100%. Confirmed.
- **Why it matters:** Learners with weak applied work were told they were on track, contradicting the rubric-based promise.
- **Evidence:** 5.5 `shared/analytics.ts`: `[doneWithActivity ? (submitted / doneWithActivity) * 100 : null, w.activities]`
- **Fix:** Rubric scores drive the activity component; unscored work is pending, not 100% (analytics.ts:316-330). Courses with no rubric fall back to submission and are labelled "(submitted)". Test: "applied work is graded by rubric score".
- **Effort:** Small

### S-02 Weak applied work produced no guidance (Fixed)
- **Claims:** C5, C6
- **What we found:** Running persona A (quizzes 100%, rubric 30%) returned zero recommendations. Recommendations only looked at quiz scores. Confirmed by running.
- **Why it matters:** The learners who most need help applying ideas got silence.
- **Fix:** The two weakest rubric-scored activities (below 60%) produce focused recommendations (analytics.ts:768), plus an instructor risk signal.
- **Effort:** Small

### S-03 "Low chance of passing" raised from one or two quizzes (Fixed)
- **Claims:** C4
- **What we found:** Persona D (one quiz at 67%) and persona B (two perfect quizzes, inactive) were flagged as low chance of passing.
- **Fix:** The pass-chance risk is only raised once evidence is "solid" (analytics.ts:850).
- **Effort:** Small

### S-04 Risk signals were computed but never shown (Fixed)
- **Claims:** C18, C20
- **What we found:** `computeRisk` factors were used only to sort the Cohort table and count "needs support". No screen listed them, and they had no suggested action. Confirmed by search across `src/`.
- **Fix:** Every factor has an `advice` field (analytics.ts:840 onward). Cohort rows show "Needs support" or "Watch" with each signal and its next step.
- **Effort:** Small

### S-05 Forecast looked certain after one quiz (Fixed)
- **Claims:** C3, C4
- **What we found:** The header showed a single grade such as "82% (B)" as soon as one quiz was taken.
- **Fix:** Likely range plus an evidence note ("Early estimate from 10% of your graded work...") on the header and dashboard.
- **Effort:** Small

### S-06 Uploaded files could run as web pages on the LMS origin (Fixed)
- **What we found:** The stored extension came from the user's filename and the type check trusted the browser-sent MIME type; SVG was allowed. A learner could upload `x.html` labelled as an image; an instructor opening it would run its script with the instructor's session. Confirmed by test.
- **Fix:** Extension allowlist, SVG blocked, non-media files served as downloads with a sandbox policy (server/routes/uploads.ts, server/index.ts).
- **Effort:** Small

### S-07 Published, weak sign-in passwords (Fixed)
- **What we found:** `Learner@2026` and `Instructor@2026` on the sign-in page, in the README, and printed at start-up; an 8-character password rule; sessions not ended on password change; lockout by email only.
- **Fix:** Unique 18-character test passwords kept in TEST-CREDENTIALS.md only; 12-character mixed rule; sessions end on password change; lockout by account and network address with growing waits; production generates random passwords. Existing data upgraded in place.
- **Effort:** Medium

### S-08 No partner view (Open)
- **Claims:** C21
- **What we found:** Only learner and instructor roles exist (shared/types.ts:4).
- **Why it matters:** A headline enterprise capability cannot be demonstrated.
- **Fix:** Add a read-only `partner` role scoped to an organization, with a cohort dashboard of completion, comprehension, mastery, and readiness. Reuse the Cohort and Metrics endpoints with organization filtering.
- **Effort:** Large

### S-09 Route does not adapt to offering type (Open)
- **Claims:** C9
- **What we found:** No course type field; every course uses Learn, Check, Apply, Reflect per lesson. Likely missing; confirm the intended design in the Overview.
- **Fix:** Add `offering: 'micro-credential' | 'certification' | 'pathway'` to Course and vary step labels (days vs. modules), pacing defaults, and the final gate.
- **Effort:** Medium

## Medium

| ID | Title | Claim | Status | Fix or recommendation | Effort |
|---|---|---|---|---|---|
| M-01 | Recommendations lacked "why it matters" | C7 | Fixed | `why` field on every recommendation, shown to learners | Small |
| M-02 | No forecast-vs-outcome log | C22 | Fixed | `forecastLog` at each final attempt; accuracy tile in Activity Metrics | Small |
| M-03 | Final time limit not checked on submit | Integrity | Fixed | Server rejects submissions after the limit plus 60 s | Small |
| M-04 | Tabs not announced to screen readers | WCAG 4.1.2 | Fixed | `role="tablist"`, `role="tab"`, `aria-selected`, arrow keys | Small |
| M-05 | Learner saw stale results after instructor review | C5 | Fixed | Data refreshes on entering a lesson and on returning to the tab | Small |
| M-06 | Proficiency thresholds fixed for all courses | C17 | Open | Add `thresholds` to Course; use in `topicState` (analytics.ts:105) and metric bands | Medium |
| M-07 | Dates and text hard-coded to US English | i18n | Open | `fmtDate` uses `'en-US'` (src/lib/format.ts:4); move UI strings to a message catalog and use the browser locale | Large |
| M-08 | Session token in browser storage | Privacy | Open | Use an HttpOnly, Secure, SameSite cookie | Medium |
| M-09 | Uploaded files reachable by anyone with the link | Privacy | Open | Serve learner files through an authenticated route; random names reduce but do not remove risk | Medium |
| M-10 | Paid courses joinable without payment | Business | Open | Add checkout before enrolment when price is above zero | Medium |
| M-11 | Single JSON file database | Scale | Open | Move to PostgreSQL via `server/db.ts` before multi-instance hosting | Large |
| M-12 | Readiness includes study engagement (15%) | C15 | Accepted | Allowed for readiness (pace), never used for mastery; documented | n/a |

## Minor

| ID | Title | Status | Note |
|---|---|---|---|
| N-01 | Main app bundle about 1.3 MB | Open | Split routes with dynamic imports |
| N-02 | Transcript panel showed only two lines | Fixed | Controls moved to header icons |
| N-03 | Rubric PDF scrolled out of view during review | Fixed | Equal-height columns |
| N-04 | Terms differ: "Projected grade" (learner) vs "Predicted Score" (Cohort) | Open | Use one term everywhere |
| N-05 | No self-service password reset for instructors | Open | Add an admin reset or email link |
| N-06 | Some metric bars rely on color | Open | Text legends exist; add patterns or values on the bars |
