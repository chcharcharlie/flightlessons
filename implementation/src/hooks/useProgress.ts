import { useState, useEffect } from 'react'
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Progress, GroundScore, FlightScore } from '@/types'

export const useProgress = (studentUid: string) => {
  const { user } = useAuth()
  const [progress, setProgress] = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.cfiWorkspaceId || !studentUid) {
      setLoading(false)
      return
    }

    const progressRef = collection(db, 'progress')
    const q = query(
      progressRef,
      where('studentUid', '==', studentUid),
      where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const progressData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Progress))
        setProgress(progressData)
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching progress:', err)
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user?.cfiWorkspaceId, studentUid])

  const recordProgress = async (
    itemId: string,
    score: GroundScore | FlightScore,
    scoreType: 'GROUND' | 'FLIGHT',
    notes: string = ''
  ) => {
    if (!user?.cfiWorkspaceId || !studentUid) {
      throw new Error('Missing required IDs')
    }

    const progressData = {
      studentUid,
      cfiWorkspaceId: user.cfiWorkspaceId,
      itemId,
      score,
      scoreType,
      notes,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    }

    await addDoc(collection(db, 'progress'), progressData)
  }

  return {
    progress,
    loading,
    error,
    recordProgress,
  }
}