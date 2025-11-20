# Storage Configuration Guide

This guide covers the complete Firebase Storage setup and configuration for the FlightLessons application.

## Storage Rules

The storage rules are defined in `storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /materials/{materialId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.token.role == 'CFI';
      allow delete: if request.auth != null && request.auth.token.role == 'CFI';
    }
  }
}
```

## Deploying Storage Rules

To deploy the storage rules:

```bash
firebase deploy --only storage --account ccehshmily@gmail.com
```

### Troubleshooting Storage Deployment

If you encounter errors during deployment:

1. **Check authentication:**
   ```bash
   firebase logout
   firebase login --reauth
   ```

2. **Verify project configuration:**
   ```bash
   firebase projects:list
   firebase use flightlessons-8b9bd --account ccehshmily@gmail.com
   ```

3. **Deploy with specific account:**
   ```bash
   firebase deploy --only storage --account ccehshmily@gmail.com
   ```

## Storage Structure

- **`/materials/{materialId}`** - Stores reference materials uploaded by CFIs
  - Only authenticated users can read
  - Only CFIs can write/delete
  - Files are referenced in lesson plan documents

## Usage in Application

The storage is integrated with the lesson planning system:
- CFIs can upload reference materials when creating/editing lesson plans
- Materials are automatically linked to lesson plans
- Students can access materials through their assigned lessons

## Security Model

The storage security model aligns with the application's role-based access:
- **Authentication required** for all operations
- **CFI role required** for write/delete operations
- **Role verification** through custom claims in auth tokens