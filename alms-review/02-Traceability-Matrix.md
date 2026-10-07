# Traceability Matrix

Ratings: **Implemented**, **Partial**, **Missing**, **Contradicted**. "Before" is the 5.5 code as received; "Now" is 5.6.0.
Confidence: **Confirmed** (traced and run in tests), **Likely** (strong indirect evidence), **Unverified**.

| ID | Claim | Before | Now | Confidence | Evidence (file:line) | Notes |
|---|---|---|---|---|---|---|
| C1 | Evidence-based readiness forecast before the final | Implemented | Implemented | Confirmed | shared/analytics.ts:290 `computePrediction` | Appears after the first graded check or activity. |
| C2 | Forecast uses assessments, objective gaps, pace, applied work, trends | Partial | Implemented | Confirmed | analytics.ts:316-330 (rubric scores), :375 (objective scores), engagement weight in pass confidence | Applied work previously meant "submitted", not quality (finding S-01). Trends are first-attempt vs best, not a time series. |
| C3 | Likely performance range | Missing | Implemented | Confirmed | analytics.ts:396 `range` | Range is about plus or minus 20 points with little evidence, 3 once the final is in. Test: tests/adaptivity.test.ts "limited evidence". |
| C4 | Presented as an estimate; says when evidence is too limited | Partial | Implemented | Confirmed | analytics.ts:398 `evidenceNote`; src/learner/ProjectedGrade.tsx; widgets.tsx | Header showed a single grade after one quiz (S-05). |
| C5 | Continuous individualized feedback tied to evidence | Partial | Implemented | Confirmed | analytics.ts:720 `computeRecommendations`, :768 | Weak applied work produced no feedback (S-02). |
| C6 | Different learners get different recommendations | Implemented | Implemented | Confirmed | tests/adaptivity.test.ts "differential response" | Five profiles, five different outputs. |
| C7 | Issue, why it matters, what to do now | Partial | Implemented | Confirmed | shared/types.ts `Recommendation.why`; analytics.ts:745, :759 | `why` field added and shown as "Why it matters" (M-01). |
| C8 | Route shows completed, in progress, remaining, blocked, next | Implemented | Implemented | Likely | src/learner/StepsNav.tsx:30, :131 (locked final) | "Blocked" is shown only for the final assessment lock. |
| C9 | Route adapts to offering structure | Missing | Missing | Likely | shared/types.ts `Course` has no offering type | Open (S-09). Confirm the intended behavior in the Overview. |
| C10 | "What's Next" is the single highest-value action | Implemented | Implemented | Confirmed | analytics.ts:549 `computeNextStep` | Persona C gets "Strengthen" before new content; persona E gets the final. |
| C11 | Notifications specific, decision-linked, low volume | Implemented | Implemented | Likely | server/services.ts:182 `generateNudges` (de-duplicated by key) | Frequency over weeks not simulated; see 05. |
| C12 | Completion, comprehension, mastery, readiness are separate | Implemented | Implemented | Confirmed | shared/metrics.ts:52 weights; :177 | Test "signal separation". |
| C13 | Comprehension from checks, objective-tagged and scenario questions | Implemented | Implemented | Confirmed | metrics.ts:52 (45 / 25 / 30) | |
| C14 | Mastery from applied work, scenarios, cumulative assessment | Partial | Partial | Confirmed | metrics.ts:52 (30 / 45 / 25) | No simulations exist; decision scenarios are multiple-choice items. |
| C15 | Mastery never from completion, views, or time | Implemented | Implemented | Confirmed | metrics.ts:177-215 | Test adds study days; mastery unchanged. Readiness does use engagement (allowed: pace). |
| C16 | Objective-level scoring before course roll-up | Implemented | Implemented | Confirmed | metrics.ts:177 (per-objective parts, then mean) | |
| C17 | Developing, proficient, mastered thresholds per course | Missing | Missing | Confirmed | shared/analytics.ts:105 `topicState` fixed 60/80/90 | Open (M-06). |
| C18 | Every risk signal connects to a recommendation | Contradicted | Implemented | Confirmed | analytics.ts:821, :840 `advice`; src/staff/Cohort.tsx | Risks were computed but never shown (S-04). |
| C19 | Applied work evaluated with rubrics, not submission alone | Contradicted | Implemented | Confirmed | analytics.ts:316; server/routes/staff.ts rubric PDF scoring | Forecast scored any submission as 100% (S-01). |
| C20 | Program teams see objective difficulty, activity effectiveness, momentum loss | Implemented | Implemented | Likely | server/routes/staff.ts metrics route (objectives, rubrics, stalled learners) | |
| C21 | Partners see completion, comprehension, mastery, readiness | Missing | Missing | Confirmed | shared/types.ts:4 `Role = 'learner' \| 'instructor'` | Open (S-08). |
| C22 | Forecast and item quality can be calibrated against outcomes | Partial | Implemented | Confirmed | server/routes/learner.ts final submit (`forecastLog`); staff metrics `forecast` | Item quality (percent correct per item) existed; forecast logging added (M-02). |

**Summary now:** 17 Implemented, 2 Partial (C8 blocked states limited, C14 no simulations), 3 Missing (C9, C17, C21), 0 Contradicted.
