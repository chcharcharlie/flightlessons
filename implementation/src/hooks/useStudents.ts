import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
  getDoc,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Student, User } from '@/types'

export interface StudentWithDetails extends Student {
  displayName: string
  email: string
}

export const useStudents = () => {
  const { user } = useAuth()
  const [students, setStudents] = useState<StudentWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const studentsRef = collection(workspaceRef, 'students')

    // Subscribe to students in the workspace
    const unsubscribe = onSnapshot(
      studentsRef,
      async (snapshot) => {
        try {
          // Get student UIDs
          const studentPromises = snapshot.docs.map(async (studentDoc) => {
            const studentData = studentDoc.data() as Student
            
            // Get user details
            const userDoc = await getDoc(doc(db, 'users', studentData.uid))
            const userData = userDoc.data() as User
            
            return {
              ...studentData,
              displayName: userData?.displayName || 'Unknown',
              email: userData?.email || 'unknown@example.com',
            } as StudentWithDetails
          })

          const studentsData = await Promise.all(studentPromises)
          setStudents(studentsData)
          setLoading(false)
        } catch (err) {
          setError('Failed to load student details')
          setLoading(false)
        }
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [user?.cfiWorkspaceId])

  const inviteStudent = async (email: string) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const inviteStudentFunction = httpsCallable<
      { email: string; workspaceId: string },
      { success: boolean; invitationLink?: string; message?: string }
    >(functions, 'inviteStudent')
    
    try {
      const result = await inviteStudentFunction({ 
        email, 
        workspaceId: user.cfiWorkspaceId 
      })
      return result.data
    } catch (err: any) {
      throw new Error(err.message || 'Failed to invite student')
    }
  }

  const getStudentProgress = async (studentUid: string) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const progressRef = collection(db, 'progress')
    const q = query(
      progressRef,
      where('studentUid', '==', studentUid),
      where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
    )

    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }

  return {
    students,
    loading,
    error,
    inviteStudent,
    getStudentProgress,
  }
}