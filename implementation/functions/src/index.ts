import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

// User creation trigger - create user document and workspace
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
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
    
    console.log(`Created user document for ${uid}`);
  } catch (error) {
    console.error('Error creating user document:', error);
  }
});

// Set user role (called during registration)
export const setUserRole = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { role } = data;
  const uid = context.auth.uid;
  
  if (!['CFI', 'STUDENT'].includes(role)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid role');
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
        name: `${context.auth.token.name || 'CFI'}'s Workspace`,
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
    console.error('Error setting user role:', error);
    throw new functions.https.HttpsError('internal', 'Failed to set user role');
  }
});

// Invite student
export const inviteStudent = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'CFI') {
    throw new functions.https.HttpsError('permission-denied', 'Only CFIs can invite students');
  }
  
  const { email, workspaceId } = data;
  
  if (!email || !workspaceId) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and workspace ID required');
  }
  
  try {
    // Verify workspace ownership
    const workspace = await db.collection('workspaces').doc(workspaceId).get();
    if (!workspace.exists || workspace.data()?.cfiUid !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Invalid workspace');
    }
    
    // TODO: Send invitation email
    // For now, we'll just create a pending invitation
    await db.collection('invitations').add({
      email,
      workspaceId,
      cfiUid: context.auth.uid,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error inviting student:', error);
    throw new functions.https.HttpsError('internal', 'Failed to invite student');
  }
});

// Record progress
export const recordProgress = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token.role !== 'CFI') {
    throw new functions.https.HttpsError('permission-denied', 'Only CFIs can record progress');
  }
  
  const { studentUid, cfiWorkspaceId, itemId, score, scoreType, lessonId, notes } = data;
  
  try {
    // Verify student enrollment
    const enrollment = await db
      .collection('workspaces')
      .doc(cfiWorkspaceId)
      .collection('students')
      .doc(studentUid)
      .get();
      
    if (!enrollment.exists) {
      throw new functions.https.HttpsError('permission-denied', 'Student not enrolled');
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
      createdBy: context.auth.uid,
    });
    
    return { success: true, progressId: progressRef.id };
  } catch (error) {
    console.error('Error recording progress:', error);
    throw new functions.https.HttpsError('internal', 'Failed to record progress');
  }
});

// Update progress aggregations when new progress is created
export const onProgressCreated = functions.firestore
  .document('progress/{progressId}')
  .onCreate(async (snap, context) => {
    const progress = snap.data();
    
    // TODO: Update student progress aggregations
    // TODO: Check for milestone achievements
    // TODO: Send notifications if needed
    
    console.log('Progress recorded:', progress);
  });