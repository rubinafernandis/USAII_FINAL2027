# What's new in USAII Intuitive LMS 5.3

## 5.3: Comprehension and Mastery

Built on 5.2, following Dr. Milton's feedback and his recommendations PDF. Everything not listed here works as before.

### The two metrics

| Metric | Meaning | Evidence (recommended weight) |
|---|---|---|
| **Comprehension** | How well the learner understands the concepts, principles, terminology, and appropriate choices. | End-of-lesson knowledge checks (45%) · Scenario-based judgment questions (25%) · Final assessment, knowledge items (30%) |
| **Mastery** | How well the learner can apply them in a realistic workplace decision, task, or scenario. | Comprehension score (30%) · Applied activities scored against a rubric (45%) · Final scenario-based items (25%) |

- **Per learning objective first.** Each lesson is one learning objective. Both metrics are calculated per objective, then averaged, so an easy topic with many questions cannot outweigh the others. Final questions not linked to a lesson form one "Whole course" objective.
- **Missing evidence.** When an objective has no evidence of one kind yet, that weight is shared by the evidence it does have.
- **What never counts:** lessons opened, videos watched, time on a page, logins, clicks, simply submitting an activity, and viewing the Study Guide. Completion stays a separate metric.
- **No misleading 0%.** Until a learner has two scored checkpoints, learners see "Comprehension: Not measured yet" and "Mastery: Building evidence". Mastery also needs a measured Comprehension and at least one piece of applied evidence.
- **Scored checkpoints** are a graded lesson check, a rubric-scored activity, or a final assessment attempt.
- **Which attempts count.** Lesson checks are open book with instant feedback, so the first and most recent graded tries count equally. On the final assessment, the most recent attempt counts. Practice attempts after the last graded attempt never count.
- **Resubmissions.** An activity's latest scored version counts until a newer version is scored.
- **Weights** live in one place, `shared/metrics.ts` (`METRIC_WEIGHTS`), if USAII revises the model.

### For learners
- **My Learning:** "Mastered" is removed. Each lesson shows progress only (Completed, In progress, Not started). Comprehension and Mastery appear **only on My Learning**, in a compact strip beneath the course title, each with an information icon showing the two-sentence explanation.
- **My Progress and Dashboard:** unchanged from 5.2, except that the topic state "Mastered" is now "Strong".
- **Activities:** learners see what their work is checked for before submitting, and after review, whether each criterion was Met, Partially met, or Not met.
- **Steps to completion:** completed steps are no longer struck through. The green check mark shows they are done.
- **Give Feedback:** the one-tap question now reads "Would you recommend USAII® Courses to others?" and is always the last item on the page. "Rate the USAII® LMS" keeps its own required question, "Would you recommend USAII® to others?", which is stored and reported separately.
- **Wording:** "Mastered" is renamed "Strong" in the skill tree and topic statuses. "Mastery" and "Comprehension" are used only for the two metrics.

### For instructors
- **New page: Comprehension & Mastery.**
  - Class averages, how many learners are measured, and distribution against the pass mark.
  - Class average for each kind of evidence.
  - A learner table showing what each learner needs: "Finished, needs practice", "Needs work on concepts", "Understands, needs application", "Building evidence", or "On track".
  - Results by learning objective and for each rubric criterion.
  - Percent correct for each final assessment item.
  - An Assessment design check.
- **Cohort:** unchanged. Comprehension and Mastery averages live only on the Comprehension & Mastery page.
- **View Assessment:** score each rubric criterion as Met, Partially met, or Not met. Scores are required to Approve or mark Not approved, and optional for Request resubmission. The list shows "Rubric not scored yet" where needed.
- **Course Builder:**
  - Every question is tagged **Knowledge** or **Scenario judgment**.
  - Final assessment questions choose the **learning objective** they assess.
  - Activities get a **rubric criteria** editor, with what "Met" looks like for each criterion.
  - A **Comprehension and Mastery readiness** panel warns about missing evidence, for example an activity without criteria, which then counts toward progress only.

### Data
- **Seeded courses.** Both USAII courses ship with question types, final question objectives, and rubrics for all 18 activities. The Day 2 use-case list uses the five recommended criteria.
- **Upgrading.** Existing databases update automatically from version 5 to 6. Learner records are untouched, and only missing design is filled in. Older attempts are read from their answers, but only when they still reproduce the recorded score.
- **Scoring records.** Each new attempt records what every question measured. Rubric criteria are copied into each score, so later course edits never change past results.

### How an activity review works (three steps in View Assessment)
1. **Score the rubric.** Rate each criterion as Met, Partially met, or Not met. This measures the quality of the work and becomes the learner's **Mastery** evidence.
2. **Write feedback.** Say what works and what to change. A note is required for Request resubmission and Not approved.
3. **Decide.**
   - **Approve** means done.
   - **Request resubmission** means revise and send again.
   - **Not approved** means not accepted, but the learner can still revise.

The decision tells the learner what happens next. The scores do not change the decision, and the decision does not change the scores. If they contradict each other, the LMS asks the instructor to confirm first:
- Approving while a criterion is Not met.
- Marking Not approved while every criterion is Met.

The learner sees the decision, the note, and the result for each criterion.

## Learner feedback: everything is stored and shown to instructors

### Where learners give feedback
| Where the learner answers | What is stored |
|---|---|
| Give Feedback · **Rate My Course** | Stars (1 to 5), comment, course |
| Give Feedback · **Rate the USAII® LMS** | Stars (1 to 5), comment, and "Would you recommend USAII® to others?" Yes or No (required) |
| Give Feedback · **Would you recommend USAII® Courses to others?** | Yes or No (last item on the page) |
| My Learning · **quick check-in** | "Would you recommend this course?" Yes or No, and "How easy is it to know your next step?" 1 to 5, for that course |

### Fixes
- **Check-in no longer deletes feedback.** Sending the check-in removed every earlier answer from that learner, including their star ratings and their Yes or No. Now it replaces only their earlier check-in for the same course.
- **Check-in answers now reach instructors.** They were stored without a type, so no instructor screen showed them. They now appear everywhere. Older entries are updated automatically.
- **Only the latest 5 comments were shown before.** Instructors now see every answer.
- **Star ratings no longer count as a "would recommend" answer.** Each recommend question has its own figure, counted only from real Yes or No answers.

### New for instructors: Learner Feedback (sidebar)
- **Summary:** Would recommend USAII® (% Yes, from the LMS rating), Would recommend USAII® Courses (% Yes), course rating, USAII® LMS rating, and check-in results.
- **Every answer:** learner, where it was given, course, stars, Yes or No, next-step ease, comment, and date.
- **Filters:** tabs for All, With comments, Course ratings, LMS ratings, Would recommend, and Check-ins. A course filter covers all your courses or one course, and search finds learners, courses, or comment text.
- **Export CSV** of whatever is on screen.
- **Staying up to date:** instructors get a notification for each new answer. Insights links to the full page with "View all feedback".
- **Scope:** course ratings and check-ins appear only to that course's instructors. LMS ratings and the recommend question are not tied to a course.

### New for learners
- Give Feedback shows each learner's current rating and current Yes or No answer, so they know a new answer replaces it.

## Dr. Milton's latest review

- **Projected grade, always visible.** A small grade ring now sits at the top right of every learner page.
  - It shows the projected grade and letter for the course the learner is working on, for example "94% (A) · Projected grade".
  - Until the first quiz, it reads "After your first quiz".
  - Selecting it opens My Progress, where "How your grade is made" explains the number.
  - It is the same number as the dashboard tile, which is now also labeled "Projected grade" instead of "Expected grade".
- **"Partly met" is now "Partially met"** everywhere:
  - learner activity results, the instructor's scoring buttons, and the Comprehension & Mastery rubric chart and legend
  - Course Builder hints, and the learner's "View my work"
  - these notes
  Scores are stored as levels (0, 1, 2), so existing scores show the new wording automatically.
- **View first, then download.** Every document now opens in the LMS first, with **Download PDF** inside the viewer. Many learners are on a phone and may never download a file.

  | Before | Now |
  |---|---|
  | Resources: "Study Guide (PDF)" downloaded a file | **View Study Guide** opens the guide in the viewer, with Download PDF at the top |
  | Resources: "Study Plan (PDF)" opened a file | **View Study Plan** opens it in a viewer, with Download PDF and New tab |
  | About this course: "Download Study Guide (PDF)" button | Removed. **View Study Guide** stays, with a note that the PDF download is in the viewer |
  | Your Journey: "Download my work (PDF)" | **View my work** shows everything the learner wrote, with review decisions and criterion results, and Download PDF at the top |

- **Instructor Insights** now also counts **"Viewed their own work"**. Study Guide downloads are labeled as coming from the Study Guide viewer, and work downloads as coming from View my work.

## "How to Navigate the USAII® LMS?" video

> **Changed in 5.4:** the video is no longer bundled with the code. Instructors now add, replace, or remove it from the **Navigation video** button. See `WHATS-NEW-v5.4.md`.

- **The ? button** at the top right now opens a video window instead of the old click-through tour:
  - The heading **How to Navigate the USAII® LMS?** sits at the top, with the video below it.
  - The video is a 3:24 walkthrough of every learner page and button, with a US-English voice-over and captions built into the picture.
- **First visit:** the window opens once automatically, as the tour did. It never plays on its own; the learner presses play.
  - Closing it (X, Esc, or clicking outside) pauses the video, and it won't open on its own again on that device.
  - Instructors previewing a learner's portal never get it automatically.
- **Works on phones:** the video plays inline and streams progressively, so it starts right away. The window fits small screens.
- **Files** are in `public/videos/` and are served from `/videos/`:
  - `how-to-navigate-the-usaii-lms.mp4`: 1080p, web-optimized, 31.6 MB
  - `how-to-navigate-the-usaii-lms.jpg`: the poster frame
  - To update the video later, replace the MP4 with a new file of the same name.
- **The old click-through tour** (`src/learner/Tour.tsx`) has been removed.
