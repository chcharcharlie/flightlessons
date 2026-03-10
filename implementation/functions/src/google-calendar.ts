import * as admin from 'firebase-admin';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');

const REDIRECT_URI = 'https://us-central1-flightlessons-8b9bd.cloudfunctions.net/googleCalendarCallback';
const CALLBACK_SUCCESS_URL = 'https://firstsolo.app/cfi/settings?calendarConnected=1';
const CALLBACK_SUCCESS_URL_STUDENT = 'https://firstsolo.app/student/settings?calendarConnected=1';

const db = admin.firestore();

function getOAuthClient(clientId: string, clientSecret: string) {
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

// ─── 1. Generate OAuth URL ────────────────────────────────────────────────────
export const googleCalendarAuthUrl = onCall(
  { cors: true, secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

    const oauth2Client = getOAuthClient(
      GOOGLE_CLIENT_ID.value(),
      GOOGLE_CLIENT_SECRET.value()
    );

    // Encode uid in state param so callback knows who to save tokens for
    const state = Buffer.from(JSON.stringify({ uid: request.auth.uid })).toString('base64');

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent', // always show consent to get refresh_token
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      state,
    });

    return { url };
  }
);

// ─── 2. OAuth Callback (redirect from Google) ─────────────────────────────────
export const googleCalendarCallback = onRequest(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] },
  async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    if (error) {
      res.redirect(`https://firstsolo.app/cfi/settings?calendarError=${error}`);
      return;
    }

    if (!code || !state) {
      res.status(400).send('Missing code or state');
      return;
    }

    let uid: string;
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      uid = decoded.uid;
    } catch {
      res.status(400).send('Invalid state param');
      return;
    }

    const oauth2Client = getOAuthClient(
      GOOGLE_CLIENT_ID.value(),
      GOOGLE_CLIENT_SECRET.value()
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Save tokens to Firestore
    await db.collection('users').doc(uid).update({
      googleCalendar: {
        connected: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry: tokens.expiry_date,
        calendarId: 'primary',
      },
    });

    // Detect role to redirect to correct settings page
    const userDoc = await db.collection('users').doc(uid).get();
    const role = userDoc.data()?.role;
    const successUrl = role === 'STUDENT' ? CALLBACK_SUCCESS_URL_STUDENT : CALLBACK_SUCCESS_URL;

    // Kick off background sync of all existing scheduled lessons
    bulkSyncForUser(uid, userDoc.data()!).catch(err =>
      console.error('Bulk sync after connect failed:', err)
    );

    res.redirect(successUrl);
  }
);

// ─── 3. Sync ALL existing lessons after connecting ────────────────────────────
export const syncAllLessonsToCalendar = onCall(
  { cors: true, secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');
    const uid = request.auth.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) throw new HttpsError('not-found', 'User not found');
    const count = await bulkSyncForUser(uid, userDoc.data()!);
    return { synced: count };
  }
);

async function bulkSyncForUser(uid: string, userData: FirebaseFirestore.DocumentData): Promise<number> {
  const role = userData.role;
  let lessonsSnap;
  if (role === 'CFI') {
    const workspaceId = userData.cfiWorkspaceId;
    if (!workspaceId) return 0;
    lessonsSnap = await db.collection('lessons')
      .where('cfiWorkspaceId', '==', workspaceId)
      .where('status', '==', 'SCHEDULED')
      .get();
  } else {
    lessonsSnap = await db.collection('lessons')
      .where('studentUid', '==', uid)
      .where('status', '==', 'SCHEDULED')
      .get();
  }

  let count = 0;
  for (const lessonDoc of lessonsSnap.docs) {
    try {
      await syncForUser(uid, lessonDoc.id, lessonDoc.data());
      count++;
    } catch (err: any) {
      console.error(`Bulk sync failed for lesson ${lessonDoc.id}:`, err.message);
    }
  }
  return count;
}

// ─── 4. Disconnect Google Calendar ───────────────────────────────────────────
export const googleCalendarDisconnect = onCall({ cors: true }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

  await db.collection('users').doc(request.auth.uid).update({
    googleCalendar: admin.firestore.FieldValue.delete(),
  });

  return { success: true };
});

// ─── 4. Sync lesson to Google Calendar ───────────────────────────────────────
// Called from frontend after: lesson created / rescheduled / cancelled
export const syncLessonToCalendar = onCall(
  { cors: true, secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be authenticated');

    const { lessonId } = request.data as { lessonId: string };
    if (!lessonId) throw new HttpsError('invalid-argument', 'lessonId required');

    const lessonDoc = await db.collection('lessons').doc(lessonId).get();
    if (!lessonDoc.exists) throw new HttpsError('not-found', 'Lesson not found');
    const lesson = lessonDoc.data()!;

    // Collect all user IDs to sync (CFI + student)
    const cfiUid = await getCfiUidFromWorkspace(lesson.cfiWorkspaceId);
    const uidsToSync = [lesson.studentUid, cfiUid].filter(Boolean) as string[];

    const results: Record<string, string> = {};

    for (const uid of uidsToSync) {
      try {
        const result = await syncForUser(uid, lessonId, lesson);
        results[uid] = result;
      } catch (err: any) {
        console.error(`Failed to sync for uid ${uid}:`, err.message);
        results[uid] = `error: ${err.message}`;
      }
    }

    return { results };
  }
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getCfiUidFromWorkspace(workspaceId: string): Promise<string | null> {
  const wsDoc = await db.collection('workspaces').doc(workspaceId).get();
  return wsDoc.data()?.cfiUid || null;
}

async function syncForUser(
  uid: string,
  lessonId: string,
  lesson: FirebaseFirestore.DocumentData
): Promise<string> {
  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.data()!;
  const gcal = userData?.googleCalendar;
  const role: string = userData?.role || 'STUDENT';

  if (!gcal?.connected || !gcal?.refreshToken) {
    return 'not_connected';
  }

  const clientId = GOOGLE_CLIENT_ID.value();
  const clientSecret = GOOGLE_CLIENT_SECRET.value();
  const oauth2Client = getOAuthClient(clientId, clientSecret);

  oauth2Client.setCredentials({
    access_token: gcal.accessToken,
    refresh_token: gcal.refreshToken,
    expiry_date: gcal.tokenExpiry,
  });

  // Auto-refresh token if needed and save new tokens
  oauth2Client.on('tokens', async (tokens) => {
    const update: Record<string, any> = {};
    if (tokens.access_token) update['googleCalendar.accessToken'] = tokens.access_token;
    if (tokens.expiry_date) update['googleCalendar.tokenExpiry'] = tokens.expiry_date;
    if (tokens.refresh_token) update['googleCalendar.refreshToken'] = tokens.refresh_token;
    await db.collection('users').doc(uid).update(update);
  });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
  const calendarId = gcal.calendarId || 'primary';

  // Get existing event ID for this user
  const eventIdField = `googleCalendarEventIds.${uid}`;
  const existingEventId = lesson.googleCalendarEventIds?.[uid];

  const isCancelled = lesson.status === 'CANCELLED';

  // If no scheduled date, skip
  if (!lesson.scheduledDate) return 'no_date';

  const startTime: Date =
    typeof lesson.scheduledDate.toDate === 'function'
      ? lesson.scheduledDate.toDate()
      : new Date(lesson.scheduledDate.seconds * 1000);

  const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000); // +3h

  if (isCancelled && existingEventId) {
    // Delete the event
    try {
      await calendar.events.delete({ calendarId, eventId: existingEventId });
      await db.collection('lessons').doc(lessonId).update({
        [eventIdField]: admin.firestore.FieldValue.delete(),
      });
      return 'deleted';
    } catch (e: any) {
      if (e.code === 404) return 'already_deleted';
      throw e;
    }
  }

  if (isCancelled) return 'cancelled_no_event';

  // Build role-specific title and description
  let summary: string;
  let description: string;

  if (role === 'CFI') {
    // Fetch student name
    let studentName = 'Student';
    try {
      const studentDoc = await db.collection('users').doc(lesson.studentUid).get();
      studentName = studentDoc.data()?.displayName || 'Student';
    } catch { /* ignore */ }

    const titleParts = ['Lesson:', studentName];
    if (lesson.title) titleParts.push(`- ${lesson.title}`);
    if (lesson.plannedRoute) titleParts.push(`(${lesson.plannedRoute})`);
    summary = `✈️ ${titleParts.join(' ')}`;
    description = buildDescriptionCFI(lesson);
  } else {
    // Student
    const titleParts = ['Lesson:'];
    if (lesson.title) titleParts.push(lesson.title);
    if (lesson.plannedRoute) titleParts.push(`(${lesson.plannedRoute})`);
    summary = `✈️ ${titleParts.join(' ')}`;
    description = buildDescriptionStudent(lesson);
  }

  const eventBody = {
    summary,
    description,
    start: { dateTime: startTime.toISOString() },
    end: { dateTime: endTime.toISOString() },
    colorId: '9', // blueberry
  };

  if (existingEventId) {
    // Update existing event
    await calendar.events.update({
      calendarId,
      eventId: existingEventId,
      requestBody: eventBody,
    });
    return 'updated';
  } else {
    // Create new event
    const resp = await calendar.events.insert({
      calendarId,
      requestBody: eventBody,
    });
    const newEventId = resp.data.id!;
    await db.collection('lessons').doc(lessonId).update({
      [eventIdField]: newEventId,
    });
    return 'created';
  }
}

function buildDescriptionCFI(lesson: FirebaseFirestore.DocumentData): string {
  const parts: string[] = [];
  if (lesson.motivation) parts.push(`📌 ${lesson.motivation}`);
  if (lesson.objectives?.length) {
    parts.push(`🎯 Objectives:\n${lesson.objectives.map((o: string) => `• ${o}`).join('\n')}`);
  }
  if (lesson.plannedRoute) parts.push(`🗺️ Route: ${lesson.plannedRoute}`);
  if (lesson.planDescription) parts.push(`📋 Plan: ${lesson.planDescription}`);
  if (lesson.preStudyHomework) parts.push(`📚 Pre-study homework: ${lesson.preStudyHomework}`);
  if (lesson.preNotes) parts.push(`📝 Pre-lesson notes: ${lesson.preNotes}`);
  parts.push('\nPowered by FirstSolo (firstsolo.app)');
  return parts.join('\n\n');
}

function buildDescriptionStudent(lesson: FirebaseFirestore.DocumentData): string {
  const parts: string[] = [];
  if (lesson.motivation) parts.push(`📌 ${lesson.motivation}`);
  if (lesson.objectives?.length) {
    parts.push(`🎯 Objectives:\n${lesson.objectives.map((o: string) => `• ${o}`).join('\n')}`);
  }
  if (lesson.plannedRoute) parts.push(`🗺️ Route: ${lesson.plannedRoute}`);
  if (lesson.preStudyHomework) parts.push(`📚 Pre-study homework: ${lesson.preStudyHomework}`);
  if (lesson.preNotes) parts.push(`📝 Pre-lesson notes: ${lesson.preNotes}`);
  parts.push('\nPowered by FirstSolo (firstsolo.app)');
  return parts.join('\n\n');
}
