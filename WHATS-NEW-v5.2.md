# What's new in USAII Intuitive LMS 5.2

## 5.2: a simpler Your Journey, built only from course data

**Your Journey** is now one clean list of what you have done in a course, newest first.
- **At the top:** course picker, Days in this course, Time invested.
- **Filters:** All, Lessons, Activities, Feedback on activities, plus one **Download my work (PDF)** button.
- **Each entry:** a completed lesson, a submitted activity (Read), the instructor's decision with their note (Revise and resubmit when needed), the final assessment, or the certificate.
- **Removed:** chapters, stage names, the Playbook panel, and the progress counters.

**Everything builds itself from Course Builder.** Your Journey, Steps to Completion, and the Study Guide viewer now use only what an instructor enters: course title, module and lesson titles, minutes, activity titles, the final assessment, and the certificate name.
- They no longer guess from wording such as "Day 1:" in titles, "FRAME ·" in module names, or "Playbook" in descriptions.
- Steps are labeled Module 1, Lesson 1, and so on, with the titles as entered.
- Any course an instructor publishes gets complete pages with no extra setup.

**For instructors,** Activity Metrics now says "Downloaded their own work", and the steps chart reads Lesson 1, Lesson 2, and so on. Downloads recorded by 5.0 and 5.1 are still counted.

---

# 5.1

## 5.1: activity reviews and a simpler Your Journey

**Reviewing activities (instructors).** On **Assessments**, **Activity submissions** is now the first tab.
- **Filters:** course (or all your courses), status (Awaiting review, Approved, Resubmission requested, Not approved) with counts, and a learner search.
- **Rows** show only the learner, the course, and the assessment submitted.
- **View Assessment** opens the work with **Feedback on activity** and three buttons: **Approve**, **Request resubmission**, **Not approved**. A note is required for the last two, so learners always know what to change.
- **Fixed:** the old Send feedback button stayed grayed out until something was typed, so it looked broken. The new buttons always respond, and they show a clear message if a note is missing.

**What the learner sees.**
- The decision appears on the activity itself (Approved, Resubmission requested, or Not approved), with the note and a **Revise and resubmit** button when needed.
- The learner gets a notification that opens straight on the activity.
- **When they resubmit:** the review starts fresh as Awaiting review, the earlier decision and note are kept, and the instructor is notified.

**Your Journey.**
- A filter bar at the top: choose the course, then see **Days in this course** and **Time invested**, each with a proper heading.
- Removed: the subtitle lines and the Playbook-pieces and milestones counters.
- Instructor feedback is now labeled **Feedback on activities** and shows each decision clearly.

---

# 5.0

Built on 4.9.2. Everything not listed here works exactly as before.

## For learners

**View Study Guide.** On **Learning → About this course**, a **View Study Guide** button now sits next to **Download Study Guide (PDF)**, which stays as it was. It opens the whole guide inside the LMS as a formatted Markdown document:
- Opens at the lesson you are on; a contents list shows what you have finished.
- Keeps a Download PDF button at the top.
- Esc closes it and returns you to exactly where you were.

**Steps to Completion** (per course).
- **In the sidebar**, after Explore Courses: a collapsible list of every step with a "3/10" badge and a checkmark as each one is finished. It opens by itself on learning pages and remembers when you close it. A step finished while you are there gets a small checkmark animation.
- **As a page:**
  - How to earn the certificate: three rules, then one animated path through every step.
  - Each step lists exactly what it takes, with a **Go** button for anything left.
  - The top shows steps left, time left, projected finish date, and a Continue button.

**Your Journey** (per course, with a tab for each course). Your story in the course: a look back, not a to-do list.
- Four numbers: days since you started, time invested, Playbook pieces built, milestones reached.
- Chapters (FRAME, RUN, TRUST, Finish): tap one to filter the story.
- Filters: Everything, Days finished, What I built, Feedback, Milestones.
- A dated timeline: finished days (with time spent, how sure you felt, and your own reflection), what you built, instructor feedback, chapters completed, the final, and the certificate.
- Your Playbook beside it: open any piece you built, or **Download my Playbook (PDF)**.

**Give Feedback** now asks: "Would you recommend USAII® to others?"

**Sign-in page:** the redundant "Sign In" title above the role tabs is gone; the button already says "Sign in as Learner." Only two roles are shown: Learner and Instructor.

## For instructors

**Activity Metrics** gains three sections, each tracking something new on the learner side:
- **Where learners are on Steps to Completion:** learners per step, plus how many have not moved in 7 days.
- **Study Guide and Playbook:** who opened the Study Guide in the LMS, PDF downloads, and Playbook downloads.
- **Learner feedback:** "would recommend USAII®", course and LMS ratings, and recent comments. These were visible only to the administrator before.

## Removed

- **The administrator role, completely:** the account, Overview, Users, Review Live Sessions, Ask Admin, and the admin server routes.
  - Notifications now go to the course's instructor.
  - Messages that sent people to "the administrator" now point to their instructor.
- **Live sessions, everywhere:**
  - The Live Sessions and Live Learning pages, the dashboard prompt, the recommendation, the reminder alerts, and the "Live sessions attended" tile (now "Study streak").
  - Session attendance also no longer counts toward engagement.
- **Course prices** can no longer be edited, since only the administrator could set them. Existing courses keep their price; new courses are free.

## Upgrading

Start 5.0 on the same folder as 4.9. The first start updates your data automatically:
- **Kept:** every learner, enrollment, course, and piece of work.
- **Removed:** administrator accounts, live-session records, and their alerts.
- **Reassigned:** any course the administrator owned passes to an instructor.

## Verified before release

1. Type check and production build pass.
2. The administrator login is rejected, and the old admin and live-session routes return 404.
3. A 4.9 database upgrades cleanly: 3 learners and 6 enrollments kept; admin, live-session data, and their alerts removed; the admin-owned course reassigned.
4. Study Guide views are counted once per 30 minutes; unknown event types are rejected.
5. Activity Metrics returns the steps, resources, and feedback sections.
6. Every new screen opens with no browser errors, on desktop and on a phone-sized screen.
