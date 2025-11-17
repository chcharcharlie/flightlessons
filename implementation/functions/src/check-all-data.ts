import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const checkAllData = onCall(
  { 
    timeoutSeconds: 60,
    memory: '256MiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const results: any = {
        collections: {},
        userInfo: {
          uid: request.auth.uid,
          email: request.auth.token.email
        }
      };

      // Get user document
      const userDoc = await db.collection('users').doc(request.auth.uid).get();
      if (userDoc.exists) {
        results.userInfo.userData = userDoc.data();
      }

      // Check all potential collections
      const collectionsToCheck = [
        'studyAreas',
        'study-areas',
        'study_areas',
        'studyItems',
        'study-items',
        'study_items',
        'lessonPlans',
        'lesson-plans',
        'lesson_plans',
        'workspaces',
        'cfiWorkspaces'
      ];

      for (const collectionName of collectionsToCheck) {
        try {
          const snapshot = await db.collection(collectionName).limit(5).get();
          if (!snapshot.empty) {
            results.collections[collectionName] = {
              count: snapshot.size,
              samples: snapshot.docs.map(doc => ({
                id: doc.id,
                data: doc.data(),
                fields: Object.keys(doc.data())
              }))
            };
          }
        } catch (error) {
          // Collection doesn't exist or no access
          results.collections[collectionName] = { error: 'Not found or no access' };
        }
      }

      // Also check subcollections under workspace
      if (results.userInfo.userData?.cfiWorkspaceId) {
        const workspaceId = results.userInfo.userData.cfiWorkspaceId;
        results.workspaceId = workspaceId;

        // Check workspace subcollections
        const workspaceDoc = db.collection('workspaces').doc(workspaceId);
        
        try {
          const workspace = await workspaceDoc.get();
          if (workspace.exists) {
            results.workspace = workspace.data();
          }

          // Check for subcollections
          const subcollections = ['studyAreas', 'studyItems', 'lessonPlans', 'students'];
          for (const sub of subcollections) {
            try {
              const subSnapshot = await workspaceDoc.collection(sub).limit(5).get();
              if (!subSnapshot.empty) {
                results.collections[`workspaces/${workspaceId}/${sub}`] = {
                  count: subSnapshot.size,
                  samples: subSnapshot.docs.map(doc => ({
                    id: doc.id,
                    data: doc.data()
                  }))
                };
              }
            } catch (error) {
              // Subcollection doesn't exist
            }
          }
        } catch (error: any) {
          results.workspaceError = error.message;
        }
      }

      return results;

    } catch (error: any) {
      console.error('Check data error:', error);
      throw new HttpsError('internal', `Check failed: ${error.message}`);
    }
  }
);