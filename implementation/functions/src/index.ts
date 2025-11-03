import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { beforeUserCreated } from 'firebase-functions/v2/identity';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// User creation trigger - create user document and workspace
export const onUserCreated = beforeUserCreated(async (event) => {
  const user = event.data;
  if (!user) return;
  
  const { uid, email, displayName } = user;
  
  try {
    // Create user document
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      uid,
      email: email || '',
      displayName: displayName || email?.split('@')[0] || 'User',
      role: 'STUDENT', // Default role, will be updated during registration
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        notifications: {
          email: true,
          lessonReminders: true,
        },
      },
    });
    
    // User document created successfully
  } catch (error) {
    throw error;
  }
});

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
  if (!request.auth || request.auth.token.role !== 'CFI') {
    throw new HttpsError('permission-denied', 'Only CFIs can invite students');
  }
  
  const { email, workspaceId } = request.data;
  
  if (!email || !workspaceId) {
    throw new HttpsError('invalid-argument', 'Email and workspace ID required');
  }
  
  try {
    // Verify workspace ownership
    const workspace = await db.collection('workspaces').doc(workspaceId).get();
    if (!workspace.exists || workspace.data()?.cfiUid !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Invalid workspace');
    }
    
    // TODO: Send invitation email
    // For now, we'll just create a pending invitation
    await db.collection('invitations').add({
      email,
      workspaceId,
      cfiUid: request.auth.uid,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  } catch (error) {
    // Error inviting student
    throw new HttpsError('internal', 'Failed to invite student');
  }
});

// Record progress
export const recordProgress = onCall(async (request) => {
  if (!request.auth || request.auth.token.role !== 'CFI') {
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

// Update progress aggregations when new progress is created
export const onProgressCreated = onDocumentCreated('progress/{progressId}', async (event) => {
    const progress = event.data?.data();
    
    // TODO: Update student progress aggregations
    // TODO: Check for milestone achievements
    // TODO: Send notifications if needed
    
    // Progress recorded
  });