import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { CFIWorkspace, User, TrainingProgram, Lesson } from '@/types'
import {
  CalendarDaysIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserIcon,
  AcademicCapIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

export const StudentDashboardHome: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cfiInfo, setCfiInfo] = useState<{ workspace: CFIWorkspace; cfi: User } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePrograms, setActivePrograms] = useState<TrainingProgram[]>([])
  const [completedPrograms, setCompletedPrograms] = useState<TrainingProgram[]>([])
  const [upcomingLessons, setUpcomingLessons] = useState<Lesson[]>([])
  const [recentLessons, setRecentLessons] = useState<Lesson[]>([])

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

  useEffect(() => {
    const loadCFIInfo = async () => {
      if (!user?.cfiWorkspaceId) {
        setLoading(false)
        return
      }

      try {
        // Load workspace info
        const workspaceDoc = await getDoc(doc(db, 'workspaces', user.cfiWorkspaceId))
        if (!workspaceDoc.exists()) {
          setLoading(false)
          return
        }

        const workspace = { id: workspaceDoc.id, ...workspaceDoc.data() } as CFIWorkspace
        
        // Load CFI info
        const cfiDoc = await getDoc(doc(db, 'users', workspace.cfiUid))
        if (!cfiDoc.exists()) {
          setLoading(false)
          return
        }

        const cfi = cfiDoc.data() as User
        setCfiInfo({ workspace, cfi })

        // Load all training programs
        const programsQuery = query(
          collection(db, 'trainingPrograms'),
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const programsSnapshot = await getDocs(programsQuery)
        const allPrograms = programsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as TrainingProgram))
        
        // Separate active and completed programs
        const active = allPrograms.filter(p => p.status === 'ACTIVE')
        const completed = allPrograms.filter(p => p.status === 'COMPLETED')
        
        setActivePrograms(active)
        setCompletedPrograms(completed)
        
        // Load upcoming lessons
        try {
          const lessonsQuery = query(
            collection(db, 'lessons'),
            where('studentUid', '==', user.uid),
            where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
            where('status', '==', 'SCHEDULED'),
            orderBy('scheduledDate', 'asc')
          )
          const lessonsSnapshot = await getDocs(lessonsQuery)
          const lessons = lessonsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Lesson))
          
          // Show all scheduled lessons (not completed or cancelled)
          setUpcomingLessons(lessons)
        } catch (lessonError) {
          // If index is not ready, try without orderBy
          try {
            const lessonsQuery = query(
              collection(db, 'lessons'),
              where('studentUid', '==', user.uid),
              where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
              where('status', '==', 'SCHEDULED')
            )
            const lessonsSnapshot = await getDocs(lessonsQuery)
            const lessons = lessonsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Lesson))
            
            // Show all scheduled lessons, sorted by date
            const sorted = lessons.sort((a, b) => {
              if (!a.scheduledDate) return 1
              if (!b.scheduledDate) return -1
              return a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
            })
            setUpcomingLessons(sorted)
          } catch (fallbackError) {
            // If still failing, just set empty array
            setUpcomingLessons([])
          }
        }
        
        // Load recently completed lessons
        try {
          const completedQuery = query(
            collection(db, 'lessons'),
            where('studentUid', '==', user.uid),
            where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
            where('status', '==', 'COMPLETED'),
            orderBy('completedDate', 'desc')
          )
          const completedSnapshot = await getDocs(completedQuery)
          const completed = completedSnapshot.docs
            .slice(0, 5) // Get last 5 completed lessons
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as Lesson))
          
          setRecentLessons(completed)
        } catch (completedError) {
          // If index is not ready, try without orderBy
          try {
            const completedQuery = query(
              collection(db, 'lessons'),
              where('studentUid', '==', user.uid),
              where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
              where('status', '==', 'COMPLETED')
            )
            const completedSnapshot = await getDocs(completedQuery)
            const completed = completedSnapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              } as Lesson))
              .sort((a, b) => {
                if (!a.completedDate) return 1
                if (!b.completedDate) return -1
                return b.completedDate.toMillis() - a.completedDate.toMillis()
              })
              .slice(0, 5) // Get last 5 completed lessons
            
            setRecentLessons(completed)
          } catch (error) {
            // Silently handle error
          }
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadCFIInfo()
  }, [user])

  const getCertificateFullName = (cert: string) => {
    switch (cert) {
      case 'PRIVATE':
        return 'Private Pilot License'
      case 'INSTRUMENT':
        return 'Instrument Rating'
      case 'COMMERCIAL':
        return 'Commercial Pilot License'
      default:
        return cert
    }
  }
  
  const formatLessonDateTime = (timestamp: Timestamp | null) => {
    if (!timestamp) {
      return 'Unscheduled'
    }
    
    const date = toDate(timestamp)
    if (!date) {
      return 'Unscheduled'
    }
    
    // Check for unscheduled lessons
    if (date.getFullYear() >= 2099) {
      return 'Unscheduled'
    }
    
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let dateString = ''
    if (date.toDateString() === now.toDateString()) {
      dateString = 'Today'
    } else if (date.toDateString() === tomorrow.toDateString()) {
      dateString = 'Tomorrow'
    } else {
      dateString = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    }
    
    const timeString = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return `${dateString} at ${timeString}`
  }

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

  if (!cfiInfo) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-yellow-800">No Instructor Assigned</h3>
          <p className="mt-1 text-sm text-yellow-700">
            You are not currently enrolled with a flight instructor. Please accept an invitation from your CFI.
          </p>
        </div>
      </div>
    )
  }


  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">
        Welcome back, {user?.displayName}
      </h2>
      {activePrograms.length > 0 && (
        <p className="mt-2 text-gray-600">
          {activePrograms.map(p => getCertificateFullName(p.certificate)).join(', ')} Training
        </p>
      )}

      {/* Instructor Info */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <div className="flex items-center">
          <UserIcon className="h-10 w-10 text-gray-400" />
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900">Your Flight Instructor</h3>
            <p className="text-gray-600">{cfiInfo.cfi.displayName}</p>
            <p className="text-sm text-gray-500">{cfiInfo.workspace.name}</p>
          </div>
        </div>
      </div>

      {/* Training Programs */}
      <div className="mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Training Programs</h3>
        
        {activePrograms.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePrograms.map(program => (
              <div
                key={program.id}
                onClick={() => navigate(`/student/programs/${program.id}/progress`)}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <AcademicCapIcon className="h-8 w-8 text-sky" />
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-900 truncate">
                          {getCertificateFullName(program.certificate)}
                        </dt>
                        <dd className="mt-1 text-sm text-gray-500">
                          Started {(() => {
                            const date = toDate(program.startDate)
                            return date ? date.toLocaleDateString() : 'Unknown'
                          })()}
                        </dd>
                      </dl>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                    {program.notes && (
                      <p className="mt-2 text-sm text-gray-500 line-clamp-2">{program.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-yellow-800">
              No Active Training Programs
            </h3>
            <p className="mt-2 text-sm text-yellow-700">
              Your instructor will initiate a training program for your specific certificate or rating.
            </p>
          </div>
        )}
        
        {completedPrograms.length > 0 && (
          <>
            <h4 className="text-md font-medium text-gray-900 mt-6 mb-3">Completed Programs</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedPrograms.map(program => (
                <div
                  key={program.id}
                  onClick={() => navigate(`/student/programs/${program.id}/progress`)}
                  className="bg-gray-50 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="p-5">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <AcademicCapIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <div className="ml-5 w-0 flex-1">
                        <dl>
                          <dt className="text-sm font-medium text-gray-900 truncate">
                            {getCertificateFullName(program.certificate)}
                          </dt>
                          <dd className="mt-1 text-sm text-gray-500">
                            Completed {(() => {
                              const date = toDate(program.completedDate)
                              return date ? date.toLocaleDateString() : 'Unknown'
                            })()}
                          </dd>
                        </dl>
                      </div>
                    </div>
                    <div className="mt-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Completed
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Active Lessons */}
      {upcomingLessons.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Lessons</h3>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {upcomingLessons.slice(0, 3).map(lesson => (
                <li key={lesson.id}>
                  <div
                    onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <CalendarDaysIcon className="h-6 w-6 text-sky mt-0.5" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.title || 'Flight Lesson'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatLessonDateTime(lesson.scheduledDate)}
                          </p>
                          {lesson.plannedRoute && (
                            <p className="text-xs text-gray-400 mt-1">
                              Route: {lesson.plannedRoute}
                            </p>
                          )}
                        </div>
                      </div>
                      {lesson.scheduledDate && (() => {
                        const date = toDate(lesson.scheduledDate)
                        return date && date < new Date(Date.now() + 24 * 60 * 60 * 1000)
                      })() && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <ClockIcon className="h-3 w-3 mr-1" />
                          Soon
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {upcomingLessons.length > 3 && (
              <div className="bg-gray-50 px-4 py-3">
                <p className="text-sm text-gray-500">
                  {upcomingLessons.length - 3} more lessons scheduled
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recently Completed Lessons */}
      {recentLessons.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recently Completed Lessons</h3>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <ul className="divide-y divide-gray-200">
              {recentLessons.map(lesson => (
                <li key={lesson.id}>
                  <div
                    onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                    className="p-4 hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start">
                        <CalendarDaysIcon className="h-6 w-6 text-gray-400 mt-0.5" />
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.title || 'Flight Lesson'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Completed {lesson.completedDate ? formatLessonDateTime(lesson.completedDate) : 'Unknown date'}
                          </p>
                          {lesson.actualRoute && (
                            <p className="text-xs text-gray-400 mt-1">
                              Route: {lesson.actualRoute}
                            </p>
                          )}
                          {lesson.postNotes && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              Notes: {lesson.postNotes}
                            </p>
                          )}
                        </div>
                      </div>
                      {lesson.items && lesson.items.filter(item => item.completed).length > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {lesson.items.filter(item => item.completed).length} completed
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}