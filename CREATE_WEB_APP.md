# How to Create Firebase Web App

Your Firebase project exists, but you need to add a **Web app** to get the API key for client-side use.

## Steps to Create Web App:

1. **Go to Firebase Console:**
   https://console.firebase.google.com/project/laundry-record-status

2. **Go to Project Settings:**
   - Click the gear icon (⚙️) next to "Project Overview"
   - Select "Project settings"

3. **Add Web App:**
   - Scroll down to "Your apps" section
   - Click the **Web icon** (`</>`) or "Add app" → Select Web
   
4. **Register Your App:**
   - App nickname: "Laundry Management" (or any name)
   - **Check "Also set up Firebase Hosting"** (optional, but recommended)
   - Click "Register app"

5. **Copy the Config:**
   You'll see a `firebaseConfig` object like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "laundry-record-status.firebaseapp.com",
     projectId: "laundry-record-status",
     storageBucket: "laundry-record-status.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123def456"
   };
   ```

6. **Add to .env:**
   Copy these values to your `.env` file:
   ```bash
   VITE_FIREBASE_API_KEY=AIzaSy... (the apiKey value)
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012 (the messagingSenderId)
   VITE_FIREBASE_APP_ID=1:123456789012:web:abc123def456 (the appId)
   ```

7. **Restart your dev server** after updating `.env`

## Alternative: Use Firestore REST API

If you can't create a Web app, I can modify the code to use Firestore REST API directly with just the project ID. Let me know if you'd prefer that approach!

