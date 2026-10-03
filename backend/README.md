# ERM Attendance Tracker — Backend

Express 5 + MongoDB (Mongoose) + TypeScript REST API for the ERM Attendance Tracker.

- [Setup and start](#setup-and-start)
- [Environment variables](#environment-variables)
- [Schema](#schema)
- [API](#api)

---

## Setup and start

Requirements: Node.js 18+, a running MongoDB instance.

```bash
npm install
cp .env.example .env              # then set MONGODB_URI and JWT_SECRET
npm run dev                       # development, auto-reload → http://localhost:4000/api
```

Production:

```bash
npm run build
npm start
```

Load the member roster from CSV (once, or whenever the roster changes):

```bash
npm run import:members -- new_members.csv --dry-run   # preview, writes nothing
npm run import:members -- new_members.csv             # import
```

On every start the server:

1. connects to MongoDB (exits if it can't),
2. creates the default logins if there are none,
3. removes legacy members whose id starts with `mem-`.

Default logins (also restored by `POST /credentials/reset` or `npm run reset:credentials`):

| Username | Password | Role |
|---|---|---|
| `admin` | `admin@erm` | admin |
| `media`, `ambiance`, `pr`, `tech`, `erm`, `design` | `<username>@erm` | team (own team only) |

Change these before sharing access.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `MONGODB_URI` | — (required) | e.g. `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | `erm_attendance` | Database name |
| `JWT_SECRET` | — (required) | Long random string |
| `JWT_EXPIRES_IN` | `8h` | Token lifetime (no refresh tokens) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin(s), comma-separated |
| `DEFAULT_ADMIN_PASSWORD` | `admin@erm` | Used on first start and on reset |
| `DEFAULT_TEAM_PASSWORD_SUFFIX` | `@erm` | Team password = `<team>` + suffix |

---

## Schema

Three collections. Ids for members and sessions are strings generated as
`custom-{timestamp}-{random}` / `session-{timestamp}-{random}`, so the frontend
can create them offline and send them with the record.

### `members`

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | string | yes | `custom-{timestamp}-{random}`; exposed as `id` in the API |
| `name` | string | yes | Stored as entered (trimmed), max 120 |
| `role` | string | yes | `LEAD` \| `CO-LEAD` \| `COORDINATOR` \| `CORE` |
| `team` | string | yes | `MEDIA` \| `AMBIANCE` \| `PR` \| `TECH` \| `ERM` \| `DESIGN` |
| `rollNo` | string | no | Uppercase, no spaces, e.g. `24PF12` |
| `department` | string | no | Stored as entered (trimmed) |
| `year` | string | no | `1st Year` … `5th Year` |
| `phone` | string | no | Stored as entered (trimmed) |

Optional fields may be absent or `null`.
| `createdAt` | date | auto | |
| `updatedAt` | date | auto | |

Indexes: `team`, `rollNo`, `name`.

### `sessions`

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | string | yes | `session-{timestamp}-{random}`; exposed as `id` |
| `date` | string | yes | `YYYY-MM-DD` |
| `startTime` | string | yes | `HH:mm`, 24-hour, e.g. `09:30` |
| `endTime` | string | no | `HH:mm`, 24-hour; must be after `startTime` |
| `sessionSlot` | string | yes | `FN` (forenoon) \| `AN` (afternoon); derived from `startTime` if not sent |
| `title` | string | yes | Max 200 |
| `team` | string | yes | A team, or `ALL` (default) |
| `records` | map | yes | `memberId → AttendanceEntry`, default `{}` |
| `notes` | string | no | |
| `createdBy` | string | yes | Username of the creator |
| `createdAt` | date | auto | |
| `updatedAt` | date | auto | |

`AttendanceEntry`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `status` | string | yes | `PRESENT` \| `ABSENT` \| `INFORMED` |
| `notes` | string | no | Max 500 |
| `markedAt` | string | no | ISO timestamp; set by the server if omitted |

Indexes: `{ date: -1, startTime: -1 }`, `{ team: 1, date: -1 }`.

### `users` (logins)

| Field | Type | Required | Notes |
|---|---|---|---|
| `_id` | ObjectId | auto | Exposed as `id` |
| `username` | string | yes | Unique, lowercase |
| `passwordHash` | string | yes | bcrypt; never returned by the API |
| `role` | string | yes | `admin` \| `team` |
| `team` | string | team logins | The team this login can see |
| `tokenVersion` | number | auto | Bumped on credential change to invalidate old tokens; never returned |
| `createdAt` / `updatedAt` | date | auto | |

**Normalization on write:**
- `rollNo` is uppercased with spaces removed (`24pf12` → `24PF12`).
- `role`, `team` and `year` accept loose input (`co lead` → `CO-LEAD`, `tech` → `TECH`, `II` → `2nd Year`).
- Session times are stored as 24-hour `HH:mm` (`2:15 pm` → `14:15`).
- `name`, `department` and `phone` are stored as entered.

---

## API

Base URL: `http://localhost:4000/api`. JSON in and out unless noted.

### Authentication

`POST /auth/login` returns a JWT. Send it on every other request (all except `/health` and `/auth/login`):

```
Authorization: Bearer <token>
```

- There are no refresh tokens. Changing or resetting credentials invalidates existing tokens.
- **admin**: full access. Read endpoints accept `?team=` to narrow to one team.
- **team**: always limited to their own team (`?team=` is ignored). They see their team's sessions
  plus `ALL` sessions, with `records` filtered to their own members.
  - Members: read-only. Credentials: can change only their own login (`PATCH /auth/me/credentials`).
  - Sessions: can create, edit and delete their **own team's** sessions (a new session is always
    created for their team). `ALL` sessions and other teams' sessions are admin-only.
  - Attendance: can mark and clear **their own members**, in their team's sessions and in `ALL` sessions.
  - Anything else → 403, e.g. `You can only mark members of TECH`.

### Allowed values

| Name | Values |
|---|---|
| role | `LEAD`, `CO-LEAD`, `COORDINATOR`, `CORE` |
| team | `MEDIA`, `AMBIANCE`, `PR`, `TECH`, `ERM`, `DESIGN` |
| session team | any team, or `ALL` |
| year | `1st Year`, `2nd Year`, `3rd Year`, `4th Year`, `5th Year` |
| sessionSlot | `FN`, `AN` |
| time | `HH:mm` 24-hour (`9:30`, `2:15 pm` accepted and converted) |
| status | `PRESENT`, `ABSENT`, `INFORMED` |
| date | `YYYY-MM-DD` |

### Errors

Every error has the same shape:

```json
{ "error": "Human readable message", "details": "optional" }
```

Validation errors (400) list each problem:

```json
{
  "error": "Validation failed",
  "details": [{ "path": "team", "message": "Invalid enum value. Expected 'MEDIA' | ..., received 'X'" }]
}
```

| Status | Meaning |
|---|---|
| 400 | Validation failed / bad input |
| 401 | `Missing bearer token`, `Invalid or expired token`, `Session no longer valid` |
| 403 | `Admin access required`, or a team login acting outside its team (e.g. `You can only mark members of TECH`) |
| 404 | Not found, or outside the caller's team |
| 409 | Duplicate id or username |
| 500 | `Internal server error` |

### Endpoint summary

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | public | DB connectivity |
| POST | `/auth/login` | public | Log in |
| GET | `/auth/me` | any | Current user |
| PATCH | `/auth/me/credentials` | any | Change own username / password |
| GET | `/credentials` | admin | List logins |
| PATCH | `/credentials/:id` | admin | Change username / password |
| POST | `/credentials/reset` | admin | Reset all logins to defaults |
| GET | `/members` | any | List / search members |
| GET | `/members/:id` | any | One member |
| GET | `/members/:id/attendance` | any | Member history + counts |
| GET | `/members/export.csv` | any | CSV download |
| POST | `/members/import` | admin | CSV upload |
| POST | `/members` | admin | Add member |
| PATCH | `/members/:id` | admin | Edit member |
| DELETE | `/members/:id` | admin | Delete member |
| GET | `/sessions` | any | List sessions |
| GET | `/sessions/:id` | any | One session |
| POST | `/sessions` | admin, own team | Create session |
| PATCH | `/sessions/:id` | admin, own team | Edit session |
| DELETE | `/sessions/:id` | admin, own team | Delete session |
| PUT | `/sessions/:id/records/:memberId` | admin, own members | Mark one member |
| DELETE | `/sessions/:id/records/:memberId` | admin, own members | Clear one mark |
| GET | `/stats/summary` | any | Totals by role / team |
| GET | `/stats/attendance` | any | Per-member counts and % |
| GET | `/stats/daily` | any | Per-day totals |
| GET | `/sync` | any | Members + sessions snapshot |

### Health

#### `GET /health` — public

Returns 200 when the database is reachable, 503 when it isn't.

```json
{ "status": "ok", "db": "connected", "serverTime": "2026-10-03T08:00:00.000Z" }
```
```json
{ "status": "degraded", "db": "disconnected", "serverTime": "2026-10-03T08:00:00.000Z" }
```

### Auth

#### `POST /auth/login` — public

Request:
```json
{ "username": "admin", "password": "admin@erm" }
```

Response 200:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "66fe1c2a9b1e4a0012345678",
    "username": "admin",
    "role": "admin",
    "createdAt": "2026-10-03T07:00:00.000Z",
    "updatedAt": "2026-10-03T07:00:00.000Z"
  }
}
```
Team logins also include `"team": "TECH"`. Wrong credentials → 401 `Invalid username or password`.

#### `GET /auth/me`

```json
{ "user": { "id": "66fe1c2a9b1e4a0012345679", "username": "tech", "role": "team", "team": "TECH" } }
```

#### `PATCH /auth/me/credentials`

Any logged-in user (admin or team) changes their own login. The current password is required.

Request (`username` and/or `newPassword`):
```json
{ "currentPassword": "tech@erm", "username": "techlead", "newPassword": "S3cret!!" }
```
- `username`: 3–40 characters from `a-z 0-9 . _ -` (stored lowercase)
- `newPassword`: 6–128 characters

Response 200 — a fresh token, because every older token for this login stops working:
```json
{ "token": "eyJhbGciOi...", "user": { "id": "66fe…679", "username": "techlead", "role": "team", "team": "TECH" } }
```
Errors: 400 `Current password is incorrect` (path `currentPassword`), 400 nothing to change, 409 `Username already taken`.

### Credentials (admin)

#### `GET /credentials`

```json
{
  "users": [
    { "id": "66fe…678", "username": "admin", "role": "admin", "createdAt": "…", "updatedAt": "…" },
    { "id": "66fe…679", "username": "tech", "role": "team", "team": "TECH", "createdAt": "…", "updatedAt": "…" }
  ]
}
```

#### `PATCH /credentials/:id`

Request (at least one field):
```json
{ "username": "techlead", "password": "newSecret123" }
```
- `username`: 3–40 characters from `a-z 0-9 . _ -`
- `password`: 6–128 characters

Response 200: `{ "user": { …updated login… } }`. The old tokens for this login stop working.

Errors: 400 `invalid id`, 404 `Login not found`, 409 `Username already taken`.

#### `POST /credentials/reset`

No body. Every token stops working, including the caller's.

```json
{ "message": "All credentials reset to factory defaults. Please log in again.", "count": 7 }
```

### Members

`Member` object:
```json
{
  "id": "custom-1790971365204-0033b65a",
  "name": "K.Kavyashree",
  "role": "CORE",
  "team": "AMBIANCE",
  "rollNo": "24PF12",
  "department": "M.Sc. Fashion Design & Merchandising",
  "year": "3rd Year",
  "phone": "9025415156",
  "createdAt": "2026-10-03T07:27:57.637Z",
  "updatedAt": "2026-10-03T07:27:57.637Z"
}
```
`rollNo`, `department`, `year` and `phone` are optional: missing or `null` when not filled in
(members seeded from a NAME/ROLE/TEAM sheet have them as `null`).

#### `GET /members?team=&role=&search=`

All query parameters are optional:

| Param | Description |
|---|---|
| `team` | Admin only; narrows to one team |
| `role` | Filter by role |
| `search` | Case-insensitive match on name, roll no, department or phone |

```json
{ "members": [ "<Member>", "…" ] }
```
Members are sorted by name.

#### `GET /members/:id`

```json
{ "member": "<Member>" }
```
404 `Member not found`.

#### `GET /members/:id/attendance`

Profile, totals and history for the member detail drawer. History is newest first.

```json
{
  "member": "<Member>",
  "stats": { "total": 12, "present": 9, "absent": 2, "informed": 1, "presentPct": 75 },
  "history": [
    {
      "sessionId": "session-1790980000000-a1b2c3d4",
      "date": "2026-10-03",
      "startTime": "09:30",
      "endTime": "11:00",
      "sessionSlot": "FN",
      "title": "General meet",
      "team": "ALL",
      "status": "PRESENT",
      "notes": "came late",
      "markedAt": "2026-10-03T04:30:00.000Z"
    }
  ]
}
```

#### `GET /members/export.csv?team=`

Returns `text/csv` as a file download:
```
NAME,ROLL NO,DEPARTMENT,YEAR OF STUDY,PHONE,ROLE,TEAM
K.Kavyashree,24PF12,M.Sc. Fashion Design & Merchandising,3rd Year,9025415156,CORE,AMBIANCE
```

#### `POST /members` — admin

Request:
```json
{
  "id": "custom-1790990000000-1a2b3c4d",
  "name": "Ravi S",
  "role": "CORE",
  "team": "TECH",
  "rollNo": "24z201",
  "department": "B.E. Computer Science & Engineering",
  "year": "2nd Year",
  "phone": "9840011111"
}
```
- Required: `name`, `role`, `team`.
- `id` is optional; one is generated if missing.

Response 201: `{ "member": "<Member>" }`. The roll number above is stored as `24Z201`.

Errors: 400 validation, 409 `Member id already exists`.

#### `PATCH /members/:id` — admin

Send any subset of the fields:
```json
{ "role": "COORDINATOR", "phone": "9840022222" }
```
Response 200: `{ "member": "<Member>" }`. 404 `Member not found`.

#### `DELETE /members/:id` — admin

Response 204, with no body. The member's marks are removed from all sessions. 404 `Member not found`.

#### `POST /members/import?replace=&dryRun=` — admin

- Header: `Content-Type: text/csv`
- Body: the raw CSV text
- `replace=true`: delete all members first
- `dryRun=true`: report only, write nothing

Request body:
```
NAME,ROLL NO,DEPARTMENT,YEAR OF STUDY,PHONE,ROLE,TEAM
Ravi S,24z201,B.E. Mechanical Engineering,2,9840011111,co lead,tech
Asha K,24Z201,B.E. CSE,II,9840022222,core,media
```

Response 200:
```json
{
  "inserted": 1,
  "duplicates": [
    { "rollNo": "24Z201", "name": "Asha K", "keptName": "Ravi S", "keptIn": "file" }
  ],
  "valid": 2,
  "invalid": 0,
  "errors": [],
  "dryRun": false
}
```
- `keptIn` is `file` or `database`.
- Each entry in `errors` looks like `{ "row": 5, "message": "team: Required" }`.

### Attendance sessions

`Session` object:
```json
{
  "id": "session-1790980000000-a1b2c3d4",
  "date": "2026-10-03",
  "startTime": "09:30",
  "endTime": "11:00",
  "sessionSlot": "FN",
  "title": "General meet",
  "team": "ALL",
  "records": {
    "custom-1790971365204-0033b65a": { "status": "PRESENT", "markedAt": "2026-10-03T04:30:00.000Z" },
    "custom-1790971365205-9c400c92": { "status": "INFORMED", "notes": "medical leave", "markedAt": "2026-10-03T04:31:00.000Z" }
  },
  "notes": "Hall B",
  "createdBy": "admin",
  "createdAt": "2026-10-03T04:29:00.000Z",
  "updatedAt": "2026-10-03T04:31:00.000Z"
}
```

#### `GET /sessions?from=&to=&team=`

| Param | Description |
|---|---|
| `from`, `to` | `YYYY-MM-DD`, inclusive |
| `team` | Admin only. A team returns that team's sessions plus `ALL`; `ALL` returns only `ALL` sessions |

```json
{ "sessions": [ "<Session>", "…" ] }
```
Sessions are returned newest first (by date, then start time).

#### `GET /sessions/:id`

```json
{ "session": "<Session>" }
```
404 `Session not found`.

#### `POST /sessions` — admin, team login (own team)

A team login always creates the session for its own team: `team` may be left out or sent as its own team; any other team → 403.

Request:
```json
{
  "id": "session-1790980000000-a1b2c3d4",
  "date": "2026-10-03",
  "startTime": "9:30",
  "endTime": "11:00",
  "title": "General meet",
  "team": "ALL",
  "records": {
    "custom-1790971365204-0033b65a": { "status": "PRESENT" },
    "custom-1790971365205-9c400c92": { "status": "INFORMED", "notes": "medical leave" }
  },
  "notes": "Hall B"
}
```
- Required: `date`, `startTime`, `title`.
- `endTime` is optional and must be after `startTime`.
- `sessionSlot` is optional; it is derived from `startTime` (here `FN`).
- Defaults: `team` → `ALL`, `records` → `{}`.
- `markedAt` is filled in when omitted.
- The example's `"9:30"` is stored as `"09:30"`.

Response 201: `{ "session": "<Session>" }`

Errors:
- 400 validation, e.g. `endTime must be after startTime`
- 400 `Unknown member ids in records`, with `details: { "unknown": ["…"] }`
- 409 `Session id already exists`

#### `PATCH /sessions/:id` — admin, team login (own team's sessions)

Team logins can't edit `ALL` or other teams' sessions, can't move a session to another team, and `records` may only contain their own members.

Send any subset of the fields:
```json
{ "title": "General meet (rescheduled)", "startTime": "14:00", "endTime": "15:30" }
```
- Changing `startTime` also updates `sessionSlot` (here to `AN`), unless `sessionSlot` is sent too.
- `"endTime": null` removes the end time.
- `endTime` is checked against the stored `startTime` (and the other way round).
- If `records` is sent, it **replaces** the whole map; use the endpoint below for single changes.

Response 200: `{ "session": "<Session>" }`. 404 `Session not found`.

#### `DELETE /sessions/:id` — admin, team login (own team's sessions)

Response 204. 404 `Session not found`. 403 for a team login on an `ALL` or other team's session.

#### `PUT /sessions/:id/records/:memberId` — admin, team login (own members)

Marks one member. A team login can mark its own members in its own team's sessions and in `ALL` sessions.
```json
{ "status": "ABSENT", "notes": "no reason given" }
```
Response 200: `{ "session": "<Session>" }`, the full updated session. For team logins, `records` in
every session response contains only their own members.

Errors: 400 for an unknown member id, 403 for a team login marking another team's member or in another team's session, 404 `Session not found`.

#### `DELETE /sessions/:id/records/:memberId` — admin, team login (own members)

Clears one member's mark. Same rules as marking. Response 200: `{ "session": "<Session>" }`.

### Stats

#### `GET /stats/summary?team=`

Feeds the stats cards. Team logins only get their own team in `byTeam`.
```json
{
  "total": 153,
  "byRole": { "LEAD": 6, "CO-LEAD": 6, "COORDINATOR": 30, "CORE": 111 },
  "byTeam": {
    "MEDIA": { "total": 28, "byRole": { "LEAD": 1, "CO-LEAD": 1, "COORDINATOR": 5, "CORE": 21 } },
    "TECH":  { "total": 30, "byRole": { "…": 0 } }
  }
}
```

#### `GET /stats/attendance?team=&from=&to=`

Per-member counts. Percentages are out of the sessions in which that member was marked.
```json
{
  "members": [
    {
      "memberId": "custom-1790971365204-0033b65a",
      "name": "K.Kavyashree",
      "team": "AMBIANCE",
      "role": "CORE",
      "present": 9,
      "absent": 2,
      "informed": 1,
      "total": 12,
      "presentPct": 75,
      "absentPct": 16.7,
      "informedPct": 8.3
    }
  ]
}
```

#### `GET /stats/daily?team=&from=&to=`

Per-day totals for the heatmap and trend chart.
```json
{
  "days": [
    { "date": "2026-10-03", "sessions": 2, "present": 140, "absent": 10, "informed": 3, "marked": 153, "presentPct": 91.5 }
  ]
}
```

### Sync

#### `GET /sync?team=&from=&to=`

Returns everything the caller can see in one call. Use it on app load, on each auto-sync poll,
and when the browser fires the `online` event.
```json
{
  "members": [ "<Member>", "…" ],
  "sessions": [ "<Session>", "…" ],
  "serverTime": "2026-10-03T08:00:00.000Z"
}
```