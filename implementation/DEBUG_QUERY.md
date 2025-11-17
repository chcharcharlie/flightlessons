# Debug Query for Study Areas

Run this in your browser console to check what study areas exist:

```javascript
// Run this in the browser console while on the curriculum page
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

async function debugStudyAreas() {
  try {
    // Get ALL study areas
    const allAreas = await getDocs(collection(db, 'studyAreas'));
    
    console.log('Total study areas in database:', allAreas.size);
    
    allAreas.forEach(doc => {
      const data = doc.data();
      console.log('Study Area:', {
        id: doc.id,
        name: data.name,
        certificate: data.certificate,
        cfiWorkspaceId: data.cfiWorkspaceId,
        hasWorkspaceId: !!data.cfiWorkspaceId,
        order: data.order,
        allFields: Object.keys(data)
      });
    });
    
    // Also check current user's workspace
    const auth = getAuth();
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      console.log('Current user workspace:', userDoc.data()?.cfiWorkspaceId);
    }
  } catch (error) {
    console.error('Debug error:', error);
  }
}

debugStudyAreas();
```

This will show:
1. How many study areas exist in total
2. What fields each study area has
3. Whether they have the cfiWorkspaceId field
4. What your current workspace ID is

Based on the output, we can determine if:
- The study areas are missing the cfiWorkspaceId field
- They have a different workspace ID
- They're in a different collection