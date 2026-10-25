# HCM Lite

A complete Human Capital Management web application built for the Saylani Hackathon.

**Stack:** React 18 + Vite + TypeScript (frontend) — Express + TypeScript + MongoDB Atlas (backend)

---

## Quick Start

```bash
# 1. Install all dependencies
npm run install:all

# 2. Configure environment
cp server/.env.example server/.env
# Edit server/.env with your MongoDB URI, JWT secret, and admin credentials

# 3. Launch both servers
npm run dev
```

| Service  | URL                             |
| -------- | ------------------------------- |
| Frontend | http://localhost:5173            |
| Backend  | http://localhost:5000            |
| Health   | http://localhost:5000/api/health |

---

## Project Structure

```
hackathon-starter-kit/
+-- package.json              <- Root: concurrent dev/build scripts
+-- server/                   <- Express + TypeScript + MongoDB
|   +-- .env                  <- Local environment (gitignored)
|   +-- .env.example          <- Template for environment variables
|   +-- src/
|       +-- config/           <- DB connection, Zod env validation
|       +-- middleware/       <- Auth, rate limiter, error handler, validate
|       +-- modules/          <- Feature modules (see list below)
|       +-- routes/           <- Central route index
|       +-- utils/            <- AppError, asyncHandler, logger, workingDays
|       +-- server.ts         <- Express app entry point
+-- client/                   <- React + Vite + TypeScript
    +-- src/
        +-- api/              <- Typed fetch wrapper
        +-- components/       <- LayoutShell, Toast, AiAssistantDrawer, etc.
        +-- pages/            <- Admin, HR, Employee, Shared screens
        +-- styles/           <- Design tokens (tokens.css)
        +-- types/            <- Shared TypeScript types
```

### Backend Modules

| Module           | Path                     | Description                                              |
| ---------------- | ------------------------ | -------------------------------------------------------- |
| Setup            | /modules/setup           | First-run wizard, POST /setup, GET /setup/status         |
| Auth             | /modules/auth            | Login, JWT, /auth/me, lockout, forced password change    |
| Audit Log        | /modules/audit           | Append-only with before/after diffs, sensitive key strip |
| Settings         | /modules/settings        | Company singleton, timezone, public settings subset      |
| Departments      | /modules/departments     | CRUD, deactivation guards                                |
| Designations     | /modules/designations    | CRUD, deactivation guards                                |
| Leave Types      | /modules/leave-types     | Annual/Casual/Sick/Unpaid seeding, custom types          |
| Holidays         | /modules/holidays        | Single + bulk creation, working-days calculator          |
| Users            | /modules/users           | Admin-managed HR accounts, temporary passwords           |
| Organization     | /modules/org             | Readiness check GET /org/readiness                       |
| Employees        | /modules/employees       | EMP-xxxx codes, salary structure, CSV import/export      |
| Attendance       | /modules/attendance      | Check-in/out, board, corrections, camera validation      |
| Leave            | /modules/leave           | Apply, balances, overlap check, approve/reject/cancel    |
| Payroll          | /modules/payroll         | Monthly runs, integer-cent math, PDF payslips, lock      |
| Comms            | /modules/comms           | Announcements, in-app notifications                      |
| Dashboard        | /modules/dashboard       | MongoDB aggregation KPIs for Admin, HR, Employee         |
| AI Assistant     | /modules/ai              | OpenAI, Gemini, or Grok tool calling with role-scoped prompts |

---

## Roles

| Role     | Access                                                                              |
| -------- | ----------------------------------------------------------------------------------- |
| admin    | Full system access including settings, audit log, user management, all reports      |
| hr       | Employee directory, attendance board, leave inbox, payroll processing, announcements|
| employee | Own attendance, own leave requests, own payslips, own profile                       |

---

## Environment Variables

Copy `server/.env.example` to `server/.env` and set:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/<dbname>
JWT_SECRET=<random 48-byte hex string>
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@company.com
ADMIN_PASSWORD=<secure password>
COMPANY_NAME=Acme Corp
AI_PROVIDER=gemini
GEMINI_API_KEY=<your Gemini API key>
# For Grok instead, set AI_PROVIDER=grok and GROK_API_KEY=<your xAI API key>
```

The AI provider is optional. Set `AI_PROVIDER` to `openai`, `gemini`, or `grok`, then supply the matching provider key (`AI_API_KEY`, `GEMINI_API_KEY`, or `GROK_API_KEY`). Provider defaults are used for the model and endpoint; set `AI_MODEL` or `AI_BASE_URL` only to override them. Existing deployments using `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL` continue to work with `AI_PROVIDER=openai`.

Generate a JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Available Scripts

### Root

| Command               | Description                        |
| --------------------- | ---------------------------------- |
| `npm run install:all` | Install all dependencies           |
| `npm run dev`         | Start frontend + backend together  |
| `npm run dev:server`  | Start backend only                 |
| `npm run dev:client`  | Start frontend only                |
| `npm run build`       | Build both for production          |

### Server (`cd server`)

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | tsx watch (hot reload)             |
| `npm run build`   | Compile TypeScript to dist/        |
| `npm run test`    | Run Vitest test suite              |

### Client (`cd client`)

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Vite dev server on :5173           |
| `npm run build`      | Production bundle to dist/         |
| `npm run check:emoji`| Fail if any emoji found in src/    |

---

## MongoDB Setup

### Option A — MongoDB Atlas (recommended)
1. Create a free cluster at cloud.mongodb.com
2. Get your connection string
3. Set `MONGODB_URI` in `server/.env`

### Option B — Local MongoDB
```
MONGODB_URI=mongodb://localhost:27017/hcm_lite
```

---

## API Reference (condensed)

```
GET    /api/health
POST   /api/setup
GET    /api/setup/status
POST   /api/auth/login
GET    /api/auth/me
POST   /api/employees              Admin/HR: register employee
GET    /api/employees              Admin/HR: list with search/filter
GET    /api/employees/me           Employee: own profile
POST   /api/attendance/checkin     Employee: clock in
POST   /api/attendance/checkout    Employee: clock out
GET    /api/attendance/board       Admin/HR: daily attendance board
POST   /api/leaves                 Employee: apply for leave
GET    /api/leaves                 Admin/HR: list all leave requests
PATCH  /api/leaves/:id/approve     HR: approve leave
PATCH  /api/leaves/:id/reject      HR: reject leave
GET    /api/payroll/runs           Admin/HR: list payroll runs
POST   /api/payroll/runs           Admin: initiate payroll run
POST   /api/payroll/runs/:id/finalize Admin: finalize and lock run
GET    /api/payslips               Employee: own payslips
GET    /api/payslips/:id/pdf       Employee: download payslip PDF
GET    /api/dashboard/hr           HR/Admin: KPI aggregations
POST   /api/ai/chat                All roles: AI assistant chat
POST   /api/ai/smart-leave         Employee: natural-language leave parser
GET    /api/audit-logs             Admin: audit trail
```

---

## Production Build

```bash
npm run build
# Server  -> server/dist/
# Client  -> client/dist/
```

Serve `client/dist/` as static files from Express or deploy to Vercel.
Deploy the server to Render or any Node.js host.
