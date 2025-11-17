import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const migrateStudyAreas = onCall(
  { 
    timeoutSeconds: 60,
    memory: '256MiB'
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

      // Get all study areas
      const allAreas = await db.collection('studyAreas').get();
      
      console.log(`Found ${allAreas.size} total study areas`);

      // Check each area
      for (const doc of allAreas.docs) {
        const data = doc.data();
        
        if (!data.cfiWorkspaceId) {
          // Add the workspace ID to areas that don't have it
          console.log(`Migrating study area: ${data.name} (${data.certificate})`);
          batch.update(doc.ref, { cfiWorkspaceId: workspaceId });
          migratedCount++;
        } else if (data.cfiWorkspaceId === workspaceId) {
          alreadyMigratedCount++;
        }
      }

      // Also migrate study items
      const allItems = await db.collection('studyItems').get();
      let migratedItems = 0;

      for (const doc of allItems.docs) {
        const data = doc.data();
        
        if (!data.cfiWorkspaceId) {
          batch.update(doc.ref, { cfiWorkspaceId: workspaceId });
          migratedItems++;
        }
      }

      // Also migrate lesson plans
      const allPlans = await db.collection('lessonPlans').get();
      let migratedPlans = 0;

      for (const doc of allPlans.docs) {
        const data = doc.data();
        
        if (!data.cfiWorkspaceId) {
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
              total: allPlans.size
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