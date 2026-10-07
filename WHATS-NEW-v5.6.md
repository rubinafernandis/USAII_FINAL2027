# What's new in 5.6

## Video transcripts in the learner's own language
- Press play on any lesson video and the transcript opens on the right (under the video on a phone).
- 130+ languages, including all 22 scheduled languages of India. Search by English name, native script, or code; the browser's own language is suggested first.
- With timed transcripts (captions or `[m:ss]` lines) the spoken line is highlighted and any line can be clicked to jump there, for uploaded videos, YouTube, and Vimeo.
- Translations are made once per language and shared by all learners. Without an AI key, the browser's on-device translator or Google Translate is offered instead.
- Course Builder: paste a transcript, load a caption file (.vtt, .srt, .txt), or generate it from an uploaded video (Gemini key). The 25 worked-example videos in the five USAII courses already have their transcripts.

## Activity instructions
- Written like a short page: paragraphs, headings, bullet lists, notes, links, and images. Never auto-numbered.

## Rubric PDF evaluation
- Upload the rubric as a PDF with its total points instead of typing criteria.
- Reviewers see the learner's work beside the rubric, enter the points awarded, and can ask for an AI-suggested score that reads the PDF. The score is the learner's Mastery evidence.
- Learners can open the rubric before submitting and see their score afterwards.

## Adaptive engine fixes (from the aLMS code review)
- The grade forecast now uses rubric scores for applied work, never submission alone.
- The forecast shows a likely range and says how much evidence backs it ("Early estimate").
- Weak applied work now triggers focused recommendations; every recommendation says why it matters.
- Every risk signal carries a next step, and instructors now see them on Cohort.
- "Low chance of passing" is no longer raised from one or two quizzes.
- Forecast vs. final result is logged at each attempt; Activity Metrics shows forecast accuracy.
- The final assessment time limit is enforced on submit.

## Security
- Uploaded files can no longer run as web pages on the LMS (HTML and SVG blocked, documents sandboxed).
- Stronger passwords (12+ characters, mixed), sessions end on password change, sign-in lockout by account and address, no credentials on the sign-in page or in logs, security headers.
- Learners cannot reach a course that was moved back to draft.

## Accessibility
- Tabs are announced as tabs and work with arrow keys.

Data format 8. A 5.5 data file is upgraded in place (backup kept).
