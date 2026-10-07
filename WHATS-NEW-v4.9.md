# USAII Intuitive LMS — v4.9 (sandbox-ready)

## Feedback: the recommendation question
Below **Rate the USAII® LMS**, the learner is now asked:

> **Would you recommend USAII® Courses to others?** — Yes / No

One tap, answered instantly, and changeable at any time. It is stored as its own answer, not derived from a star rating.

**The administrator's Overview now uses it properly.** "Learners Who Would Recommend USAII®" takes each learner's explicit Yes/No where they have given one, and falls back to their star rating (four or more counts as a yes) where they have not. "Ease of Knowing the Next Step" uses star ratings only, since a Yes/No vote carries no score. One learner is still one voice, so the figure can never exceed the learner count.

## Live Help is gone; Live Sessions replaces it
- **Learners** now have **Live Sessions** in the sidebar: every session their instructor has scheduled for them, with a **Register** button so they claim their own place. Registering saves their spot and they are reminded before it runs.
- **Instructors** no longer have a separate Live Help page. **Live Learning** is the one place they schedule from: title, host, date and time, length, meeting link, and the named learners invited.
- **A session scheduled through Live Learning appears on the Live Sessions page of every learner invited to it** — verified end to end, including that a learner who was *not* invited cannot see it.
- **Administrators** keep **Review Live Sessions**.

## Review Live Sessions: attendance behind a button
Attendance lists can be long, so the card now shows a **"Who Attended (n)"** button instead of a wall of names. It opens a roster with two tabs — **Attended** and **Did not attend** — a scrolling list, and a name/email filter that appears once there are more than eight people. Each row shows the learner's name and email.

## Verified before release
Twelve live end-to-end checks, all passing:

1. Course star rating saves
2. LMS star rating saves
3. Recommendation "Yes" saves
4. Recommendation "No" saves from a second learner
5. An invalid recommendation payload is rejected with a clear message
6. The administrator's metric reads 1 recommend of 2 voters, within 3 learners — no overflow
7. A Live Learning session is created with a named invitee
8. The invited learner sees it on Live Sessions
9. A learner who was not invited cannot see it
10. Self-registration records the learner's place
11. The reminder reaches exactly the invited learner
12. The administrator's Review Live Sessions lists it

Type-check clean, production build clean.

## Running it
`START.bat` on Windows, or `./start.sh`. For a hosted sandbox, use `npm run prod`, which builds the optimized bundle and serves it — noticeably faster than the development server for anyone connecting over a network.
