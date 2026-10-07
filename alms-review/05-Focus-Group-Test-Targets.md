# Focus Group Test Targets

Behaviors, screens, and edge cases the persona focus groups should probe, based on this review.
Seed data below can be created through Learners & Access and Course Builder, or with the fixture builder in `tests/adaptivity.test.ts`.

## Recommended test account profiles

| Account | Profile | Seed data |
|---|---|---|
| fg.strongknow | Strong comprehension, weak mastery | Days 1 to 6 complete; every check 100%; every activity scored 6/20 |
| fg.behind | Capable but behind pace | Days 1 to 2 complete at 100%, activities 18/20; last study 9 days ago; target date 5 days away |
| fg.oneweak | Weak on one objective | Days 1 to 6 complete; Day 3 check 33%, others 100%; activities 17/20 |
| fg.new | Almost no evidence | Day 1 complete; check 67%; activity submitted, not yet scored |
| fg.final | High performer near the final | All 10 days complete at 100%; activities 19/20; final not started |
| fg.hindi | Hindi speaker, phone user | Browser language hi-IN; 390 px wide device; any progress |
| fg.instructor | Instructor reviewing work | Owns the course; 5 submissions awaiting review, each course activity with a rubric PDF |

## What to probe

### Forecast and readiness (C1 to C4)
1. Does fg.new understand "Early estimate" and a 38-point range? Do they read it as a promise?
2. Does anyone notice the range narrowing as work is graded? Is that reassuring or confusing?
3. Header shows a range, Cohort shows a single "Predicted Score" (N-04). Do instructors and learners talk about the same number?

### Guidance (C5 to C7, C10)
4. fg.strongknow: does "Improve [activity] (rubric 30%)" with "Why it matters" lead them to open the rubric and revise?
5. fg.oneweak: is going back to Day 3 before new content accepted, or does it feel like being held back?
6. Is the single next step always obvious on Dashboard, Learning, and inside a lesson?

### Instructor view (C18 to C20)
7. Do instructors find the "Needs support" details on Cohort, and would they act on the suggested next step?
8. Rubric review: is entering points out of the PDF total faster than the old per-criterion buttons? Do instructors trust or over-trust the AI suggestion?
9. Is the forecast accuracy line in Activity Metrics understood?

### Video transcripts
10. fg.hindi: does the panel open on play as expected on a phone (it stacks under the video)? Is Hindi suggested first?
11. Search in native script (हिन्दी, தமிழ்) and in English. Any language people expected but could not find?
12. Is "Translated automatically. It may contain mistakes." enough of a warning for technical terms?
13. Without an AI key: is the "Open in Google Translate" fallback acceptable?

### Activities
14. Do learners read image-rich instructions fully? Is anything lost compared with numbered steps (sequence)?
15. Do learners open the rubric PDF before submitting? Does it change what they submit?

### Edge cases to try
16. Submit an activity, have it reviewed, and keep the lesson open: the result appears when you return to the tab (fixed M-05). Confirm on a phone.
17. Start the timed final, wait past the limit, then submit: it must be refused (fixed M-03).
18. Instructor replaces the rubric PDF after some scores: learners' past scores must still show the old rubric name.
19. Instructor edits a transcript: earlier translations must be replaced, not shown stale.
20. Try a wrong password six times, then the right one: the wait message must be clear.

### Accessibility (WCAG 2.2 AA)
21. Keyboard only: tabs with arrow keys, language list (type, Enter, Escape), transcript lines, review modal.
22. Screen reader: transcript panel landmark, active line announcement, rubric score.
23. Color-only meaning on metric bars (N-06).
