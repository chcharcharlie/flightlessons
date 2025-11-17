import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const bulkDeleteCurriculum = onCall(
  { 
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { workspaceId, certificate, deleteType } = request.data;

    if (!workspaceId || !certificate || !deleteType) {
      throw new HttpsError('invalid-argument', 'Missing required parameters');
    }

    // Get user from Firestore and verify CFI role
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
      throw new HttpsError('permission-denied', 'Only CFIs can delete curriculum');
    }

    // Verify workspace ownership
    if (userDoc.data()?.cfiWorkspaceId !== workspaceId) {
      throw new HttpsError('permission-denied', 'Invalid workspace');
    }

    try {
      const batch = db.batch();
      let deletedCount = 0;

      if (deleteType === 'all' || deleteType === 'lessonPlans') {
        // Delete lesson plans
        const lessonPlansSnapshot = await db
          .collection('lessonPlans')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', certificate)
          .get();

        lessonPlansSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });
      }

      if (deleteType === 'all' || deleteType === 'studyItems') {
        // First get all study areas for this certificate
        const studyAreasSnapshot = await db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', certificate)
          .get();

        const areaIds = studyAreasSnapshot.docs.map(doc => doc.id);

        // Delete study items for each area
        for (const areaId of areaIds) {
          const itemsSnapshot = await db
            .collection('studyItems')
            .where('cfiWorkspaceId', '==', workspaceId)
            .where('studyAreaId', '==', areaId)
            .get();

          itemsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
          });
        }
      }

      if (deleteType === 'all' || deleteType === 'studyAreas') {
        // Delete study areas
        const studyAreasSnapshot = await db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', certificate)
          .get();

        studyAreasSnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
          deletedCount++;
        });
      }

      // Commit the batch
      await batch.commit();

      return {
        success: true,
        deletedCount,
        message: `Successfully deleted ${deletedCount} items from ${certificate} certificate curriculum`
      };

    } catch (error: any) {
      console.error('Bulk delete error:', error);
      throw new HttpsError('internal', 'Failed to delete curriculum items');
    }
  }
);