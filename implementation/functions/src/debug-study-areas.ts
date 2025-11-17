import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const debugStudyAreas = onCall(
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

    try {
      // Get ALL study areas to see what's in the database
      const allAreas = await db.collection('studyAreas').get();
      
      const results = {
        totalStudyAreas: allAreas.size,
        userWorkspaceId: workspaceId,
        studyAreas: [] as any[],
        areasWithOldOrderField: 0
      };

      allAreas.docs.forEach(doc => {
        const data = doc.data();
        results.studyAreas.push({
          id: doc.id,
          name: data.name,
          certificate: data.certificate,
          cfiWorkspaceId: data.cfiWorkspaceId,
          orderNumber: data.orderNumber,
          belongsToUser: data.cfiWorkspaceId === workspaceId,
          hasOrderNumber: data.orderNumber !== undefined,
          allFields: Object.keys(data)
        });
      });

      // Also check for areas with old field names
      const areasWithOrder = await db.collection('studyAreas')
        .where('order', '!=', null)
        .get();
      
      results.areasWithOldOrderField = areasWithOrder.size;

      return results;

    } catch (error: any) {
      console.error('Debug error:', error);
      throw new HttpsError('internal', `Debug failed: ${error.message}`);
    }
  }
);