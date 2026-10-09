# FixTrack

A repair and maintenance tracking prototype built with
React, Express, and local MongoDB.

## Problem and users

FixTrack helps equipment reporters, technicians, and maintenance
coordinators follow repairs in one place.

## Features

- Create reports with a title, location, and description
- Search reports and filter by status
- Assign a technician by name
- Update repair status and view history
- Store reports in MongoDB
- Responsive dashboard

## Local setup

Install Node.js and MongoDB. Start the MongoDB service.

Backend, from the project root:

```powershell
cd server
npm.cmd install
Copy-Item .env.example .env
node index.js
```

Frontend, in a separate terminal from the project root:

```powershell
cd client
npm.cmd install
npm.cmd run dev
```

Open http://localhost:5173.

## Configuration

server/.env contains:
- PORT: backend port, 5000
- MONGO_URI: local MongoDB connection string
- CLIENT_ORIGIN: frontend origin, http://localhost:5173

The frontend API URL is currently hardcoded to
http://localhost:5000/api.

## Verification

- Backend syntax check passed.
- Frontend production build passed.
- Manual persistence and update test results are not yet recorded.

## Limitations and future work

This local prototype has no login, role permissions, photo uploads,
or automated tests. Technician assignments are text fields.
Status transitions are unrestricted.

Future work includes authentication, photo uploads,
technician accounts, pagination, and API tests.