# Fix Study Areas Not Showing Up

The issue is that your study areas are missing the `cfiWorkspaceId` field, which is required for the AI to find them.

## Quick Fix

Run this in your browser console (press F12, go to Console tab):

```javascript
// Import required functions
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

// Call the migration function
const migrate = httpsCallable(functions, 'migrateStudyAreas');
migrate().then(result => {
  console.log('Migration result:', result.data);
  // Refresh the page after 2 seconds
  setTimeout(() => window.location.reload(), 2000);
}).catch(error => {
  console.error('Migration failed:', error);
});
```

## What This Does

1. Finds all study areas, study items, and lesson plans without a workspace ID
2. Adds your current workspace ID to them
3. Makes them visible to the AI assistant

## After Running

- Wait for the page to refresh
- Try asking the AI "what study areas do we have?" again
- Your 3 study areas should now be visible

## Alternative: Manual Fix

If the above doesn't work, you can also:
1. Delete the existing study areas
2. Recreate them through the UI
3. New areas will automatically have the workspace ID

## Why This Happened

Your study areas were created before the multi-workspace feature was added. The AI queries filter by workspace ID for security, so areas without this field are invisible to the AI.