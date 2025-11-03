# Firebase Storage Setup

Since Firebase Storage rules deployment is failing, you need to set up Storage in the Firebase Console first:

1. **Go to Firebase Console**: https://console.firebase.google.com/project/flightlessons-8b9bd/storage
2. **Click "Get Started"** if Storage hasn't been activated yet
3. **Choose a location** (same region as your Firestore database)
4. **Start in production mode** (we'll apply our security rules)

Once Storage is activated, you can deploy the rules:

```bash
firebase deploy --only storage --account ccehshmily@gmail.com
```

## Alternative: Apply Rules Manually

If deployment still fails, you can apply the rules manually:

1. Go to Firebase Console > Storage > Rules tab
2. Replace the default rules with our storage.rules content:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isCFI() {
      return isSignedIn() && request.auth.token.role == 'CFI';
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    match /workspaces/{workspaceId}/materials/{fileName} {
      allow read: if isSignedIn();
      allow write: if isCFI() && 
        firestore.get(/databases/(default)/documents/workspaces/$(workspaceId)).data.cfiUid == request.auth.uid;
    }
    
    match /users/{userId}/profile/{fileName} {
      allow read: if isSignedIn();
      allow write: if isOwner(userId);
    }
    
    match /lessons/{lessonId}/attachments/{fileName} {
      allow read: if isSignedIn();
      allow write: if isCFI();
    }
  }
}
```

3. Click "Publish"