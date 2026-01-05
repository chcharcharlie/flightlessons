import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const migrateStudyAreas = onCall(
  { 
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user and workspace
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
      throw new HttpsError('permission-denied', 'Only CFIs can use this function');
    }

    const workspaceId = userDoc.data()?.cfiWorkspaceId;
    if (!workspaceId) {
      throw new HttpsError('failed-precondition', 'No workspace found for user');
    }

    try {
      const batch = db.batch();
      let migratedCount = 0;
      let alreadyMigratedCount = 0;

      // Get study areas from the workspace subcollection
      const workspaceRef = db.collection('workspaces').doc(workspaceId);
      const allAreas = await workspaceRef.collection('studyAreas').get();
      
      console.log(`Found ${allAreas.size} study areas in workspace ${workspaceId}`);

      // Add cfiWorkspaceId to each area that doesn't have it
      for (const doc of allAreas.docs) {
        const data = doc.data();
        console.log(`Study area: ${data.name}, certificate: ${data.certificate}, has cfiWorkspaceId: ${!!data.cfiWorkspaceId}`);
        
        if (!data.cfiWorkspaceId) {
          // Add the workspace ID
          console.log(`Adding cfiWorkspaceId to study area: ${data.name}`);
          batch.update(doc.ref, { cfiWorkspaceId: workspaceId });
          migratedCount++;
        } else {
          alreadyMigratedCount++;
        }
      }

      // Also migrate study items from workspace subcollection
      const allItems = await workspaceRef.collection('studyItems').get();
      let migratedItems = 0;

      console.log(`Found ${allItems.size} study items in workspace`);

      for (const doc of allItems.docs) {
        const data = doc.data();
        
        if (!data.cfiWorkspaceId) {
          console.log(`Adding cfiWorkspaceId to study item: ${data.name}`);
          batch.update(doc.ref, { cfiWorkspaceId: workspaceId });
          migratedItems++;
        }
      }

      // Check for lesson plans in both locations
      let migratedPlans = 0;
      
      // First check workspace subcollection
      const workspacePlans = await workspaceRef.collection('lessonPlans').get();
      console.log(`Found ${workspacePlans.size} lesson plans in workspace subcollection`);
      
      for (const doc of workspacePlans.docs) {
        const data = doc.data();
        
        if (!data.cfiWorkspaceId) {
          console.log(`Adding cfiWorkspaceId to lesson plan: ${data.title}`);
          batch.update(doc.ref, { cfiWorkspaceId: workspaceId });
          migratedPlans++;
        }
      }
      
      // Also check top-level collection (newer structure)
      const topLevelPlans = await db.collection('lessonPlans')
        .where('certificate', 'in', ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'])
        .get();
      console.log(`Found ${topLevelPlans.size} lesson plans in top-level collection`);
      
      for (const doc of topLevelPlans.docs) {
        const data = doc.data();
        
        if (!data.cfiWorkspaceId) {
          console.log(`Adding cfiWorkspaceId to lesson plan: ${data.title}`);
          batch.update(doc.ref, { cfiWorkspaceId: workspaceId });
          migratedPlans++;
        }
      }

      if (migratedCount > 0 || migratedItems > 0 || migratedPlans > 0) {
        await batch.commit();
        return {
          success: true,
          message: `Migration complete! Migrated ${migratedCount} study areas, ${migratedItems} study items, and ${migratedPlans} lesson plans.`,
          details: {
            studyAreas: {
              migrated: migratedCount,
              alreadyHadWorkspace: alreadyMigratedCount,
              total: allAreas.size
            },
            studyItems: {
              migrated: migratedItems,
              total: allItems.size
            },
            lessonPlans: {
              migrated: migratedPlans,
              total: workspacePlans.size + topLevelPlans.size
            }
          }
        };
      } else {
        return {
          success: true,
          message: 'No migration needed. All items already have workspace IDs.',
          details: {
            studyAreas: {
              total: allAreas.size,
              withWorkspace: alreadyMigratedCount
            }
          }
        };
      }

    } catch (error: any) {
      console.error('Migration error:', error);
      throw new HttpsError('internal', `Migration failed: ${error.message}`);
    }
  }
);