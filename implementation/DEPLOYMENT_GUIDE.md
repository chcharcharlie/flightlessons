# Deployment Guide

This guide covers the complete deployment process for the FlightLessons application.

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project created at https://console.firebase.google.com
3. All services enabled (Auth, Firestore, Functions, Storage, Hosting)
4. Environment variables configured

## Deployment Steps

### 1. Deploy Firestore Indexes

Required indexes must be deployed before the application can query data:

```bash
firebase deploy --only firestore:indexes --account your-email@example.com
```

### 2. Deploy Security Rules

Deploy Firestore and Storage security rules:

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules --account your-email@example.com

# Deploy Storage rules  
firebase deploy --only storage --account your-email@example.com
```

### 3. Deploy Cloud Functions

Deploy all Cloud Functions with required environment variables:

```bash
# Set environment variables
firebase functions:config:set anthropic.api_key="your-anthropic-api-key"

# Deploy functions
npm run deploy:functions
```

### 4. Build and Deploy Frontend

Build the React app and deploy to Firebase Hosting:

```bash
# Build production version
npm run build

# Deploy to hosting
firebase deploy --only hosting --account your-email@example.com
```

### 5. Complete Deployment

Deploy everything at once:

```bash
npm run deploy
```

## Post-Deployment Setup

### 1. Create Initial CFI User

1. Sign up through the app
2. Use Firebase Admin SDK or console to set custom claims:
   ```javascript
   admin.auth().setCustomUserClaims(uid, { role: 'CFI' })
   ```

### 2. Verify Deployment

Check that all services are running:

1. **Hosting**: Visit your app URL
2. **Functions**: Check Firebase Console > Functions
3. **Firestore**: Check Firebase Console > Firestore Database
4. **Storage**: Check Firebase Console > Storage

### 3. Monitor Performance

- Use Firebase Console for monitoring
- Check Function logs for errors
- Monitor Firestore usage and costs

## Rollback Procedures

If deployment fails:

1. **Functions**: Deploy previous version from Functions console
2. **Hosting**: Rollback to previous version in Hosting console
3. **Rules**: Restore previous rules from version history

## Environment-Specific Deployments

For different environments (staging, production):

1. Create separate Firebase projects
2. Use Firebase aliases:
   ```bash
   firebase use --add staging
   firebase use --add production
   ```
3. Deploy to specific environment:
   ```bash
   firebase use staging
   npm run deploy
   ```