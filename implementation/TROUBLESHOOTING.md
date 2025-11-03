# Troubleshooting Guide

## Common Issues

### 1. OPERATION_NOT_ALLOWED Error on Sign Up

**Error**: `400 OPERATION_NOT_ALLOWED`

**Solution**: Enable Email/Password authentication in Firebase Console
1. Go to: https://console.firebase.google.com/project/flightlessons-8b9bd/authentication/providers
2. Click on "Email/Password" 
3. Toggle "Enable" to ON
4. Save

### 2. Firebase Configuration Issues

**Error**: Firebase app not initialized

**Solution**: Make sure your `.env` file has all required values:
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### 3. Functions Not Working

**Issue**: Cloud Functions not triggering

**Solution**: Deploy functions manually
```bash
npm run deploy:functions
```

If specific functions fail, deploy them individually:
```bash
firebase deploy --only functions:functionName --account ccehshmily@gmail.com
```

### 4. Firestore Permission Denied

**Error**: Missing or insufficient permissions

**Solution**: Make sure security rules are deployed
```bash
npm run deploy:rules
```

### 5. Development Server Issues

**Issue**: Changes not reflecting

**Solution**: 
1. Clear browser cache
2. Restart dev server
3. Check browser console for errors

## Quick Checks

1. **Authentication Status**:
   - Check Firebase Console > Authentication > Users
   - New users should appear here after signup

2. **Firestore Data**:
   - Check Firebase Console > Firestore Database
   - Look for `users` and `workspaces` collections

3. **Function Logs**:
   - Check Firebase Console > Functions > Logs
   - Look for errors or execution logs

4. **Browser Console**:
   - Open Developer Tools (F12)
   - Check for JavaScript errors
   - Check Network tab for failed requests