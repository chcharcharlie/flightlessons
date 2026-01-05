import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const bulkDeleteCurriculum = onCall(
  { 
    timeoutSeconds: 60,
    cors: true
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

    // Verify workspace ownership by checking if the workspace belongs to this CFI
    const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
    if (!workspaceDoc.exists || workspaceDoc.data()?.cfiUid !== request.auth.uid) {
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

      // Get workspace reference
      const workspaceRef = db.collection('workspaces').doc(workspaceId);

      if (deleteType === 'all' || deleteType === 'studyItems') {
        // First get all study areas for this certificate from workspace subcollection
        const studyAreasSnapshot = await workspaceRef
          .collection('studyAreas')
          .where('certificate', '==', certificate)
          .get();

        const areaIds = studyAreasSnapshot.docs.map(doc => doc.id);

        // Delete study items for each area from workspace subcollection
        for (const areaId of areaIds) {
          const itemsSnapshot = await workspaceRef
            .collection('studyItems')
            .where('studyAreaId', '==', areaId)
            .get();

          itemsSnapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            deletedCount++;
          });
        }
      }

      if (deleteType === 'all' || deleteType === 'studyAreas') {
        // Delete study areas from workspace subcollection
        const studyAreasSnapshot = await workspaceRef
          .collection('studyAreas')
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