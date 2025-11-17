import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
// import { beforeUserCreated } from 'firebase-functions/v2/identity';

// Initialize Firebase Admin
admin.initializeApp();

// Export AI chat function
export { aiChat } from './ai-chat';
export { aiChatWithTools } from './ai-chat-with-tools';

// Export bulk operations
export { bulkDeleteCurriculum } from './bulk-operations';

// Debug function
export { debugStudyAreas } from './debug-study-areas';

// Migration function
export { migrateStudyAreas } from './migrate-study-areas';

// Data check function
export { checkAllData } from './check-all-data';

const db = admin.firestore();
const auth = admin.auth();

// User creation is now handled in the frontend during registration
// This was causing deployment issues with blocking functions

// Set user role (called during registration)
export const setUserRole = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { role } = request.data;
  const uid = request.auth.uid;
  
  if (!['CFI', 'STUDENT'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role');
  }
  
  try {
    // Update user document
    await db.collection('users').doc(uid).update({ role });
    
    // Set custom claims
    await auth.setCustomUserClaims(uid, { role });
    
    // If CFI, create workspace
    if (role === 'CFI') {
      const workspace = await db.collection('workspaces').add({
        cfiUid: uid,
        name: `${request.auth.token.name || 'CFI'}'s Workspace`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        studentCount: 0,
        settings: {
          defaultLessonDuration: {
            ground: 60, // minutes
            flight: 1.5, // hours
          },
        },
      });
      
      // Update user with workspace ID
      await db.collection('users').doc(uid).update({
        cfiWorkspaceId: workspace.id,
      });
    }
    
    return { success: true };
  } catch (error) {
    // Error setting user role
    throw new HttpsError('internal', 'Failed to set user role');
  }
});

// Invite student
export const inviteStudent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { email, workspaceId } = request.data;
  
  if (!email || !workspaceId) {
    throw new HttpsError('invalid-argument', 'Email and workspace ID required');
  }
  
  try {
    // Get user role from Firestore
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
      throw new HttpsError('permission-denied', 'Only CFIs can invite students');
    }
    
    // Verify workspace ownership
    const workspace = await db.collection('workspaces').doc(workspaceId).get();
    if (!workspace.exists || workspace.data()?.cfiUid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Invalid workspace');
    }
    
    // Get CFI details for the invitation
    const cfiData = userDoc.data();
    const cfiName = cfiData?.displayName || 'A flight instructor';
    
    // Create a pending invitation
    const invitationRef = await db.collection('invitations').add({
      email,
      workspaceId,
      cfiUid: request.auth.uid,
      cfiName,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    // Generate a unique invitation link
    const invitationLink = `${process.env.APP_URL || 'https://flightlessons-8b9bd.web.app'}/accept-invitation?id=${invitationRef.id}`;
    
    // For now, we'll return the invitation link
    // In production, you would integrate with an email service like SendGrid
    console.log(`Invitation link for ${email}: ${invitationLink}`);
    
    return { 
      success: true, 
      invitationLink,
      message: `Invitation created. Share this link with ${email}: ${invitationLink}`
    };
  } catch (error) {
    // Error inviting student
    throw new HttpsError('internal', 'Failed to invite student');
  }
});

// Record progress
export const recordProgress = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  // Get user role from Firestore
  const userDoc = await db.collection('users').doc(request.auth.uid).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
    throw new HttpsError('permission-denied', 'Only CFIs can record progress');
  }
  
  const { studentUid, cfiWorkspaceId, itemId, score, scoreType, lessonId, notes } = request.data;
  
  try {
    // Verify student enrollment
    const enrollment = await db
      .collection('workspaces')
      .doc(cfiWorkspaceId)
      .collection('students')
      .doc(studentUid)
      .get();
      
    if (!enrollment.exists) {
      throw new HttpsError('permission-denied', 'Student not enrolled');
    }
    
    // Create progress record
    const progressRef = await db.collection('progress').add({
      studentUid,
      cfiWorkspaceId,
      itemId,
      score,
      scoreType,
      lessonId: lessonId || null,
      notes: notes || '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: request.auth.uid,
    });
    
    return { success: true, progressId: progressRef.id };
  } catch (error) {
    // Error recording progress
    throw new HttpsError('internal', 'Failed to record progress');
  }
});

// Accept invitation
export const acceptInvitation = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { invitationId } = request.data;
  
  if (!invitationId) {
    throw new HttpsError('invalid-argument', 'Invitation ID required');
  }
  
  try {
    // Get invitation
    const invitationDoc = await db.collection('invitations').doc(invitationId).get();
    if (!invitationDoc.exists) {
      throw new HttpsError('not-found', 'Invitation not found');
    }
    
    const invitation = invitationDoc.data();
    
    // Validate invitation
    if (invitation?.status !== 'pending') {
      throw new HttpsError('failed-precondition', 'Invitation already used');
    }
    
    if (invitation?.email !== request.auth.token.email) {
      throw new HttpsError('permission-denied', 'This invitation is for a different email');
    }
    
    // Update user document
    const userRef = db.collection('users').doc(request.auth.uid);
    await userRef.update({
      role: 'STUDENT',
      cfiWorkspaceId: invitation.workspaceId,
    });
    
    // Add student to workspace
    const workspaceRef = db.collection('workspaces').doc(invitation.workspaceId);
    const studentRef = workspaceRef.collection('students').doc(request.auth.uid);
    
    await studentRef.set({
      uid: request.auth.uid,
      enrollmentDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'ACTIVE',
    });
    
    // Update workspace student count
    await workspaceRef.update({
      studentCount: admin.firestore.FieldValue.increment(1),
    });
    
    // Update invitation status
    await invitationDoc.ref.update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      acceptedBy: request.auth.uid,
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error accepting invitation:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to accept invitation');
  }
});

// Update progress aggregations when new progress is created
export const onProgressCreated = onDocumentCreated('progress/{progressId}', async (event) => {
    const progressData = event.data?.data();
    if (!progressData) return;
    
    // TODO: Update student progress aggregations
    // TODO: Check for milestone achievements
    // TODO: Send notifications if needed
    
    // Progress recorded for student: progressData.studentUid
  });