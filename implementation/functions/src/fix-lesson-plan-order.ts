import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const fixLessonPlanOrder = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user and verify they're a CFI
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
      throw new HttpsError('permission-denied', 'Only CFIs can run this migration');
    }

    const workspaceId = userDoc.data()?.cfiWorkspaceId;
    if (!workspaceId) {
      throw new HttpsError('failed-precondition', 'No workspace found for user');
    }

    try {
      // Find all lesson plans for this workspace that have 'order' field
      const lessonPlansQuery = await db
        .collection('lessonPlans')
        .where('cfiWorkspaceId', '==', workspaceId)
        .get();

      const batch = db.batch();
      let updatedCount = 0;

      for (const doc of lessonPlansQuery.docs) {
        const data = doc.data();
        
        // If the document has 'order' but not 'orderNumber', fix it
        if ('order' in data && !('orderNumber' in data)) {
          batch.update(doc.ref, {
            orderNumber: data.order,
            order: admin.firestore.FieldValue.delete()
          });
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        await batch.commit();
        return {
          success: true,
          message: `Fixed ${updatedCount} lesson plans by renaming 'order' to 'orderNumber'`
        };
      } else {
        return {
          success: true,
          message: 'No lesson plans needed fixing - all already have orderNumber field'
        };
      }
    } catch (error: any) {
      console.error('Error fixing lesson plan order:', error);
      throw new HttpsError('internal', `Failed to fix lesson plans: ${error.message}`);
    }
  }
);