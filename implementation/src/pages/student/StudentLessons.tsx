import React, { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Lesson, User } from '@/types'
import { CalendarDaysIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

export const StudentLessons: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [cfi, setCfi] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const loadLessons = async () => {
      try {
        // Load lessons
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
          orderBy('scheduledDate', 'desc')
        )
        const lessonsSnapshot = await getDocs(lessonsQuery)
        const lessonsData = lessonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Lesson))
        setLessons(lessonsData)

        // Load CFI info
        const workspaceDoc = await getDoc(doc(db, 'workspaces', user.cfiWorkspaceId))
        if (workspaceDoc.exists()) {
          const cfiUid = workspaceDoc.data().cfiUid
          const cfiDoc = await getDoc(doc(db, 'users', cfiUid))
          if (cfiDoc.exists()) {
            setCfi(cfiDoc.data() as User)
          }
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadLessons()
  }, [user])

  // Helper function to safely convert timestamps to dates
  const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null
    try {
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate()
      } else if (timestamp instanceof Date) {
        return timestamp
      } else if (timestamp.seconds !== undefined) {
        return new Date(timestamp.seconds * 1000)
      } else {
        return new Date(timestamp)
      }
    } catch (error) {
      console.error('Error converting timestamp to date:', error)
      return null
    }
  }

  const formatLessonDateTime = (timestamp: any) => {
    const date = toDate(timestamp)
    if (!date) return 'Unknown'
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const getLessonStatusIcon = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <ClockIcon className="h-6 w-6 text-blue-500" />
      case 'COMPLETED':
        return <CheckCircleIcon className="h-6 w-6 text-green-500" />
      case 'CANCELLED':
        return <CalendarDaysIcon className="h-6 w-6 text-red-500" />
      default:
        return <CalendarDaysIcon className="h-6 w-6 text-gray-400" />
    }
  }

  const upcomingLessons = lessons.filter(l => l.status === 'SCHEDULED')
    .sort((a, b) => {
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
    })

  const pastLessons = lessons.filter(l => l.status !== 'SCHEDULED')
    .sort((a, b) => {
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return b.scheduledDate.toMillis() - a.scheduledDate.toMillis()
    })

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">Your Lessons</h2>
      <p className="mt-2 text-sm text-gray-700">
        View your scheduled and completed lessons with {cfi?.displayName || 'your instructor'}
      </p>

      {/* Upcoming Lessons */}
      {upcomingLessons.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Lessons</h3>
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {upcomingLessons.map(lesson => (
                <li key={lesson.id}>
                  <div 
                    onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                    className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer flex items-center">
                    <div className="flex-shrink-0">
                      {getLessonStatusIcon(lesson.status)}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {formatLessonDateTime(lesson.scheduledDate)}
                      </div>
                      {lesson.plannedRoute && (
                        <div className="text-sm text-gray-500 mt-1">
                          Planned route: {lesson.plannedRoute}
                        </div>
                      )}
                      {lesson.preNotes && (
                        <div className="text-sm text-gray-500 mt-1">
                          Focus: {lesson.preNotes}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {lesson.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Past Lessons */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Past Lessons</h3>
        {pastLessons.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {pastLessons.map(lesson => (
                <li key={lesson.id}>
                  <div 
                    onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                    className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer flex items-center">
                    <div className="flex-shrink-0">
                      {getLessonStatusIcon(lesson.status)}
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="text-sm font-medium text-gray-900">
                        {formatLessonDateTime(lesson.status === 'COMPLETED' && lesson.completedDate ? lesson.completedDate : lesson.scheduledDate)}
                      </div>
                      {lesson.actualRoute && (
                        <div className="text-sm text-gray-500 mt-1">
                          Route flown: {lesson.actualRoute}
                        </div>
                      )}
                      {lesson.items.length > 0 && (
                        <div className="text-sm text-gray-500 mt-1">
                          {lesson.items.filter(i => i.completed).length} of {lesson.items.length} items completed
                        </div>
                      )}
                      {lesson.postNotes && (
                        <div className="text-sm text-gray-500 mt-2 italic">
                          Notes: {lesson.postNotes}
                        </div>
                      )}
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lesson.status === 'COMPLETED' 
                          ? 'bg-green-100 text-green-800'
                          : lesson.status === 'CANCELLED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {lesson.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No past lessons yet</p>
          </div>
        )}
      </div>
    </div>
  )
}