# ERM Attendance Tracker

A full-stack attendance management application for organizing members
across teams, recording attendance for meetings and events, and viewing
attendance statistics and reports.

<img width="1200" height="760" alt="er-diagram" src="https://github.com/user-attachments/assets/ea272824-9671-4a1c-9223-8144e4b6c458" />

## Contents

- [Overview](#overview)
- [Features](#features)
- [Roles and Permissions](#roles-and-permissions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Models](#data-models)
- [Getting Started](#getting-started)
- [Environment Configuration](#environment-configuration)
- [Running the Application](#running-the-application)
- [API Overview](#api-overview)
- [Attendance Calculation](#attendance-calculation)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)

## Overview

ERM Attendance Tracker provides a central place to manage organization
members and record attendance. The application separates administrator
capabilities from team-level access. The frontend communicates with a
REST API, while the backend validates requests, applies permissions, and
stores data in MongoDB.

Large organization-wide meetings can be shared out: the admin creates one
`ALL` session, and each team lead marks their own team's members in it.

## Features

### Administrator

- View the organization overview.
- Search, filter, sort, add, edit, and remove members.
- Organize members by team and role.
- Create and manage attendance sessions for any team or the whole organization (`ALL`).
- Mark attendance as **Present**, **Absent**, or **Informed**.
- Import member data from CSV and export member information.
- Review attendance statistics and reports.
- Download member-directory and cumulative-attendance reports as PDF.
- Manage all login credentials, or reset them to defaults.

### Team accounts (team leads)

- Sign in with a team-scoped account (e.g. `tech`, `media`).
- View their team's members, attendance and reports.
- **Meetings:** create, edit, and delete meetings for their own team
  (title, date, start/end time, notes). The FN/AN slot is set from the start time.
- **Attendance:** mark their own members **Present**, **Absent**, or **Informed**,
  clear a mark, or mark all unmarked members at once. This works in their
  team's meetings and in organization-wide (`ALL`) sessions.
- See organization-wide (`ALL`) sessions created by the admin; these show as
  *Managed by admin* and can't be edited or deleted by a team.
- See all team leads and co-leads on the overview.
- Change their own username and password (current password required).

### Reporting and data handling

- Attendance counts and percentages per member.
- Daily attendance summaries.
- Session and member synchronization endpoint.
- Input validation and normalization for member and session fields
  (roll number, role, team, year, session times).

## Roles and Permissions

All rules are enforced by the backend; hiding a control in the UI is not the
security boundary.

| Action | Admin | Team account |
|---|---|---|
| View members, sessions, stats | All teams | Own team only, plus `ALL` sessions |
| Add, edit, delete members; CSV import | ✅ | ❌ |
| Create a session | Any team or `ALL` | Own team only |
| Edit or delete a session | Any | Own team's sessions only |
| Mark or clear attendance | Anyone, any session | Own members, in own team's and `ALL` sessions |
| Change own username / password | ✅ | ✅ |
| Manage other logins, reset all | ✅ | ❌ |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling and UI | Tailwind CSS, Lucide icons |
| Charts / visuals | Recharts (available in the root package dependencies) |
| PDF reports | jsPDF and jsPDF-AutoTable |
| Backend runtime | Node.js |
| Backend framework | Express 5 |
| Backend language | TypeScript |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JSON Web Tokens (JWT) |
| Password hashing | bcryptjs |
| Request validation | Zod |
| CSV processing | csv-parse and project CSV utilities |

Typical request flow:

1. A user interacts with the frontend.
2. The frontend sends an HTTP request to an `/api/...` endpoint.
3. Express routes the request through authentication/authorization and
   validation middleware.
4. A controller checks permissions and calls the relevant model or service.
5. Mongoose reads or updates MongoDB.
6. The backend returns JSON for the frontend to display.

## Project Structure

```text
erm_attendance_management-main/
├── backend/
│   ├── src/
│   │   ├── config/        # Environment, database, constants
│   │   ├── controllers/   # HTTP request handlers and permission checks
│   │   ├── middleware/    # Authentication, validation, errors
│   │   ├── models/        # Member, Session, User schemas
│   │   ├── routes/        # REST API routes
│   │   ├── scripts/       # Seed, import, normalization, reset
│   │   ├── services/      # Statistics, member import, credentials
│   │   ├── types/         # Express and TypeScript types
│   │   ├── utils/         # CSV, IDs, batching, normalization
│   │   └── validators/    # Zod request schemas
│   ├── .env.example
│   ├── README.md          # Full API reference
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── TeamDashboard.tsx
│   │   │   ├── AttendanceView.tsx
│   │   │   └── ReportsView.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── vite.config.ts
│   └── package.json
├── package.json
└── README.md
```

The repository contains both root-level Vite configuration and a
`frontend/` Vite app. The instructions below run the dedicated
`frontend/` app, whose Vite configuration proxies `/api` requests to the
backend.

## Data Models

The backend uses three main MongoDB models. Full field details are in
[`backend/README.md`](backend/README.md#schema).

### `Member`

Stores the people whose attendance is tracked.

| Field | Purpose |
|---|---|
| `id` / `_id` | Custom string member identifier |
| `name` | Member name |
| `role` | `LEAD`, `CO-LEAD`, `COORDINATOR`, or `CORE` |
| `team` | `MEDIA`, `AMBIANCE`, `PR`, `TECH`, `ERM`, or `DESIGN` |
| `rollNo` | Optional roll/registration number, stored uppercase |
| `department`, `year`, `phone` | Optional member details |
| `createdAt`, `updatedAt` | Automatically maintained timestamps |

Optional fields may be missing or `null` when not filled in yet.

### `AttendanceSession`

Stores a meeting/event and its attendance records.

| Field | Purpose |
|---|---|
| `id` / `_id` | Custom string session identifier |
| `date` | Date in `YYYY-MM-DD` format |
| `startTime`, `endTime` | Session time in 24-hour `HH:mm`; end time optional |
| `sessionSlot` | `FN` (before 12:00) or `AN`, set from the start time |
| `title` | Session title |
| `team` | One team, or `ALL` for organization-wide sessions |
| `records` | Map of member IDs to attendance entries |
| `notes`, `createdBy` | Additional session information and creator |
| `createdAt`, `updatedAt` | Automatically maintained timestamps |

Each attendance entry includes a `status` (`PRESENT`, `ABSENT`, or
`INFORMED`), optional notes, and a `markedAt` timestamp.

### `User`

Stores login accounts and permissions.

| Field | Purpose |
|---|---|
| `username` | Unique, normalized login name |
| `passwordHash` | Bcrypt password hash; not returned by the API |
| `role` | `admin` or `team` |
| `team` | Team assigned to a team account |
| `tokenVersion` | Invalidates existing tokens after credential changes |
| `createdAt`, `updatedAt` | Automatically maintained timestamps |

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm
- A running MongoDB instance (local or hosted)

### 1. Configure the backend

Open a terminal:

```bash
cd backend
npm install
```

Create the environment file from the template:

```bash
cp .env.example .env
```

Edit `backend/.env` and set a strong `JWT_SECRET` and a valid
`MONGODB_URI`. See [Environment Configuration](#environment-configuration).

### 2. Start the backend

In the `backend/` directory:

```bash
npm run dev
```

The backend listens on `http://localhost:4000` by default. On first start it
creates the default logins (`admin`, and one per team). Change them before
sharing access.

Check the health endpoint:

```text
http://localhost:4000/api/health
```

It should report a healthy response when the database is reachable.

### 3. Start the frontend

Open a **second terminal** from the repository root:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`). The
`frontend/vite.config.ts` development server proxies `/api` requests to
`http://localhost:4000`.

## Environment Configuration

The backend reads configuration from `backend/.env`.

| Variable | Description |
|---|---|
| `PORT` | API port; defaults to `4000` |
| `MONGODB_URI` | MongoDB connection URI (required) |
| `MONGODB_DB` | Database name; defaults to `erm_attendance` |
| `JWT_SECRET` | Secret used to sign/verify JWTs (required; use a long random value) |
| `JWT_EXPIRES_IN` | JWT lifetime; defaults to `8h` |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated |
| `DEFAULT_ADMIN_PASSWORD` | Initial/reset administrator password |
| `DEFAULT_TEAM_PASSWORD_SUFFIX` | Suffix used to construct default team passwords |

Do not commit `.env` files, real credentials, or production secrets to
version control.

## Running the Application

Run the frontend and backend in separate terminals:

**Terminal 1 — backend**

```bash
cd backend
npm run dev
```

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

Useful backend commands (run from `backend/`):

```bash
npm run typecheck
npm run build
npm start
npm run seed
npm run import:members -- path/to/members.csv --dry-run
npm run import:members -- path/to/members.csv
npm run normalize:members
npm run reset:credentials
```

Use the import dry-run option before importing real member data.
Seed/reset scripts change database state; review their behavior and
configuration before running them.

## API Overview

Base URL: `http://localhost:4000/api`. The complete reference, with request and
response examples, is in [`backend/README.md`](backend/README.md#api).

Except for health and login, endpoints require a bearer token:

```http
Authorization: Bearer <JWT>
```

| Method | Endpoint | Purpose | Who |
|---|---|---|---|
| `GET` | `/health` | Database/server health | Public |
| `POST` | `/auth/login` | Authenticate and receive a JWT | Public |
| `GET` | `/auth/me` | Get the current user | Any |
| `PATCH` | `/auth/me/credentials` | Change own username / password | Any |
| `GET` | `/members` | List/search members | Any |
| `GET` | `/members/:id` | Get one member | Any |
| `GET` | `/members/:id/attendance` | Member attendance history and counts | Any |
| `POST` | `/members` | Create a member | Admin |
| `PATCH` | `/members/:id` | Update a member | Admin |
| `DELETE` | `/members/:id` | Delete a member | Admin |
| `POST` | `/members/import` | Import members from CSV | Admin |
| `GET` | `/members/export.csv` | Export members as CSV | Any |
| `GET` | `/sessions` | List sessions | Any |
| `GET` | `/sessions/:id` | Get one session | Any |
| `POST` | `/sessions` | Create a session | Admin, team (own team) |
| `PATCH` | `/sessions/:id` | Update a session | Admin, team (own team's) |
| `DELETE` | `/sessions/:id` | Delete a session | Admin, team (own team's) |
| `PUT` | `/sessions/:id/records/:memberId` | Mark/update one member's attendance | Admin, team (own members) |
| `DELETE` | `/sessions/:id/records/:memberId` | Clear one attendance mark | Admin, team (own members) |
| `GET` | `/stats/summary` | Summary totals by team/role | Any |
| `GET` | `/stats/attendance` | Per-member attendance counts and percentages | Any |
| `GET` | `/stats/daily` | Daily attendance summaries | Any |
| `GET` | `/sync` | Combined members and sessions snapshot | Any |
| `GET` | `/credentials` | List credentials | Admin |
| `PATCH` | `/credentials/:id` | Update a credential | Admin |
| `POST` | `/credentials/reset` | Reset credentials to configured defaults | Admin |

Team accounts are restricted to their own team by the backend: they only
receive their own members and their own members' marks, even in `ALL`
sessions. Administrators have organization-wide access and can optionally
filter read endpoints by team.

## Attendance Calculation

Attendance is based on records that have actually been marked. A
member's present percentage is:

```text
Present % = Present marks / (Present + Absent + Informed marks) × 100
```

Unmarked sessions are not automatically counted as absences. When there
are no marked entries, the percentage is zero.

## Security Notes

- Change any default credentials before sharing or deploying the
  application. Team leads can change their own login from the team dashboard.
- Use a long, random `JWT_SECRET`.
- Keep `.env` out of source control.
- Use HTTPS in production.
- Restrict MongoDB network access and use a database user with only
  the permissions required by the app.
- Avoid importing real personal data into demo or public environments,
  and keep member CSV files out of version control.
- Team access is enforced by the API, not only by frontend visibility.
- Changing or resetting a login signs out every session that used the old details.

## Troubleshooting

**The frontend loads but API calls fail**

- Confirm the backend is running on port `4000`.
- Confirm MongoDB is reachable and `backend/.env` has the correct `MONGODB_URI`.
- Start the dedicated frontend from `frontend/` so its Vite proxy forwards
  `/api` requests to the backend.
- Check the browser console and backend terminal for errors.

**Backend exits during startup**

- Check `MONGODB_URI` and `JWT_SECRET`.
- Confirm MongoDB is running and reachable.
- Check that the configured port is available.

**Login fails**

- Confirm the account exists and credentials match the configured values.
- If a team lead changed their login, use the new username and password.
  The admin can reset a forgotten team login from the credentials page.
- If credentials were reset, use the currently configured defaults and
  change them promptly.
- Check the backend response and server logs without sharing secrets.

**A team lead gets "You can only…" errors**

- Team accounts can only manage their own team's meetings and mark their
  own members. Organization-wide (`ALL`) sessions can be marked, but only the
  admin can edit or delete them.

**A new meeting doesn't appear on the team dashboard**

- The dashboard loads data when it opens. Use the refresh button in the
  sidebar to see meetings the admin created since then.

**CSV import reports errors**

- Use the expected column names and allowed role/team/year values.
- Run the import with `--dry-run` first and inspect the reported
  validation or duplicate issues.
- Don't save the CSV from Excel: it turns roll numbers like `25E165` into
  `2.50E+166`. The import repairs these, but editing as text is safer.

---

## Screenshots

No application screenshots are included in the repository at this time.
Add screenshots of the login page, administrator overview, attendance
screen, and reports to a folder such as `docs/screenshots/`, then embed
them here, for example:

```md
![Administrator dashboard](docs/screenshots/admin-dashboard.png)
```

## License

No license file was included with the provided project. Add a `LICENSE`
file if you intend to publish or distribute the project.