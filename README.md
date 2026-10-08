# 📚 Study Planner — AI-Powered Study Planning App

A full-stack study planner: register, set your exam date & subjects, get an AI-generated
(or smart rule-based fallback) daily schedule, track progress, and stay motivated.

## Tech Stack

| Layer     | Tech |
|-----------|------|
| Frontend  | React (Vite) + Tailwind CSS + React Router |
| Backend   | Node.js + Express |
| Database  | MongoDB + Mongoose |
| Auth      | JWT (JSON Web Tokens) + bcrypt password hashing |
| AI        | OpenAI API (optional — app works fully without a key, using a built-in rule-based scheduler/suggestion engine as fallback) |

## Project Structure

```
study-planner/
├── backend/
│   ├── server.js               # Express app entry point
│   ├── .env.example
│   ├── scripts/migrate.js      # One-off DB migration for existing installs (safe to re-run)
│   └── src/
│       ├── config/db.js        # MongoDB connection
│       ├── models/             # User, Task, StudyPlan, Subject, RevisionPlan, MockExam
│       ├── middleware/         # JWT auth guard, error handler
│       ├── controllers/        # Route logic (auth, tasks, plan, ai, subjects, revision, mock exams)
│       ├── routes/             # Express routers
│       └── utils/              # time/validation helpers, session generator, AI service, email, quotes
└── frontend/
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx / App.jsx
        ├── api/axios.js        # Axios instance with JWT interceptor
        ├── context/            # AuthContext, ThemeContext (light/dark mode)
        ├── components/         # Navbar, ProgressBar, TaskItem, TaskFormModal, etc.
        ├── utils/sessionMeta.js # Shared icons/colors per session type
        └── pages/               # Login, Register, Dashboard, Schedule, Tasks, Subjects, MockExams, Planner
```

## Features

- 🔐 Register / login with JWT-based authentication (passwords hashed with bcrypt)
- 🔑 Forgot / reset password via emailed link (falls back to logging the link to the server console if no SMTP is configured)
- 🗓️ **Planner page**: enter exam date, subjects (with priority & difficulty), and hours/day available
- 🤖 AI-generated (or rule-based fallback) daily study schedule, saved as individual tasks
- 📋 **Dashboard**: today's plan, daily & weekly progress bars, AI "what to study next" suggestion, daily motivational quote
- ✅ Add / edit / delete tasks, mark complete on the **Tasks** page or Dashboard
- 🌗 Light & dark mode toggle (persisted)
- ℹ️ "About" popover next to the theme toggle with developer name & social links (edit `frontend/src/components/AboutButton.jsx`)
- 📱 Fully responsive (mobile + desktop)

> **Note on AI:** If `OPENAI_API_KEY` is not set in the backend `.env`, the app automatically
> uses a built-in rule-based scheduler (weights subjects by priority + difficulty) and a
> curated motivational-quote list, so the app is fully functional out of the box with zero
> external API cost. Add an OpenAI key any time to switch to real AI-generated schedules,
> suggestions, and quotes — no code changes needed.

> **Note on password reset emails:** If `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` are not set in the
> backend `.env`, reset links are printed straight to the backend's terminal instead of being
> emailed — so "Forgot password" works fully in local development with zero setup. Add SMTP
> credentials any time (e.g. Gmail with an [app password](https://myaccount.google.com/apppasswords),
> or a provider like SendGrid/Mailgun) to send real emails instead.

---

## 🆕 What's New: Enhanced Planner Features

All of these were added on top of the existing app — nothing above was removed or replaced,
the existing `Task`, `User`, and `StudyPlan` data and APIs still work exactly as before.

1. **Subject Completion Timeline** (`/subjects` page) — each subject can have a target
   completion date, a list of subtopics/chapters, and each subtopic can be marked
   Not Started / In Progress / Completed. A progress bar shows % complete, and the app
   warns if the target date is after your exam date.
2. **Flexible Daily Study Schedule** (`/schedule` page) — a fully editable day planner.
   Add any number of sessions per day with subject, subtopic, start/end time (duration is
   auto-calculated but editable), drag-and-drop to reorder, edit or delete any session.
3. **Automatic Notes Session** — saving a Study session automatically creates a linked
   "Notes Making" session right after it, using your configurable default duration (set on
   the Planner page). You can move, resize, or delete it like any other session.
4. **Practice Questions Session** — its own session type, linked to a subject/subtopic,
   with its own start/end time, tracked as a **separate progress metric** from general study.
5. **Weekly Revision Planner** (part of `/subjects`) — pick one or more weekly revision days
   per subject and a duration; sessions are automatically generated into the schedule going
   forward and update immediately if you change the days or duration.
6. **Weekly Mock Exam Planner** (`/mock-exams` page) — designate a day-of-week (repeating) or
   a specific date as a mock exam, with subject, start time and duration. The app checks for
   and flags conflicts with anything else already scheduled.
7. **Custom Task Scheduler** — the same session form supports a "Custom Task" type with
   title, description, start/end time, priority, and status, appearing in the daily schedule
   alongside everything else.
8. **Validation** — overlapping time slots are blocked (with a "Save anyway" override), the
   day view shows a live warning if total scheduled time exceeds 24 hours, target completion
   dates are checked against the exam date, and remaining free time for the day is always shown.
9. **UI** — every session type has its own icon/color (📖 Study, 📝 Notes, ✏️ Practice,
   🔁 Revision, 🧪 Mock Exam, 📌 Custom), the whole app remains responsive on mobile/tablet/
   desktop, and the daily schedule supports native drag-and-drop reordering.



---

## 🆕 What's New: AI Planner (Natural Language + Voice)

A new **`/ai-planner`** page lets you type — or speak — your study plan in plain
language instead of filling in forms. It's purely additive: no existing route,
model, or page was changed or removed.

**How it works**
1. Type or use the 🎤 microphone (Web Speech API) to describe your plan, e.g.
   *"I am preparing for GATE CSE 2027. My exam is on February 2027. I can study
   8 hours daily. I want to finish Data Structures by September. My weakest
   subject is Digital Logic. Prioritize Mathematics. I want weekly revision
   and 2 mock tests every month."*
2. Click **Generate Plan** — a rule-based NLU parser
   (`backend/src/utils/nlpPlanParser.js`, no external AI API required, same
   "works out of the box" philosophy as `utils/aiService.js`) extracts the
   exam name/date, daily hours, subjects with deadlines, weak/priority
   subjects, mock/revision frequency, etc., and matches subject names against
   the existing GATE CSE preset where possible (so chapters pre-fill).
3. **Nothing is saved yet.** A **Preview** shows every field, lets you edit
   subjects/priorities/deadlines/hours inline, and surfaces warnings (e.g.
   infeasible daily-hour requirements, deadlines after the exam).
4. Click **Save Plan** to confirm. This creates/updates `Subject` documents,
   updates your planner preferences on `User`, optionally creates a weekly
   `RevisionPlan` and/or recurring `MockExam`, and then calls the **same**
   `regenerateFutureSchedule()` engine every other planner feature already
   uses — so Dashboard, Schedule, Tasks, Timeline, Calendar, Analytics, Mock
   Exams, and Revision are all populated and stay in sync automatically, with
   zero duplicate scheduling logic.
5. After saving, a small **AI chat assistant** lets you type things like *"I'm
   tired today"*, *"move revision to tomorrow"*, *"I finished early"*, or
   *"reschedule mock test"* to adjust today's/future sessions immediately.

**New files**
- `backend/src/utils/nlpPlanParser.js` — the NLU/parsing engine
- `backend/src/controllers/aiPlannerController.js` — preview/confirm/chat logic
- `backend/src/routes/aiPlannerRoutes.js` — mounted at `/api/ai-planner`
- `frontend/src/pages/AIPlanner.jsx` — the AI Planner page

**New API routes** (all `Private`, under `/api/ai-planner`)

| Method | Route | Description |
|--------|-------|--------------|
| POST | `/ai-planner/generate` | Body: `{ text }`. Parses the prompt into a preview. **No database writes.** |
| POST | `/ai-planner/confirm` | Body: `{ userFields, subjects, mockPlan?, revisionPlan? }` (the, possibly edited, preview). Creates/updates Subjects, updates preferences, regenerates the schedule. |
| POST | `/ai-planner/chat` | Body: `{ message }`. Rule-based study-mentor commands that adjust today's/future tasks. |

Voice input requires a browser with the Web Speech API (Chrome/Edge); the
page falls back to typing-only with a note if unsupported. No new npm
dependencies were required for either the backend or frontend.

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- A MongoDB database — either:
  - Local MongoDB (`mongodb://127.0.0.1:27017`), or
  - A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- (Optional) An [OpenAI API key](https://platform.openai.com/api-keys) for real AI generation

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI, JWT_SECRET (and OPENAI_API_KEY if you have one)
npm run dev
```

**If you have an existing database from before this update**, run the migration once
(safe to run multiple times, only fills in missing fields, never deletes data):
```bash
npm run migrate
```

The API will run on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# edit .env if your backend runs on a different URL
npm run dev
```

The app will run on `http://localhost:5173`.

### 3. Use the app

1. Open `http://localhost:5173` and sign up for an account.
2. You'll be routed to **Planner** — set your exam date, subjects, and hours/day, then generate your plan.
3. Go to **Dashboard** to see today's tasks, progress, AI suggestion, and quote.
4. Manage all tasks anytime from the **Tasks** page.

---

## API Documentation

Base URL: `http://localhost:5000/api`

All protected routes require header: `Authorization: Bearer <token>`

### Auth

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| POST | `/auth/register` | Public | Body: `{ name, email, password }` → `{ token, user }` |
| POST | `/auth/login` | Public | Body: `{ email, password }` → `{ token, user }` |
| GET  | `/auth/me` | Private | Returns current user profile |
| PUT  | `/auth/preferences` | Private | Body: `{ examDate?, examTime?, hoursPerDay?, subjects?, notesDurationMinutes? }` — update study prefs |
| POST | `/auth/forgot-password` | Public | Body: `{ email }` — sends (or logs) a password reset link, valid 1 hour |
| POST | `/auth/reset-password/:token` | Public | Body: `{ password }` — sets a new password, returns a fresh `{ token, user }` |

### Tasks / Sessions

The `Task` collection now doubles as a generic "session" covering study, notes, practice,
revision, mock exam, and custom task types — the original fields are unchanged.

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| GET | `/tasks` | Private | Query: `?date=YYYY-MM-DD`, `?range=week`, `&type=study\|notes\|practice\|revision\|mock_exam\|custom`. Returns `{ tasks }` |
| GET | `/tasks/day-summary?date=YYYY-MM-DD` | Private | Returns `{ sessions, summary: { totalMinutes, freeMinutes, overCapacity, byType } }` for one day |
| GET | `/tasks/progress` | Private | Returns `{ today, week, practiceToday, practiceWeek }` completion stats (practice tracked separately) |
| POST | `/tasks` | Private | Body: `{ subject, title, notes?, date, type?, subtopic?, startTime?, endTime?, durationMinutes?, priority?, status?, autoCreateNotes?, force? }`. Returns `409` with `{ conflicts }` on an overlapping time slot unless `force: true`. Auto-creates a linked notes session for `type: 'study'` unless `autoCreateNotes: false`. |
| PUT | `/tasks/:id` | Private | Update any field; same overlap check/`force` behavior as create |
| PATCH | `/tasks/:id/complete` | Private | Toggles `completed` (and keeps `status` in sync) |
| PATCH | `/tasks/reorder` | Private | Body: `{ order: [{ id, order }] }` — persists drag-and-drop order within a day |
| DELETE | `/tasks/:id` | Private | Deletes a session |

### Subjects (Completion Timeline + Subtopics)

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| GET | `/subjects` | Private | Returns `{ subjects }`, each with `completionPercent` and `deadlineAfterExam` (warning flag) |
| POST | `/subjects` | Private | Body: `{ name, priority?, difficulty?, targetCompletionDate?, subtopics? }` |
| PUT | `/subjects/:id` | Private | Update name/priority/difficulty/targetCompletionDate |
| DELETE | `/subjects/:id` | Private | Deletes the subject and its revision plans |
| POST | `/subjects/:id/subtopics` | Private | Body: `{ name, status? }` — add a subtopic/chapter |
| PUT | `/subjects/:id/subtopics/:subtopicId` | Private | Body: `{ name?, status? }` — `not_started \| in_progress \| completed` |
| DELETE | `/subjects/:id/subtopics/:subtopicId` | Private | Removes a subtopic |

### Weekly Revision Plans

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| GET | `/revision` | Private | Returns `{ plans }` |
| POST | `/revision` | Private | Body: `{ subject, daysOfWeek: [0-6], startTime?, durationMinutes? }` — generates sessions immediately |
| PUT | `/revision/:id` | Private | Update days/time/duration/active — regenerates future sessions |
| DELETE | `/revision/:id` | Private | Deletes the plan and its future auto-generated sessions |

### Weekly Mock Exams

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| GET | `/mock-exams` | Private | Returns `{ exams }` |
| POST | `/mock-exams` | Private | Body: `{ subject, title?, dayOfWeek, startTime, durationMinutes?, repeatWeekly?, date? }`. Returns `{ exam, sessionsCreated, conflicts }` |
| PUT | `/mock-exams/:id` | Private | Update and regenerate sessions |
| DELETE | `/mock-exams/:id` | Private | Deletes the exam and its future sessions |

### Study Plan

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| POST | `/plan/generate` | Private | Body: `{ examDate, hoursPerDay, subjects: [{name, priority, difficulty}] }`. Generates a full schedule (AI or rule-based) and creates Task documents for each day up to the exam. |
| GET | `/plan/latest` | Private | Returns the most recently generated plan |

### AI

| Method | Route | Access | Description |
|--------|-------|--------|--------------|
| GET | `/ai/suggest-next` | Private | Returns `{ subject, reason }` — best subject to study next based on today's pending tasks |
| GET | `/ai/quote` | Private | Returns `{ quote, source }` — today's motivational quote |

### Health

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/health` | Simple uptime check |

---

## Security Notes

- Passwords are hashed with bcrypt before storage; the hash is never returned in API responses.
- JWT secret and DB credentials are kept in `.env` (never committed — see `.gitignore`).
- All task/plan/AI routes are protected by JWT middleware and scoped to `req.user._id`, so
  users can only ever read/modify their own data.
- Input validation on register/login via `express-validator`.

## 🩺 Troubleshooting: Login / Password Reset Not Working

Run this first — it checks the most common causes in one shot:
```bash
cd backend
npm run diagnose
```
It verifies `MONGO_URI`/`JWT_SECRET` are set, that MongoDB is actually reachable, that JWT
signing works, and (if configured) that SMTP is ready. Fix any ❌ it reports, restart the
backend, and try again.

If everything passes there but it's still not working, it's almost always a **CORS
mismatch**: the backend only accepts requests from the exact origin(s) listed in
`CLIENT_ORIGIN`. If your browser is on a different address than that (e.g. `127.0.0.1:5173`
instead of `localhost:5173`, a different port, or a deployed URL), every API call —
including login and password reset — fails silently with a CORS error.

1. Open the browser DevTools (F12) → **Console** tab while attempting to log in.
2. Look for a line containing `CORS policy` or `blocked`.
3. If you see one, update `CLIENT_ORIGIN` in `backend/.env` to match exactly what's in your
   browser's address bar (you can list more than one, comma-separated — see
   `.env.example`), then restart the backend (`npm run dev`).
4. Also check the backend terminal — it now prints `Allowed frontend origin(s): ...` on
   startup, and logs `CORS blocked request from origin: ...` any time it rejects one, so you
   can see exactly what doesn't match.

Other quick checks:
- Backend terminal shows `Study Planner API running on http://localhost:5000`? If not, it
  didn't start — check the terminal for the exact error (as of this update, missing
  `MONGO_URI`/`JWT_SECRET` now fail immediately with a clear message instead of a silent crash).
- `http://localhost:5000/api/health` loads `{"status":"ok",...}` directly in the browser?
- `frontend/.env` has `VITE_API_URL` pointing at that same backend, and you restarted
  `npm run dev` in the frontend after editing it (Vite only reads `.env` on startup)?
- For password reset specifically: if SMTP isn't configured, the reset link is printed to
  the **backend terminal**, not emailed — check there after requesting a reset.

## Possible Next Steps

- Switch to PostgreSQL + Prisma if you prefer a relational DB (schema translates directly).
- Add push/browser notifications for upcoming sessions.
- Deploy: frontend to Vercel/Netlify, backend to Render/Railway, DB to MongoDB Atlas.

---

## 📋 Change Log: Enhanced Planner Update

### Modified files (existing functionality extended, not replaced)
- `backend/src/models/Task.js` — added `type`, `subtopic`, `startTime`, `endTime`, `status`,
  `order`, `linkedSessionId`, `revisionPlanId`, `mockExamId`, `autoGenerated`. All existing
  fields (`subject`, `title`, `date`, `durationMinutes`, `priority`, `completed`, `source`)
  are untouched, so old data reads back exactly as before.
- `backend/src/models/User.js` — added `examTime`, `notesDurationMinutes`.
- `backend/src/controllers/taskController.js` — `createTask`/`updateTask` now handle
  start/end time, overlap detection, and auto-created notes sessions; added `reorderTasks`
  and `getDaySummary`; `getProgress` now also reports practice-only stats.
- `backend/src/controllers/authController.js` — `updatePreferences` accepts `examTime` and
  `notesDurationMinutes` (in addition to the existing forgot/reset password endpoints).
- `backend/src/controllers/planController.js` — unchanged behavior (new Task fields all
  default sensibly, so AI-generated sessions still work exactly as before).
- `backend/src/routes/taskRoutes.js` — added `/reorder` and `/day-summary`.
- `backend/src/routes/authRoutes.js` — unchanged (preferences route already existed).
- `backend/server.js` — mounted the three new route files.
- `frontend/src/components/TaskItem.jsx` — now shows type icon, subtopic, status badge, and
  supports drag handles.
- `frontend/src/components/TaskFormModal.jsx` — rebuilt as a full session form (type,
  subtopic, start/end time with live duration calc, status, overlap-conflict UI with
  "Save anyway").
- `frontend/src/pages/Dashboard.jsx` — shows free-time/over-capacity warning and a separate
  practice-progress bar; links to the new Schedule page.
- `frontend/src/pages/Tasks.jsx` — added a session-type filter alongside the existing
  all/pending/completed filter.
- `frontend/src/pages/Planner.jsx` — added exam time and default notes-duration fields.
- `frontend/src/components/Navbar.jsx` and `frontend/src/App.jsx` — added links/routes for
  Schedule, Subjects, and Mock Exams.

### New files
- `backend/src/models/Subject.js`, `RevisionPlan.js`, `MockExam.js`
- `backend/src/utils/scheduleValidation.js` (overlap/24h/deadline checks), `sessionGenerator.js`
  (materializes recurring revision & mock-exam sessions)
- `backend/src/controllers/subjectController.js`, `revisionController.js`, `mockExamController.js`
- `backend/src/routes/subjectRoutes.js`, `revisionRoutes.js`, `mockExamRoutes.js`
- `backend/scripts/migrate.js` — one-off backfill for pre-existing databases
- `frontend/src/pages/Schedule.jsx` (daily drag-and-drop planner), `Subjects.jsx` (timeline +
  weekly revision), `MockExams.jsx`
- `frontend/src/utils/sessionMeta.js` — shared icon/color/status config

### New dependencies
- Backend: `nodemailer` (only used for the earlier password-reset feature — no new packages
  were required for this update; drag-and-drop uses native HTML5 events, no extra library).
- Frontend: none.

Run `npm install` in `backend/` to make sure `nodemailer` is present if you haven't already.

### Testing the new features
1. **Migrate first if upgrading an existing DB**: `cd backend && npm run migrate`.
2. **Subjects & timeline**: go to `/subjects`, add a subject with a target completion date
   *after* your exam date — you should see a red warning. Add a few subtopics and toggle
   their status; the progress bar should update immediately.
3. **Weekly revision**: on the same `/subjects` page, click a couple of weekday buttons under
   "Weekly revision days" for a subject, then check `/schedule` on one of those upcoming
   weekdays — a "🔁 Revision" session should already be there.
4. **Daily schedule & overlap validation**: go to `/schedule`, add a Study session
   09:00–10:00, then try adding another session 09:30–10:30 — you should get a conflict
   error with a "Save anyway" option. Add a session that pushes the day's total past 24h and
   confirm the red "Over 24 hours" warning appears.
5. **Auto notes session**: add a Study session with "Automatically add a Notes Making
   session" checked — confirm a 📝 Notes session appears immediately after it. Change your
   default notes duration on `/planner` and repeat to confirm it picks up the new default.
6. **Practice sessions**: add a Practice session linked to a subject/subtopic, mark it
   complete, and check the Dashboard shows a separate "Practice questions progress" bar.
7. **Mock exams**: on `/mock-exams`, add a weekly-repeating mock exam that overlaps an
   existing session on some date — confirm the conflict list is shown after creation.
8. **Custom tasks**: from `/schedule`, click "+ 📌 Custom Task", fill in title, description,
   time range, priority and status, save, and confirm it shows up with the 📌 icon.
9. **Drag-and-drop**: on `/schedule`, drag a session card to reorder it, refresh the page,
   and confirm the new order persisted.
10. **Backward compatibility**: confirm your pre-existing AI-generated plan (from `/planner`)
    and any tasks created before this update still show up correctly on the Dashboard and
    Tasks page.
