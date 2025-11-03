# Firebase Setup Guide

## Quick Setup Steps

Your `.env` file is partially configured. You need to add your Firebase Web App API key.

### Step 1: Get Firebase Web App Config

1. Go to: https://console.firebase.google.com/project/laundry-record-status/settings/general
2. Scroll down to **"Your apps"** section
3. If you don't have a Web app yet:
   - Click **"Add app"** → Select the **Web** icon (`</>`)
   - Register your app (nickname: "Laundry Management")
4. Copy the `firebaseConfig` object that looks like:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "laundry-record-status.firebaseapp.com",
  projectId: "laundry-record-status",
  storageBucket: "laundry-record-status.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Step 2: Update .env File

Add these lines to your `.env` file (replace with your actual values):

```bash
VITE_FIREBASE_API_KEY=AIzaSy...your_actual_api_key
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

### Step 3: Update Firestore Security Rules

Go to: https://console.firebase.google.com/project/laundry-record-status/firestore/rules

Update rules to allow read/write (for now - adjust for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /records/{document} {
      allow read, write: if true;
    }
  }
}
```

### Step 4: Restart Dev Server

After updating `.env`, restart your dev server:
```bash
npm run start
```

### Verification

Check your browser console. You should see:
- ✅ `🔄 Fetching data from Firestore...`
- ✅ `✅ Loaded X records from Firestore`

If you see warnings about missing API key, check your `.env` file.

## Current Status

- ✅ Project ID: `laundry-record-status`
- ✅ Auth Domain: `laundry-record-status.firebaseapp.com`
- ❌ **Need:** `VITE_FIREBASE_API_KEY`
- ❌ **Need:** `VITE_FIREBASE_MESSAGING_SENDER_ID`
- ❌ **Need:** `VITE_FIREBASE_APP_ID`

Once you add these 3 values, Firestore will work automatically!

