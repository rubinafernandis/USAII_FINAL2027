# Deploying the USAII LMS

## Why Netlify shows the page but nobody can sign in

This LMS is **not a static website**. It has two halves:

1. A React front end, which Vite builds into `dist/`
2. An **Express server** that handles `/api/...` — sign-in, courses, progress, questions, feedback — and stores everything in `data/db.json`

Netlify (and GitHub Pages, and any "static site" host) only serves the first half. The uploaded files appear, the sign-in page renders, and then every `/api/auth/login` request returns the `index.html` page instead of a token — so the sign-in never completes. Nothing is wrong with your credentials or the build; the back end simply is not running there.

**A Node host is required.** Render, Railway, Fly.io, Heroku, or any VPS will work. Render is the quickest.

## Option A: Render (recommended)

1. Put **every** file of this folder in a GitHub repository (see "Uploading to GitHub" below: the web uploader takes at most 100 files at a time).
2. On https://render.com choose **New, then Web Service**, and pick the repository.
3. Settings (the same values are in `render.yaml`):
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment variables:**
     - `NODE_VERSION` = `22`
     - `AUTH_SECRET` = any long random string
     - `SEED_INSTRUCTOR_PASSWORD` and `SEED_LEARNER_PASSWORD` = the passwords you want for the starter accounts (12+ characters, upper and lower case, a number, a symbol)
     - `TRUST_PROXY` = `1`
     - optional: `ANTHROPIC_API_KEY` (translation, rubric suggestions, study coach) or `GEMINI_API_KEY` (also automatic transcripts)
4. Deploy. When the log shows "USAII Intuitive LMS 5.6 is running", open the service URL.

`npm start` always runs the built app in production mode; you do not need to set `NODE_ENV`.
If you skip the two `SEED_` passwords, random ones are generated and printed **once** in the Render log (Logs tab). On the free plan they change after every restart, so setting your own is strongly recommended.

### Uploading to GitHub

GitHub's **Add files, then Upload files** page accepts at most **100 files per upload** and silently drops the rest. This project has more than 100 files, so upload it in two batches (for example, first everything except `server/`, then the `server/` folder), or use GitHub Desktop or `git push`. Before deploying, check that `server/seed.ts`, `server/services.ts` and the `server/routes/` folder are in the repository.

If the deploy log says `Cannot find module .../server/seed`, files are missing from the repository.

**Keep the repository private.** `TEST-CREDENTIALS.md` lists the local test passwords. The hosted site does not use them when the `SEED_` passwords are set.

## Option B — Railway

New Project → Deploy from GitHub. Railway detects Node. Set the same start command and `NODE_ENV=production`. Railway supplies `PORT` automatically and the server uses it.

## About the data

Learner progress lives in `data/db.json` on the server's disk.

- **With a persistent disk** (paid Render plans: uncomment the `disk:` block in `render.yaml`; or a Railway volume) everything survives restarts and redeploys.
- **Without one**, the file system is wiped on every restart and the demo data is re-seeded. That is fine for a preview you are showing people; it is not fine for real learners.

Uploaded files (activity submissions, study plan PDFs, course media, and the "How to Navigate the USAII® LMS?" video) are stored the same way and need the same disk. With a disk, set `UPLOAD_DIR` to a folder on it (for Render: `/opt/render/project/src/data/uploads`).

## Sign-in accounts on the deployed site

On a host (`NODE_ENV=production`) the starter accounts do **not** use the local test passwords. Either:

- set `SEED_INSTRUCTOR_PASSWORD` and `SEED_LEARNER_PASSWORD` in the host's environment before the first start (12+ characters with upper and lower case, a number, and a symbol), or
- leave them unset: random strong passwords are generated on first start and written once to `data/initial-credentials.txt` on the persistent disk. Read it from the host's shell, sign in, change each password, then delete the file.

Also set `TRUST_PROXY=1` on Render (or behind any reverse proxy), so sign-in rate limits see each visitor's real address.

If neither variable is set, random passwords are generated on first start, printed once in the host log, and saved to `data/initial-credentials.txt`.

Passwords are never shown on the sign-in page or printed in the logs. Each person can change their own password from the profile menu (top right). Instructors can set a new password for any learner on **Learners & Access**.

## If you must stay on Netlify

The API would have to be rewritten as Netlify Functions and the JSON database replaced with a hosted database, because serverless functions cannot keep a writable file. That is a re-architecture, not a setting. Pointing Netlify's DNS at a Render service is far less work if you want to keep a Netlify-managed domain.
