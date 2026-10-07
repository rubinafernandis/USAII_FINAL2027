# What's new in USAII Intuitive LMS 5.4

Built on 5.3. Everything not listed here works as before.

## The navigation video is now managed by instructors

### For instructors
- **New "Navigation video" button** at the top right of every instructor page (an icon on phones). A pink dot appears on it while no video is set.
- The window lets you:
  - **Add video:** drop a file or choose one. The LMS first checks that it plays in a browser, then shows a **Preview** so you can watch it before learners do.
  - **Publish to learners:** uploads it with a progress bar and a **Cancel upload** button. You can close the window and keep working while it uploads.
  - **Replace video:** the same steps; the old file is deleted from the server once the new one is live.
  - **Remove video:** asks you to confirm first.
- Accepted: **MP4 (H.264)** (best for every browser and phone), WebM, or Ogg, up to 1 GB.
- Every add, replace, and remove is recorded in the audit log with who did it.
- If the saved file ever disappears from the server (for example, a host without a persistent disk), the window says so and asks you to add it again.

### For learners
- The **?** button opens **How to Navigate the USAII® LMS?** with the video the instructor published. It is fetched each time the window opens, so a change shows up straight away.
- **First visit:** the window opens once by itself when a video is available. It opens once again after an instructor **replaces** the video, so everyone sees the new version. It never plays on its own.
- **No video yet:** the window says "The navigation video is on its way" instead of showing a broken player, and it does not open by itself.
- Instructors previewing a learner's portal never get the window automatically.

### Removed
- The bundled video files `public/videos/how-to-navigate-the-usaii-lms.mp4` and `.jpg`. The code package is about 31 MB smaller.

## Suspend a learner

### For instructors
- **Suspend** is on every Cohort row, on each learner in **Learners & Access**, and at the top of a learner's **View** page.
- Before suspending, the window explains what happens and offers an optional **note** (for example, "Contract paused until March") that only instructors see.
- **Learners & Access** shows a **Suspended** badge with the date, who suspended them, and the note, plus an **All / Active / Suspended** filter.
- **Cohort** leaves suspended learners out of every figure and lists them under **Suspended learners**, each with **View** and **Reinstate**.
- **Reinstate** restores access straight away and sends the learner a notification that their account is active again.
- Every suspension and reinstatement is recorded in the audit log.
- Adding an existing, suspended learner to a course says so, instead of claiming they can sign in.

### For the learner
- They are signed out on their next click, and the sign-in page says **"Your account is suspended. Please contact your instructor."**
- Signing in shows the same message (only after the correct password, so the page never reveals the status of someone else's account).
- Nothing is deleted: progress, submissions, messages, and course access are all kept for when they return.

### Also
- When the server ends any session (suspension or an expired sign-in), the sign-in page now says why, instead of appearing without explanation.

## Fixes
- **Hosting secret name.** `render.yaml` set `SESSION_SECRET`, but the server only read `AUTH_SECRET`, so the value was ignored. The server now reads either, and `render.yaml` uses `AUTH_SECRET`.
- **Uploads on Render.** Only `data/` was on the persistent disk, so uploaded files (course media, attachments, and now the navigation video) were lost on every restart. A new optional `UPLOAD_DIR` setting fixes this; `render.yaml` points it at the disk.
- **Long uploads.** Node stops any request after 5 minutes by default, which could cut off a large video on a slow connection. Uploads may now take up to an hour.
- **Version labels.** The server banner, `/api/health`, the browser tab, and `START.bat` said 5.2. They now all say 5.4.
- **Resetting demo data** keeps the navigation video setting, so the video stays in place.

## For developers
- API: `POST /api/staff/learners/:userId/suspend` with `{ "suspend": true, "reason": "…" }` or `{ "suspend": false }`. Stored on the user as `active` plus `suspension` (who, when, note).
- API: `GET /api/nav-video` (anyone signed in), `POST /api/nav-video` (instructor, multipart field `file`), `DELETE /api/nav-video` (instructor).
- Stored in `db.json` under `settings.navVideo`. The field is optional, so existing databases need no migration.
- Files: `src/staff/SuspendLearner.tsx`, `server/routes/navVideo.ts`, `src/lib/navVideo.ts`, `src/staff/NavVideoManager.tsx`, `src/learner/NavigationVideo.tsx`.
