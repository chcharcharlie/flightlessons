# Deploy Storage Rules

The Firebase Storage rules have been updated to fix the file upload permission issue.

## Deploy Instructions

Run the following command from the `implementation` directory:

```bash
firebase deploy --only storage
```

## What Changed

1. Updated the `isCFI()` function to check both custom claims and Firestore user document
2. This ensures that CFIs can upload files even if their auth token doesn't have custom claims

## Testing

After deploying, try uploading a file again in the reference materials modal. The upload should now work correctly.

## Additional Notes

If you continue to see permission errors:
1. Sign out and sign back in to refresh your authentication token
2. Check that your user document in Firestore has `role: "CFI"`
3. Check that the workspace document has your user ID in the `cfiUid` field