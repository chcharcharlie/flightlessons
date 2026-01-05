import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

export const fixCompletedDates = onCall(
  { 
    cors: true,
    region: 'us-central1'
  }, 
  async (request) => {
  // Check if user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  try {
    // Get all completed lessons
    const lessonsSnapshot = await db.collection('lessons')
      .where('status', '==', 'COMPLETED')
      .get();

    const batch = db.batch();
    let updatedCount = 0;

    for (const lessonDoc of lessonsSnapshot.docs) {
      const lesson = lessonDoc.data();
      
      // Skip if lesson doesn't have a completedDate
      if (!lesson.completedDate) {
        continue;
      }

      // Determine the correct completedDate
      let newCompletedDate;
      
      if (lesson.actualDate) {
        // Use actual execution date if available
        newCompletedDate = lesson.actualDate;
      } else if (lesson.scheduledDate) {
        // Otherwise use scheduled date
        newCompletedDate = lesson.scheduledDate;
      } else {
        // If neither exists, keep the existing completedDate
        continue;
      }

      // Only update if the date would change
      const currentCompletedTimestamp = lesson.completedDate.toMillis ? lesson.completedDate.toMillis() : lesson.completedDate.seconds * 1000;
      const newCompletedTimestamp = newCompletedDate.toMillis ? newCompletedDate.toMillis() : newCompletedDate.seconds * 1000;
      
      // Check if dates are significantly different (more than 1 minute apart)
      if (Math.abs(currentCompletedTimestamp - newCompletedTimestamp) > 60000) {
        batch.update(lessonDoc.ref, { completedDate: newCompletedDate });
        updatedCount++;
      }
    }

    await batch.commit();

    return {
      success: true,
      message: `Updated ${updatedCount} lessons with corrected completion dates`,
      totalCompleted: lessonsSnapshot.size,
      updated: updatedCount
    };
  } catch (error) {
    console.error('Error fixing completed dates:', error);
    throw new HttpsError(
      'internal',
      'Failed to fix completed dates'
    );
  }
});