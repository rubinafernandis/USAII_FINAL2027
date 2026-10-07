# USAII Intuitive LMS 5.6

Written in US English. The official USAII logo is `public/usaii-logo.png`.

A learning platform built on the CEO's vision: every learner always knows **where they are, what to do next, and how to improve**, with nothing extra in the way.

## Start it (Windows)

1. Install **Node.js 20 or newer** from https://nodejs.org (the LTS button). You only do this once.
2. Unzip this folder (right-click → **Extract All…**).
3. Open the extracted folder and double-click **`START.bat`**.

The first start installs packages (1–3 minutes, internet needed). The browser then opens by itself on the sign-in page, normally at **http://localhost:4600**. Keep the black window open while you use the LMS; close it to stop.

> **Seeing an old version?** Older prototypes run on port 3000. This LMS uses its own port (4600) and moves to the next free port if that one is busy; the window shows the exact address. The browser tab says **USAII Intuitive LMS**.

macOS or Linux: run `./start.sh` in a terminal.

## Sign in

Test accounts and their passwords are in **`TEST-CREDENTIALS.md`**. They are deliberately not shown on the sign-in page or in the console.

- **Passwords:** at least 12 characters, with an uppercase letter, a lowercase letter, a number, and a symbol. Changing a password signs out every other session.
- **Sign-in protection:** after 5 wrong passwords an account waits 1, then 5, then 15 minutes; one network address is limited to 30 failures in 15 minutes.
- **Two roles only:** learners take courses; instructors create, publish, and track them. There is no self sign-up. Instructors create learner accounts and set each learner's password.

## Learner

The menu is **My Dashboard, Learning, Progress, Explore Courses, Steps to Completion, Your Journey, Ask**, then **Give Feedback, Quick Tools, Milestone Vault**.

- **My Dashboard:** one next step, how you are doing, your study habits, what to improve, and a planner.
- **Learning:** every lesson in order. **About this course** has two buttons side by side: **View Study Guide** opens the whole guide inside the LMS as a formatted Markdown document, starting at the lesson you are on; **Download Study Guide (PDF)** keeps a copy.
- **Lessons** follow one path: Learn → Check → Apply → Reflect → Complete.
- **Video transcripts in your language:** press play and the transcript opens on the right (under the video on a phone). Pick any of 130+ languages from a searchable list (all 22 scheduled languages of India included; search in English or in your own script). The current line is highlighted, and clicking a line jumps the video there. Copy or download the transcript.
- **Activities:** instructions are written like a short page (text, bullet points, notes, links, and pictures). If the activity has a rubric, **Open rubric (PDF)** shows exactly how the work will be evaluated, and the score appears on the activity once it is reviewed.
- **Progress:** your learning metrics, understanding by topic, quiz scores, and study time.
- **Steps to Completion** (per course):
  - **In the sidebar:** a collapsible list of every step with a checkmark as each one is finished and a "3/10" badge. It opens by itself on learning pages and remembers if you close it.
  - **As a page:** exactly how to earn the certificate. Three rules, then one animated path with every step. Each step lists what it takes (work through the lesson, take the check, submit the activity, mark it complete) with a **Go** button for anything left. The top shows steps left, time left, and your projected finish date.
- **Your Journey** (per course): a simple, dated record of what you have done, newest first.
  - **Filter bar:** choose the course, then see **Days in this course** and **Time invested**.
  - **Filters:** All, Lessons, Activities, Feedback on activities.
  - **Each entry:** a lesson you completed (with time spent), an activity you submitted (**Read** opens it), your instructor's decision on it (Approved, Resubmission requested, or Not approved, with their note and **Revise and resubmit** when needed), the final assessment, and your certificate.
  - **Download my work (PDF):** everything you wrote in the course's activities, in one document.
  - Built automatically from the course as the instructor set it up, so it works for every course with no extra setup.
- **Give Feedback:** star ratings for the course and the LMS, and "Would you recommend USAII® to others?"
- **? button (top right):** opens **How to Navigate the USAII® LMS?**, the video your instructor has added. It opens once by itself the first time a new video is available.

## Instructor

The menu is **Cohort, Learners & Access, Assessments, Activity Metrics, Questions**, then **My Courses**. Instructors manage the courses they created.

- **Cohort:** totals, then one row per learner with expected completion, predicted score, and actions (View portal, Guidance, Message).
- **Learners & Access:** add learners with a password, give or remove course access, set new passwords, and **Suspend** or **Reinstate** a learner (filter: All, Active, Suspended).
- **Suspending a learner** (also from each Cohort row and from a learner's View page): they are signed out on their next click and cannot sign in, and they see "Your account is suspended. Please contact your instructor." Nothing is deleted. Suspended learners are left out of Cohort figures and listed under **Suspended learners**, where **Reinstate** gives access back straight away.
- **Assessments:** three tabs.
  - **Activity submissions** (first tab): **View Assessment** shows the learner's work beside the rubric PDF. Enter the points awarded (out of the rubric total). With an AI key, **Suggest a score from the rubric** reads the PDF and the work and pre-fills a score and feedback; you always decide.
  - Filters: filter by course (or all your courses), by status (Awaiting review, Approved, Resubmission requested, Not approved), and by learner name. Each row shows only the learner, course, and assessment submitted. **View Assessment** opens the learner's work with three decisions: **Approve**, **Request resubmission**, or **Not approved**, plus **Feedback on activity**. A note is needed for the last two. The learner is notified at once, and a resubmission comes back as "Awaiting review", with the earlier review kept for context.
  - **Checks and quizzes:** percent correct per question.
  - **Final assessment:** attempts and results.
- **Activity Metrics:**
  - Active learners and learning hours this week.
  - **Where learners are on Steps to Completion:** how many learners are on each step, plus who has not moved in 7 days.
  - **Study Guide and learners' work:** who opened the Study Guide in the LMS, PDF downloads, and downloads of learners' own work.
  - **Learner feedback:** "would recommend USAII®", course and LMS ratings, and recent comments.
- **Questions:** learner questions, each private between that learner and the instructor.
- **My Courses:** create, edit, publish, and duplicate courses.
- **Navigation video** (button at the top right of every instructor page): add, preview, replace, or remove the **How to Navigate the USAII® LMS?** video that learners see behind their **?** button. Changes reach learners straight away.

## Creating a course

Go to **My Courses → Create course**. There are three steps:

1. **Course details:** course name, one-line description, who can join, and pass mark.
2. **Lessons:** a simple list of lesson names. Press **Edit** on a lesson to open it. The **Add to this lesson** bar stays at the top while you scroll:
   - **Heading, Paragraph, List, Quote, Link, Note**
   - **Multimedia → Video, Audio, Image**, each with upload or paste a link (YouTube and Vimeo links play in the lesson)
   - **Video transcript:** paste it, load a caption file (.vtt, .srt, .txt), or press **Generate from video** (needs `GEMINI_API_KEY`). Add times like `[1:05]` so the learner's panel follows the video.
   - Each lesson also has **Quiz questions** (practice or timed) and an optional **Activity** tab. In **Activity**, write the instructions with paragraphs, headings, lists, notes, links, and **images**, and upload the **rubric PDF** with its total points. Every submission is evaluated against that PDF.
   - **Preview as learner** shows the lesson exactly as learners will see it.
3. **Final test (optional):** questions, time limit, and number of attempts.

Press **Save**, then **Publish**. Published courses appear under the learner's **Explore Courses**, and anyone you added can open them.

## Your data

- **Where it's stored:** everything is saved in `data/db.json`, and uploads are saved in `uploads/`. Both survive restarts.
- **Starting over:** double-click `RESET-DEMO-DATA.bat` while the LMS is stopped.
- **Upgrading from 4.9:** just start 5.0 on the same folder. Your data is kept; the administrator account, live sessions, and anything that only existed for them are removed automatically the first time it starts.

## Connecting a production backend

The screens talk to the server only through `/api/...` routes:

| Route | Used by |
|---|---|
| `/api/auth` | Sign-in, profile, password |
| `/api/learner` | Dashboard data, lessons, checks, activities, final test |
| `/api/staff` | Cohort, learners and access, assessments, activity, course builder |
| `/api/threads`, `/api/notifications`, `/api/feedback`, `/api/ai/tutor` | Community and support |
| `/api/uploads` | File uploads |
| `/api/nav-video` | The navigation video: read (everyone signed in), upload/replace and remove (instructors) |

- **Database:** all data access goes through `server/db.ts`, so replacing the JSON file with PostgreSQL does not change any screen.
- **Analytics:** calculations live in one shared engine, `shared/analytics.ts`, and the data types are in `shared/types.ts`.

## Optional settings

Copy `.env.example` to `.env`:
- **`PORT`:** changes the starting port.
- **`UPLOAD_DIR`:** where uploaded files are kept (default `uploads/`). On a host, point it at a persistent disk.
- **`AUTH_SECRET`:** signs sign-in tokens. If unset, one is created in `data/secret.key`.
- **`ANTHROPIC_API_KEY` or `GEMINI_API_KEY`:** turns on transcript translation (each transcript is translated once per language and cached for everyone), AI rubric score suggestions, and the study coach's own explanations. Without a key, learners can still use their browser's built-in translator (recent Chrome) or open the transcript in Google Translate.
- **`GEMINI_API_KEY`:** also enables **Generate from video** (automatic transcripts).
- **`SEED_INSTRUCTOR_PASSWORD`, `SEED_LEARNER_PASSWORD`:** passwords for the starter accounts on first start.
- **`TRUST_PROXY=1`:** set when running behind a host's proxy.

## For developers

```
npm install
npm run dev        # API + app on http://localhost:4600
npm run lint       # strict TypeScript check
npm test           # unit + adaptivity tests (no server needed)
npm run test:api   # API tests against a fresh server and a mock AI service
npm run prod       # production build served by the same server
```
