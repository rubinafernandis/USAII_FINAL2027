# USAII aLMS Code Review: Executive Summary

**Version reviewed:** USAII Intuitive LMS 5.6.0 (5.5 plus the new transcript, instructions, and rubric PDF features)
**Review date:** 7 October 2026
**Specification:** The Executive Overview PDF was not supplied. The 22 claims (C1 to C22) in the review brief were used as the specification. Claims that may exist only in the Overview are not covered.
**Method:** Code tracing of every claim, plus running the code: 23 unit tests, 9 adaptivity tests (five learner profiles through the real engine), 19 API tests on a live server, and 32 browser checks in Chromium on desktop and phone. All 83 pass on the final code.

> Note on the read-only rule: the brief asks reviewers not to modify code. The product owner asked for the issues to be fixed as well, so each finding below records what was found **and** what was changed. Findings marked Open were not changed.

## Verdict in plain language

**Adaptivity: real, and now honest.** The engine is rule-based and deterministic: the same evidence always gives the same guidance, and no recommendation, forecast, or "next step" is hardcoded or invented by AI. Five very different learners received five clearly different next steps and recommendation sets (see file 04). Mastery is built from rubric-scored applied work and final scenario items, never from time spent, page views, or completion.

Before this review, three things undermined that: the grade forecast gave full marks for any submitted activity regardless of quality; a learner with strong quiz scores but weak applied work got no guidance at all; and one quiz could produce an authoritative "low chance of passing" warning. All three are fixed and covered by tests.

**Intuitiveness: good for learners, improving for instructors.** Every learner page shows where they are and one next step. Risk signals were computed but never shown to instructors; they now appear on Cohort with a suggested action for each.

**Not yet delivered:** a partner (enterprise or academic) view (C21), route differences by offering type (C9), and per-course proficiency thresholds (C17).

## Findings by severity

| Severity | Found | Fixed in 5.6 | Open | Accepted as designed |
|---|---|---|---|---|
| Serious | 9 | 7 | 2 | 0 |
| Medium | 12 | 5 | 6 | 1 |
| Minor | 6 | 2 | 4 | 0 |
| **Total** | **27** | **14** | **12** | **1** |

## Top five to address first

1. **S-08 (Open): No partner view (C21).** There are only learner and instructor roles. Enterprise and academic partners cannot see completion, comprehension, mastery, and readiness for their people. Do not claim this capability until it exists.
2. **S-09 (Open): Route does not adapt to offering type (C9).** Courses have no "micro-credential sprint vs. certification module" type; every course uses the same lesson path. Confirm against the Overview and add a course type.
3. **M-06 (Open): Proficiency thresholds are global (C17).** 60, 80, and 90 are fixed in code for all courses. Make them a per-course setting.
4. **M-08 and M-09 (Open): Session tokens in browser storage, uploads reachable by URL.** Move to secure cookies and add access checks on learner files before handling real learner data at scale.
5. **M-10 (Open): Paid courses can be joined without payment.** Add checkout before any course is priced above zero.

## What is working well (claims that can be made with confidence)

- **Separate signals (C12):** completion, comprehension, mastery, and readiness are calculated separately, with documented weights in one file (`shared/metrics.ts`).
- **Objective-level evidence (C16):** each lesson is a learning objective, scored first, then averaged, so one large topic cannot dominate.
- **No mastery from completion (C15):** confirmed by a test that adds study days and shows mastery does not move.
- **Different learners, different guidance (C6) and determinism:** confirmed by running five learner profiles.
- **Honest forecasts (C1, C3, C4):** an estimate appears early, shows a likely range that narrows as evidence grows, and says "Early estimate" or "not a guarantee".
- **Rubric-based evaluation (C19):** instructors evaluate against an uploaded rubric PDF; an optional AI suggestion reads the PDF but the instructor decides.
- **Calibration (C22):** the forecast is now logged at every final attempt and instructors see forecast accuracy.
- **Accessibility and reach:** video transcripts in 130+ languages, including all 22 scheduled Indian languages.

Detailed files: `02-Traceability-Matrix.md`, `03-Findings-Report.md`, `04-Architecture-and-Adaptivity-Map.md`, `05-Focus-Group-Test-Targets.md`.
