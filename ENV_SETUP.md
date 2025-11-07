# Environment Variables Setup Guide

## Password Configuration

The admin and override passwords are read from environment variables. Here's how to set it up:

### Local Development

1. Create a `.env` file in the root directory:
```bash
VITE_ADMIN_PASSWORD=your_secure_password_here
VITE_OVERRIDE_PASSWORD=your_override_password_here
```

2. The PasswordModal component reads them via:
```typescript
import.meta.env.VITE_ADMIN_PASSWORD    // For admin page access
import.meta.env.VITE_OVERRIDE_PASSWORD // For override page access
```

**Important:** In Vite, environment variables must be prefixed with `VITE_` to be exposed to the client-side code.

### Password Types

    - **Admin Password** (`VITE_ADMIN_PASSWORD`): Required to access the `/admin` page
      - **Required**: Must be set in environment variables
    - **Override Password** (`VITE_OVERRIDE_PASSWORD`): Required to access the `/override` page
      - **Required**: Must be set in environment variables

## Firebase/Firestore Configuration

To connect to Firestore, you need Firebase Web App configuration:

### Getting Firebase Config

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `laundry-record-status`
3. Click the gear icon → Project Settings
4. Scroll to "Your apps" section
5. If you don't have a web app, click "Add app" → Web (</>) icon
6. Copy the Firebase configuration object

### Environment Variables for Firebase

Add these to your `.env` file:

```bash
# Enable Firestore (set to 'true' or just set VITE_FIREBASE_PROJECT_ID)
VITE_USE_FIRESTORE=true

# Firebase Web App Config (from Firebase Console)
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=laundry-record-status.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=laundry-record-status
VITE_FIREBASE_STORAGE_BUCKET=laundry-record-status.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Firestore Collection Structure

The app expects a collection named `records` with documents having these fields:
- `customer_name` (string)
- `date` (string) - format: "2025-11-02 04:47 PM"
- `total_kg` (number)
- `status` (number) - 1 = In progress, 2 = Done, 3 = Claimed & Paid
- `timestamp` (Firestore Timestamp)
- `date_paid` (string, optional) - format: "YYYY-MM-DD"

### Firestore Security Rules

Make sure your Firestore security rules allow read/write access:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{document} {
      allow read: if true; // Adjust based on your security needs
      allow write: if true; // Adjust based on your security needs
    }
  }
}
```

**Note:** For production, implement proper authentication rules!

### Deployment

#### Option 1: Platform Environment Variables

Most hosting platforms allow you to set environment variables:

**Vercel:**
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add: `VITE_ADMIN_PASSWORD` = `your_secure_password`
4. Add: `VITE_OVERRIDE_PASSWORD` = `your_override_password`
5. Redeploy

**Netlify:**
1. Go to Site settings → Build & deploy → Environment
2. Add: `VITE_ADMIN_PASSWORD` = `your_secure_password`
3. Add: `VITE_OVERRIDE_PASSWORD` = `your_override_password`
4. Redeploy

**Other Platforms:**
- Set `VITE_ADMIN_PASSWORD` and `VITE_OVERRIDE_PASSWORD` in your platform's environment variable settings
- The variables will be baked into the build at build time

#### Option 2: Build-time Environment Variables

For static hosting, you can set variables during build:

```bash
VITE_ADMIN_PASSWORD=your_password VITE_OVERRIDE_PASSWORD=your_override_password npm run build
```

**Note:** Since this is a client-side app, the password will be visible in the built JavaScript. For better security, consider:
- Using a backend API for authentication
- Implementing a more secure authentication system
- Using environment-specific secrets

### Current Implementation

The PasswordModal reads passwords directly from environment variables:
- `VITE_ADMIN_PASSWORD` - **Required** for admin page access
- `VITE_OVERRIDE_PASSWORD` - **Required** for override page access

**Important:** Both passwords must be set in environment variables. If they are not set, authentication will fail with an error message.

The override button on the admin page will prompt for the override password when clicked, and redirects to `/override` upon successful authentication.

## Loyverse API Configuration

The app can sync with Loyverse receipts to automatically update customer status. This requires a Loyverse access token.

### Getting Your Loyverse Access Token

1. Go to [Loyverse Developer Portal](https://developer.loyverse.com/)
2. Sign in with your Loyverse account
3. Create a new application or use an existing one
4. Copy your **Access Token**

### Environment Variables for Loyverse

**Local Development:**
Add to your `.env` file:
```bash
VITE_LOYVERSE_ACCESS_TOKEN=your_loyverse_access_token_here
```

**Production (Vercel):**
1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add: `VITE_LOYVERSE_ACCESS_TOKEN` = `your_loyverse_access_token_here`
4. Alternatively, you can use `LOYVERSE_ACCESS_TOKEN` (without VITE_ prefix) for server-side only
5. Redeploy your application

### How It Works

- The app uses **serverless API functions** (`/api/loyverse/*`) to proxy requests to Loyverse API
- This avoids CORS issues and keeps your access token secure (server-side only)
- The API functions are located in `/api/loyverse/` directory
- In production, requests go through Vercel serverless functions instead of directly to Loyverse

### API Functions

- `/api/loyverse/receipts` - Fetches receipts from Loyverse
- `/api/loyverse/customers/[customerId]` - Fetches customer details by ID

**Note:** The access token is handled server-side in production, so it's never exposed to the client.

### Other Environment Variables

You can also configure:
- `VITE_SHEET_ID` - Google Sheets ID
- `VITE_GOOGLE_SHEETS_API_KEY` - Google Sheets API key
- `VITE_SHEET_RANGE` - Sheet range (default: Sheet1!A:D)
- `VITE_SHEETS_WRITE_ENDPOINT` - Optional backend endpoint

