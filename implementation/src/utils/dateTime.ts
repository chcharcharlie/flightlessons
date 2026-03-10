import { Timestamp } from 'firebase/firestore'

/**
 * Parse a local date + time string pair into a Firestore Timestamp.
 *
 * IMPORTANT: `new Date('2026-03-10T09:00')` is spec-ambiguous in older browsers
 * and some environments treat it as UTC instead of local time.
 * This function explicitly constructs a Date from parts so it's always local time.
 *
 * @param dateStr  'YYYY-MM-DD'
 * @param timeStr  'HH:mm'  (defaults to '09:00')
 */
export function localDateTimeToTimestamp(dateStr: string, timeStr = '09:00'): Timestamp {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  // new Date(year, monthIndex, day, hour, minute) is always local time
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0)
  return Timestamp.fromDate(localDate)
}

/**
 * Convert a Firestore Timestamp (or any timestamp-like value) to a JS Date.
 * Returns null if the value is falsy or can't be parsed.
 */
export function toDate(timestamp: any): Date | null {
  if (!timestamp) return null
  try {
    if (typeof timestamp.toDate === 'function') return timestamp.toDate()
    if (timestamp instanceof Date) return timestamp
    if (typeof timestamp.seconds === 'number') return new Date(timestamp.seconds * 1000)
    return new Date(timestamp)
  } catch {
    return null
  }
}

/**
 * Extract 'YYYY-MM-DD' and 'HH:mm' strings from a Firestore Timestamp,
 * using the user's local timezone (for display in <input type="date/time">).
 */
export function timestampToLocalInputs(timestamp: any): { dateStr: string; timeStr: string } | null {
  const d = toDate(timestamp)
  if (!d) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  return { dateStr: `${year}-${month}-${day}`, timeStr: `${hour}:${minute}` }
}
