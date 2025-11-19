import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  Unsubscribe,
  serverTimestamp
} from 'firebase/firestore'
import { db, auth } from './firebase'

export interface AIProgressUpdate {
  id: string
  timestamp: string | Timestamp // Can be string from backend or Timestamp
  type: 'conversation_turn' | 'tool_execution' | 'tool_result' | 'completion'
  conversationTurn?: number
  toolName?: string
  toolParameters?: any
  toolResult?: string
  toolCallId?: string
  message?: string
  error?: string
}

export interface AIProgressSession {
  id: string
  userId: string
  startedAt: Timestamp
  completedAt?: Timestamp
  updates: AIProgressUpdate[]
}

/**
 * Initialize a progress session document
 */
export async function initializeProgressSession(sessionId: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated')
  }

  try {
    const progressRef = doc(db, 'aiProgress', sessionId)
    await setDoc(progressRef, {
      id: sessionId,
      userId: auth.currentUser.uid,
      startedAt: serverTimestamp(),
      updates: []
    })
  } catch (error) {
    console.error('[AI Progress] Failed to initialize session:', error)
    // Don't throw - the Cloud Function will create it if needed
  }
}

/**
 * Subscribe to real-time progress updates for an AI session
 */
export function subscribeToAIProgress(
  sessionId: string,
  onUpdate: (update: AIProgressUpdate) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const progressRef = doc(db, 'aiProgress', sessionId)

  let lastUpdateCount = 0

  return onSnapshot(
    progressRef,
    (snapshot) => {

      if (!snapshot.exists()) {
        return
      }

      const data = snapshot.data() as AIProgressSession
      const updates = data.updates || []


      // Send all new updates since last check
      if (updates.length > lastUpdateCount) {
        // Get all updates we haven't sent yet
        const newUpdates = updates.slice(lastUpdateCount)

        newUpdates.forEach((update) => {
          onUpdate(update)
        })

        lastUpdateCount = updates.length
      }
    },
    (error) => {
      console.error('[AI Progress] Error listening to progress:', error)
      onError?.(error)
    }
  )
}