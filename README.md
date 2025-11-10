# Laundry Management System

A modern web dashboard for monitoring and managing laundry records across multiple devices. The app helps the Kwiksilver team track drop-offs, update statuses, trigger reminders, and organize daily schedules with light/dark theming support.

Production URL: [https://kwiksilver-laundry-status.vercel.app/](https://kwiksilver-laundry-status.vercel.app/)

## Features
- **Customer Search:** Quickly look up customer records, view current status, and access tooltips for guidance.
- **Admin Dashboard:** Review all records with responsive tables, edit customer details, update weights, and transition laundry through workflow states (`In progress`, `Done`, `Claimed & Paid`).
- **My Day Planner:** Arrange or clear lineup slots with auto-arrange and auto-remove helpers.
- **Override Controls:** Administrative utilities for housekeeping tasks, Firestore cleanup, reminder notifications, and direct access to daily reports.
- **Reminder System:** Multi-device reminder modal backed by Firestore so all logged-in admins receive overdue notifications instantly.
- **Daily Report:** A summary view showing how many orders were marked `Done` and `Claimed & Paid` today, with timestamps per customer.
- **Night Mode:** Persistent dark theme toggle with mobile-aware navigation.
- **Loyverse Proxy Integration:** Secure serverless middleware (Vercel functions) to fetch receipts and customers without exposing API tokens in the client.

## Tech Stack
- **Frontend:** React + TypeScript, Vite, React Router
- **UI / Styling:** Custom CSS with responsive layouts and CSS variables for theming
- **Backend Services:** Firebase Firestore (via modular SDK)
- **Deployment:** Vercel (SPA hosting + serverless API routes)
- **APIs:** Loyverse API proxied through `/api/loyverse/*`

## Getting Started

### Prerequisites
- Node.js 18+
- npm (bundled with Node)
- Firebase project (for Firestore collections)
- Loyverse API credentials (access token)

### Installation
```bash
npm install
```

### Local Development
```bash
npm run dev
```
- Starts Vite dev server at `http://localhost:5173`.
- Uses Vite proxy for `/api/loyverse/*` to forward requests to the Loyverse API when the token is present.

### Production Build
```bash
npm run build
npm run preview
```
- `preview` serves the generated build locally to emulate production.

## Environment Variables
Create a `.env` file at the project root (never commit secrets). Reference values below:

```bash
# Loyverse API
VITE_LOYVERSE_ACCESS_TOKEN=your_loyverse_access_token

# Firebase / Firestore
VITE_USE_FIRESTORE=true
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456

# Optional legacy Google Sheets fallback
VITE_SHEET_ID=
VITE_GOOGLE_SHEETS_API_KEY=
VITE_SHEET_RANGE=Sheet1!A:D
```

> See `ENV_SETUP.md` for expanded instructions and context.

### Additional Secrets for Vercel
Set the same environment variables inside Vercel project settings (`Project Settings → Environment Variables`). The serverless functions will attempt to read `VITE_LOYVERSE_ACCESS_TOKEN` or fallback to `LOYVERSE_ACCESS_TOKEN`.

## Firebase Configuration
1. Create a Firebase project and enable Firestore.
2. Add a Web App to obtain the config values above.
3. Ensure the following collections exist:
   - `laundry_records` (main dataset mirrored from Google Sheets or manual entries)
   - `laundry_reminder_notification` (document `current` stores reminder payloads)
4. Security rules should allow the app credentials to read/write these collections appropriately.

## Loyverse API Proxy
- Serverless functions live under `api/loyverse/*` and proxy requests to `https://api.loyverse.com/v1.0/...`.
- Client requests use `/api/loyverse/receipts` and `/api/loyverse/customers/:customerId`.
- In development, Vite forwards these routes and requires the `Authorization` header. In production, Vercel functions inject the token server-side.

## Reminder System Flow
1. Override control triggers `Send Admin Reminder Popup` which writes a payload to Firestore.
2. Admin dashboard subscribes to changes in `laundry_reminder_notification/current`.
3. All connected clients display the reminder overlay in real-time and can dismiss it, which clears the Firestore document.

## Daily Report Flow
1. Override control `Generate Report` redirects to `/override/report` (requires override authentication).
2. Report page fetches all records from Firestore and filters `dateDone` and `datePaid` for the current day.
3. Summary cards show counts and detailed lists include timestamps per customer.

## Scripts Reference
- `npm run dev` – start Vite development server
- `npm run build` – build production bundle
- `npm run preview` – preview the production build locally
- `npm run start` – (if defined) fallback start script

## Deployment Notes
- Deploy via Vercel (includes SPA hosting + API routes).
- Ensure `vercel.json` preserves `/api/*` by using the negative lookahead rewrite.
- After deployment, verify reminder popups and receipt syncing via production link.

## Troubleshooting
- **CORS / 401 in dev:** confirm `VITE_LOYVERSE_ACCESS_TOKEN` is set and that requests include the `Authorization` header (handled automatically in code when `import.meta.env.DEV`).
- **Reminder modal missing on other devices:** verify Firestore collection exists and that clients are authenticated with override/admin and subscribed to snapshots.
- **Night mode reset on refresh:** localStorage should retain `theme-preference`; clear storage if inconsistent.

## Useful Resources
- [Production Dashboard](https://kwiksilver-laundry-status.vercel.app/)
- [Loyverse API Docs](https://developer.loyverse.com/docs)
- Firebase Console for project configs and Firestore monitoring

---
For further improvements or team onboarding, pair this README with `ENV_SETUP.md` and in-app override controls to administer data and reminders quickly.
