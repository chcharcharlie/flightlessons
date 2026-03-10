import * as admin from 'firebase-admin';
import { onRequest } from 'firebase-functions/v2/https';
import ical, { ICalEventStatus } from 'ical-generator';

const db = admin.firestore();

/**
 * Calendar feed endpoint — returns ICS for a user's lessons.
 * URL: /calendarFeed?userId=xxx&token=yyy
 *
 * Supports both CFI (sees all their students' lessons) and
 * Students (sees their own lessons).
 * Default lesson duration: 3 hours.
 */
export const calendarFeed = onRequest({ cors: true }, async (req, res) => {
  const { userId, token } = req.query as { userId?: string; token?: string };

  if (!userId || !token) {
    res.status(400).send('Missing userId or token');
    return;
  }

  // Validate token
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) {
    res.status(404).send('User not found');
    return;
  }

  const userData = userDoc.data()!;
  if (userData.calendarToken !== token) {
    res.status(403).send('Invalid token');
    return;
  }

  const role: string = userData.role; // 'CFI' or 'STUDENT'
  const displayName: string = userData.displayName || 'FirstSolo User';

  // Fetch lessons
  let lessonsSnap;
  if (role === 'CFI') {
    const workspaceId = userData.cfiWorkspaceId;
    if (!workspaceId) {
      res.status(400).send('CFI has no workspace');
      return;
    }
    lessonsSnap = await db
      .collection('lessons')
      .where('cfiWorkspaceId', '==', workspaceId)
      .get();
  } else {
    // STUDENT
    lessonsSnap = await db
      .collection('lessons')
      .where('studentUid', '==', userId)
      .get();
  }

  // Build ICS calendar
  const calendar = ical({
    name: `FirstSolo — ${displayName}`,
    prodId: { company: 'FirstSolo', product: 'firstsolo-app', language: 'EN' },
    timezone: 'America/Los_Angeles',
  });

  for (const lessonDoc of lessonsSnap.docs) {
    const lesson = lessonDoc.data();

    // Only include lessons that have a scheduled date
    if (!lesson.scheduledDate) continue;

    const startDate: Date =
      typeof lesson.scheduledDate.toDate === 'function'
        ? lesson.scheduledDate.toDate()
        : new Date(lesson.scheduledDate.seconds * 1000);

    const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // +3 hours

    const isCancelled = lesson.status === 'CANCELLED';

    const event = calendar.createEvent({
      id: `${lessonDoc.id}@firstsolo.app`,
      start: startDate,
      end: endDate,
      summary: lesson.title
        ? `✈️ ${lesson.title}`
        : '✈️ Flight Lesson',
      description: buildDescription(lesson),
      status: isCancelled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
      url: `https://firstsolo.app`,
    });

    // Mark cancelled events visually
    if (isCancelled) {
      event.summary(`❌ [CANCELLED] ${lesson.title || 'Flight Lesson'}`);
    }
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="firstsolo-lessons.ics"');
  res.send(calendar.toString());
});

function buildDescription(lesson: FirebaseFirestore.DocumentData): string {
  const parts: string[] = [];

  if (lesson.motivation) parts.push(`📌 Motivation: ${lesson.motivation}`);
  if (lesson.objectives?.length) {
    parts.push(`🎯 Objectives:\n${lesson.objectives.map((o: string) => `  • ${o}`).join('\n')}`);
  }
  if (lesson.planDescription) parts.push(`📋 Plan: ${lesson.planDescription}`);
  if (lesson.plannedRoute) parts.push(`🗺️ Route: ${lesson.plannedRoute}`);
  if (lesson.preStudyHomework) parts.push(`📚 Pre-study: ${lesson.preStudyHomework}`);
  if (lesson.preNotes) parts.push(`📝 Notes: ${lesson.preNotes}`);

  parts.push('\nPowered by FirstSolo (firstsolo.app)');
  return parts.join('\n\n');
}
