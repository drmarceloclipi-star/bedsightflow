---
description: How to start the local Firebase Emulator environment for testing and demos
---

# Local Firebase Emulator Setup

This workflow sets up a fully functional local development environment using Firebase Emulators (Auth + Firestore) with pre-populated seed data.

## Prerequisites

- Node.js installed
- Project dependencies installed (`npm install`)
- All commands must be run from the project directory:

```bash
cd /Users/marcelocavalcanti/Downloads/LEAN/ward-board
```

## Steps

### 1. Start the Firebase Emulators

// turbo

```bash
cd /Users/marcelocavalcanti/Downloads/LEAN/ward-board && npm run emulators
```

- Auth Emulator: `http://localhost:9099`
- Firestore Emulator: `http://localhost:8080`
- Emulator UI: `http://localhost:4000`

> **IMPORTANT:** Keep this terminal running. The emulators must be active before seeding or running the app.

### 2. Seed the Database (in a separate terminal)

// turbo

```bash
cd /Users/marcelocavalcanti/Downloads/LEAN/ward-board && npm run seed
```

This creates:

- **Auth users** (admin, doctor, nurse)
- **Firestore documents** (beds in Unit A with kamishibai data)

### 3. Start the Application (in a separate terminal)

// turbo

```bash
cd /Users/marcelocavalcanti/Downloads/LEAN/ward-board && npm run dev
```

The app auto-detects `localhost` and connects to the emulators instead of production Firebase.

## Test Credentials

| Role        | Email             | Password      |
|-------------|-------------------|---------------|
| Admin       | <admin@lean.com>    | password123   |
| Médico      | <doctor@lean.com>   | password123   |
| Enfermagem  | <nurse@lean.com>    | password123   |

## Useful URLs

| Service        | URL                        |
|----------------|----------------------------|
| App (Mobile)   | <http://localhost:5173/mobile> |
| App (TV)       | <http://localhost:5173/tv?unit=A> |
| Emulator UI    | <http://localhost:4000>       |
| Firestore UI   | <http://localhost:4000/firestore> |
| Auth UI        | <http://localhost:4000/auth>  |

## Notes

- Data in the emulators is **ephemeral** — it resets every time you restart the emulators.
- Re-run `npm run seed` after restarting emulators to repopulate.
- The app will **never** touch production data while running on localhost.
