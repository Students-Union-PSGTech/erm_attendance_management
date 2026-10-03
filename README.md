# ERM Attendance Tracker

A full-stack attendance management application for organizing members
across teams, recording attendance for meetings and events, and viewing
attendance statistics and reports.

<img width="1200" height="760" alt="er-diagram" src="https://github.com/user-attachments/assets/ea272824-9671-4a1c-9223-8144e4b6c458" /><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760" role="img" aria-labelledby="title desc">


## Contents

-   [Overview](#overview)
-   [Features](#features)
-   [Tech Stack](#tech-stack)
-   [Project Structure](#project-structure)
-   [Data Models](#data-models)
-   [Getting Started](#getting-started)
-   [Environment Configuration](#environment-configuration)
-   [Running the Application](#running-the-application)
-   [API Overview](#api-overview)
-   [Attendance Calculation](#attendance-calculation)
-   [Security Notes](#security-notes)
-   [Troubleshooting](#troubleshooting)

## Overview

ERM Attendance Tracker provides a central place to manage organization
members and record attendance. The application separates administrator
capabilities from team-level access. The frontend communicates with a
REST API, while the backend validates requests, applies permissions, and
stores data in MongoDB.

## Features

### Administrator

-   View the organization overview.
-   Search, filter, sort, add, edit, and remove members.
-   Organize members by team and role.
-   Create and manage attendance sessions.
-   Mark attendance as **Present**, **Absent**, or **Informed**.
-   Import member data from CSV and export member information.
-   Review attendance statistics and reports.
-   Download member-directory and cumulative-attendance reports as PDF.
-   Manage login credentials.

### Team accounts

-   Sign in with a team-scoped account.
-   View members and attendance information permitted for their assigned
    team.
-   Access organization-wide (`ALL`) sessions where applicable.
-   Team access is enforced by the backend; hiding a control in the UI
    is not the security boundary.

### Reporting and data handling

-   Attendance counts and percentages per member.
-   Daily attendance summaries.
-   Session and member synchronization endpoint.
-   Input validation and normalization for common member and session
    fields.

## Tech Stack

  -----------------------------------------------------------------------
  Layer                               Technology
  ----------------------------------- -----------------------------------
  Frontend                            React, TypeScript, Vite

  Styling and UI                      Tailwind CSS, Lucide icons

  Charts / visuals                    Recharts (available in the root
                                      package dependencies)

  PDF reports                         jsPDF and jsPDF-AutoTable

  Backend runtime                     Node.js

  Backend framework                   Express 5

  Backend language                    TypeScript

  Database                            MongoDB

  ODM                                 Mongoose

  Authentication                      JSON Web Tokens (JWT)

  Password hashing                    bcryptjs

  Request validation                  Zod

  CSV processing                      csv-parse and project CSV utilities
  -----------------------------------------------------------------------

Typical request flow:

1.  A user interacts with the frontend.
2.  The frontend sends an HTTP request to an `/api/...` endpoint.
3.  Express routes the request through authentication/authorization and
    validation middleware.
4.  A controller calls the relevant model or service.
5.  Mongoose reads or updates MongoDB.
6.  The backend returns JSON for the frontend to display.

## Project Structure

``` text
erm_attendance_management-main/
├── backend/
│   ├── src/
│   │   ├── config/        # Environment, database, constants
│   │   ├── controllers/   # HTTP request handlers
│   │   ├── middleware/    # Authentication, validation, errors
│   │   ├── models/        # Member, Session, User schemas
│   │   ├── routes/        # REST API routes
│   │   ├── scripts/       # Seed, import, normalization, reset
│   │   ├── services/      # Statistics, member import, credentials
│   │   ├── types/         # Express and TypeScript types
│   │   ├── utils/         # CSV, IDs, batching, normalization
│   │   └── validators/    # Zod request schemas
│   ├── .env.example
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

The backend uses three main MongoDB models.

### `Member`

Stores the people whose attendance is tracked.

  Field                           Purpose
  ------------------------------- -------------------------------------------------------
  `id` / `_id`                    Custom string member identifier
  `name`                          Member name
  `role`                          `LEAD`, `CO-LEAD`, `COORDINATOR`, or `CORE`
  `team`                          `MEDIA`, `AMBIANCE`, `PR`, `TECH`, `ERM`, or `DESIGN`
  `rollNo`                        Optional roll/registration number
  `department`, `year`, `phone`   Optional member details
  `createdAt`, `updatedAt`        Automatically maintained timestamps

### `AttendanceSession`

Stores a meeting/event and its attendance records.

  Field                      Purpose
  -------------------------- ---------------------------------------------
  `id` / `_id`               Custom string session identifier
  `date`                     Date in `YYYY-MM-DD` format
  `startTime`, `endTime`     Session time in 24-hour format
  `sessionSlot`              Session time category, such as `FN` or `AN`
  `title`                    Session title
  `team`                     A team or `ALL`
  `records`                  Map of member IDs to attendance entries
  `notes`, `createdBy`       Additional session information and creator
  `createdAt`, `updatedAt`   Automatically maintained timestamps

Each attendance entry includes a `status` (`PRESENT`, `ABSENT`, or
`INFORMED`), optional notes, and a `markedAt` timestamp.

### `User`

Stores login accounts and permissions.

  -----------------------------------------------------------------------
  Field                               Purpose
  ----------------------------------- -----------------------------------
  `username`                          Unique, normalized login name

  `passwordHash`                      Bcrypt password hash; not returned
                                      by the API

  `role`                              `admin` or `team`

  `team`                              Team assigned to a team account

  `tokenVersion`                      Supports invalidating existing
                                      tokens after credential changes

  `createdAt`, `updatedAt`            Automatically maintained timestamps
  -----------------------------------------------------------------------

## Getting Started

### Prerequisites

-   Node.js 18 or newer
-   npm
-   A running MongoDB instance (local or hosted)

### 1. Configure the backend

Open a terminal:

``` bash
cd backend
npm install
```

Create the environment file from the template:

``` bash
cp .env.example .env
```

Edit `backend/.env` and set a strong `JWT_SECRET` and a valid
`MONGODB_URI`. See [Environment
Configuration](#environment-configuration).

### 2. Start the backend

In the `backend/` directory:

``` bash
npm run dev
```

The backend listens on `http://localhost:4000` by default.

Check the health endpoint:

``` text
http://localhost:4000/api/health
```

It should report a healthy response when the database is reachable.

### 3. Start the frontend

Open a **second terminal** from the repository root:

``` bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (typically `http://localhost:5173`). The
`frontend/vite.config.ts` development server proxies `/api` requests to
`http://localhost:4000`.

## Environment Configuration

The backend reads configuration from `backend/.env`.

  -----------------------------------------------------------------------
  Variable                            Description
  ----------------------------------- -----------------------------------
  `PORT`                              API port; defaults to `4000`

  `MONGODB_URI`                       MongoDB connection URI (required)

  `MONGODB_DB`                        Database name; defaults to
                                      `erm_attendance`

  `JWT_SECRET`                        Secret used to sign/verify JWTs
                                      (required; use a long random value)

  `JWT_EXPIRES_IN`                    JWT lifetime; defaults to `8h`

  `CORS_ORIGIN`                       Allowed frontend origin(s),
                                      comma-separated

  `DEFAULT_ADMIN_PASSWORD`            Initial/reset administrator
                                      password

  `DEFAULT_TEAM_PASSWORD_SUFFIX`      Suffix used to construct default
                                      team passwords
  -----------------------------------------------------------------------

Do not commit `.env` files, real credentials, or production secrets to
version control.

## Running the Application

Run the frontend and backend in separate terminals:

**Terminal 1 --- backend**

``` bash
cd backend
npm run dev
```

**Terminal 2 --- frontend**

``` bash
cd frontend
npm run dev
```

Useful backend commands (run from `backend/`):

``` bash
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

Base URL: `http://localhost:4000/api`

Except for health and login, endpoints require a bearer token:

``` http
Authorization: Bearer <JWT>
```

  -----------------------------------------------------------------------------------
  Method                  Endpoint                            Purpose
  ----------------------- ----------------------------------- -----------------------
  `GET`                   `/health`                           Database/server health

  `POST`                  `/auth/login`                       Authenticate and
                                                              receive a JWT

  `GET`                   `/auth/me`                          Get the current user

  `GET`                   `/members`                          List/search members

  `GET`                   `/members/:id`                      Get one member

  `GET`                   `/members/:id/attendance`           Member attendance
                                                              history and counts

  `POST`                  `/members`                          Create a member (admin)

  `PATCH`                 `/members/:id`                      Update a member (admin)

  `DELETE`                `/members/:id`                      Delete a member (admin)

  `POST`                  `/members/import`                   Import members from CSV
                                                              (admin)

  `GET`                   `/members/export.csv`               Export members as CSV

  `GET`                   `/sessions`                         List sessions

  `GET`                   `/sessions/:id`                     Get one session

  `POST`                  `/sessions`                         Create a session
                                                              (admin)

  `PATCH`                 `/sessions/:id`                     Update a session
                                                              (admin)

  `DELETE`                `/sessions/:id`                     Delete a session
                                                              (admin)

  `PUT`                   `/sessions/:id/records/:memberId`   Mark/update one
                                                              member's attendance
                                                              (admin)

  `DELETE`                `/sessions/:id/records/:memberId`   Clear one attendance
                                                              mark (admin)

  `GET`                   `/stats/summary`                    Summary totals by
                                                              team/role

  `GET`                   `/stats/attendance`                 Per-member attendance
                                                              counts and percentages

  `GET`                   `/stats/daily`                      Daily attendance
                                                              summaries

  `GET`                   `/sync`                             Combined members and
                                                              sessions snapshot

  `GET`                   `/credentials`                      List credentials
                                                              (admin)

  `PATCH`                 `/credentials/:id`                  Update a credential
                                                              (admin)

  `POST`                  `/credentials/reset`                Reset credentials to
                                                              configured defaults
                                                              (admin)
  -----------------------------------------------------------------------------------

Team accounts are restricted to their own team by the backend.
Administrators have organization-wide access and can optionally filter
read endpoints by team.

## Attendance Calculation

Attendance is based on records that have actually been marked. A
member's present percentage is:

``` text
Present % = Present marks / (Present + Absent + Informed marks) × 100
```

Unmarked sessions are not automatically counted as absences. When there
are no marked entries, the percentage is zero.

## Security Notes

-   Change any default credentials before sharing or deploying the
    application.
-   Use a long, random `JWT_SECRET`.
-   Keep `.env` out of source control.
-   Use HTTPS in production.
-   Restrict MongoDB network access and use a database user with only
    the permissions required by the app.
-   Avoid importing real personal data into demo or public environments.
-   Team access must be enforced by the API, not only by frontend
    visibility.

## Troubleshooting

**The frontend loads but API calls fail** - Confirm the backend is
running on port `4000`. - Confirm MongoDB is reachable and
`backend/.env` has the correct `MONGODB_URI`. - Start the dedicated
frontend from `frontend/` so its Vite proxy forwards `/api` requests to
the backend. - Check the browser console and backend terminal for
errors.

**Backend exits during startup** - Check `MONGODB_URI` and
`JWT_SECRET`. - Confirm MongoDB is running and reachable. - Check that
the configured port is available.

**Login fails** - Confirm the account exists and credentials match the
configured values. - If credentials were reset, use the currently
configured defaults and change them promptly. - Check the backend
response and server logs without sharing secrets.

**CSV import reports errors** - Use the expected column names and
allowed role/team/year values. - Run the import with `--dry-run` first
and inspect the reported validation or duplicate issues.

------------------------------------------------------------------------

## Screenshots

No application screenshots are included in the repository at this time.
Add screenshots of the login page, administrator overview, attendance
screen, and reports to a folder such as `docs/screenshots/`, then embed
them here, for example:

``` md
![Administrator dashboard](docs/screenshots/admin-dashboard.png)
```

## License

No license file was included with the provided project. Add a `LICENSE`
file if you intend to publish or distribute the project.
