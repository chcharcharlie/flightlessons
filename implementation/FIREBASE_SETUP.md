# Firebase Configuration Guide

## Finding Your Firebase Config Values

1. **Go to Firebase Console**
   - Navigate to https://console.firebase.google.com
   - Select your project

2. **Get Web App Configuration**
   - Click the gear icon ⚙️ next to "Project Overview"
   - Select "Project settings"
   - Scroll down to "Your apps" section
   - If you haven't added a web app yet:
     - Click "Add app" or the "</>" icon
     - Choose "Web"
     - Register your app with a nickname (e.g., "FlightLessons Web")
     - Copy the configuration values

3. **Your Firebase Config**
   The configuration will look like this:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123def456",
     measurementId: "G-XXXXXXXXXX"
   };
   ```

4. **Create Your .env File**
   Copy these values into your `.env` file:
   ```env
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456
   VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

## Deploy Security Rules and Functions

Since you're using live Firebase, you need to deploy the security rules and Cloud Functions:

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project**:
   ```bash
   cd implementation
   firebase init
   ```
   - Select: Firestore, Functions, Storage, Hosting
   - Use existing project (select your project)
   - Accept default file locations
   - Choose TypeScript for functions
   - DO NOT overwrite existing files

4. **Deploy Security Rules**:
   ```bash
   firebase deploy --only firestore:rules,storage:rules
   ```

5. **Deploy Cloud Functions**:
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```

## Running Without Emulators

Since you're skipping emulators, just run:

```bash
cd implementation
npm install --legacy-peer-deps
npm run dev
```

Your app will connect directly to your live Firebase project.

## Important Notes

- **Development Data**: Be careful as you're working with your live Firebase database
- **Costs**: Firebase has a free tier, but be aware of usage limits
- **Security**: The security rules we've defined will protect your data
- **Functions**: Cloud Functions may take a moment to deploy the first time

## Test Your Setup

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3000
3. Try creating an account
4. Check Firebase Console to see if the user appears in Authentication