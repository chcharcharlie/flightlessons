import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore'
import { db, functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { useAuth } from '@/contexts/AuthContext'
import {
  Lesson,
  User,
  StudyItem,
  Progress,
} from '@/types'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  LinkIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline'

export const StudentLessonDetail: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [cfi, setCfi] = useState<User | null>(null)
  const [lessonItems, setLessonItems] = useState<Map<string, StudyItem>>(new Map())
  const [itemProgress, setItemProgress] = useState<Map<string, Progress[]>>(new Map())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!lessonId || !user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const loadLesson = async () => {
      try {
        // Load lesson
        const lessonDoc = await getDoc(doc(db, 'lessons', lessonId))
        if (!lessonDoc.exists()) {
          navigate('/student/lessons')
          return
        }

        const lessonData = { id: lessonDoc.id, ...lessonDoc.data() } as Lesson
        
        // Verify this lesson belongs to the student
        if (lessonData.studentUid !== user.uid) {
          navigate('/student/lessons')
          return
        }

        setLesson(lessonData)

        // Auto-sync: if lesson has a scheduled date but no calendar event for this user yet, sync now
        if (
          lessonData.scheduledDate &&
          lessonData.status === 'SCHEDULED' &&
          !lessonData.googleCalendarEventIds?.[user.uid]
        ) {
          const syncFn = httpsCallable(functions, 'syncLessonToCalendar')
          syncFn({ lessonId: lessonData.id }).catch(err =>
            console.warn('Auto-sync on load failed:', err)
          )
        }

        // Load CFI info
        const workspaceDoc = await getDoc(doc(db, 'workspaces', user.cfiWorkspaceId))
        if (workspaceDoc.exists()) {
          const cfiUid = workspaceDoc.data().cfiUid
          const cfiDoc = await getDoc(doc(db, 'users', cfiUid))
          if (cfiDoc.exists()) {
            setCfi(cfiDoc.data() as User)
          }
        }

        // Load items if any exist in the lesson
        if (lessonData.items.length > 0) {
          const itemIds = lessonData.items.map(item => item.itemId)
          const workspaceRef = doc(db, 'workspaces', lessonData.cfiWorkspaceId)
          const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
          
          const itemsMap = new Map<string, StudyItem>()
          itemsSnapshot.docs.forEach(doc => {
            const item = { id: doc.id, ...doc.data() } as StudyItem
            if (itemIds.includes(item.id)) {
              itemsMap.set(item.id, item)
            }
          })
          setLessonItems(itemsMap)

          // Load progress for these items
          const progressQuery = query(
            collection(db, 'progress'),
            where('studentUid', '==', user.uid),
            where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
          )
          const progressSnapshot = await getDocs(progressQuery)
          
          const progressMap = new Map<string, Progress[]>()
          progressSnapshot.docs.forEach(doc => {
            const progress = { id: doc.id, ...doc.data() } as Progress
            if (itemIds.includes(progress.itemId)) {
              const existing = progressMap.get(progress.itemId) || []
              progressMap.set(progress.itemId, [...existing, progress])
            }
          })
          setItemProgress(progressMap)
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadLesson()
  }, [lessonId, user?.cfiWorkspaceId, user?.uid, navigate])

  const getLatestScore = (itemId: string, type: 'GROUND' | 'FLIGHT') => {
    const progress = itemProgress.get(itemId) || []
    const filtered = progress.filter(p => p.scoreType === type)
    if (filtered.length === 0) return null
    
    // Sort by date and get the latest
    const sorted = filtered.sort((a, b) => 
      b.createdAt.toMillis() - a.createdAt.toMillis()
    )
    return sorted[0].score
  }

  const formatLessonDateTime = (timestamp: any) => {
    if (!timestamp) {
      return 'Unscheduled'
    }
    
    try {
      let date: Date
      
      // Handle various date formats
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate()
      } else if (timestamp instanceof Date) {
        date = timestamp
      } else if (typeof timestamp === 'string') {
        date = new Date(timestamp)
      } else if (timestamp.seconds !== undefined) {
        // Handle raw Firestore timestamp format {seconds, nanoseconds}
        date = new Date(timestamp.seconds * 1000)
      } else {
        // If it's something else, try to convert it
        date = new Date(timestamp)
      }
      
      // Check for unscheduled lessons
      if (date.getFullYear() >= 2099) {
        return 'Unscheduled'
      }
      
      return date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (error) {
      console.error('Error formatting lesson date:', error, timestamp)
      return 'Date unavailable'
    }
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

  if (!lesson) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Lesson not found</h3>
          <button
            onClick={() => navigate('/student/lessons')}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Return to lessons
          </button>
        </div>
      </div>
    )
  }

  const getLessonStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getScoreDisplay = (score: any, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return '-'
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return <span className="text-red-600">Not Taught</span>
        case 'NEEDS_REINFORCEMENT':
          return <span className="text-yellow-600">Needs Work</span>
        case 'LEARNED':
          return <span className="text-green-600">Learned</span>
        default:
          return '-'
      }
    } else {
      return <span className="text-sky-600 font-medium">{score}/5</span>
    }
  }

  return (
    <div className="px-4 sm:px-0 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/student/lessons')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Lessons
        </button>

        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Lesson with {cfi?.displayName || 'your instructor'}
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              <CalendarDaysIcon className="inline-block h-4 w-4 mr-1" />
              {formatLessonDateTime(lesson.status === 'COMPLETED' && lesson.completedDate ? lesson.completedDate : lesson.scheduledDate)}
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLessonStatusColor(lesson.status)}`}>
              {lesson.status}
            </span>
          </div>
        </div>
      </div>

      {/* Lesson Information */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {lesson.title || 'Lesson Information'}
        </h3>
        
        {lesson.motivation && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Motivation</p>
            <p className="text-sm text-gray-600">{lesson.motivation}</p>
          </div>
        )}
        
        {lesson.objectives && lesson.objectives.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Learning Objectives</p>
            <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
              {lesson.objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}
        
        {lesson.planDescription && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Lesson Plan</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{lesson.planDescription}</p>
          </div>
        )}
        
        {lesson.preStudyHomework && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-1">Pre-Study Homework</p>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{lesson.preStudyHomework}</p>
          </div>
        )}
        
        {lesson.referenceMaterials && lesson.referenceMaterials.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Reference Materials</p>
            <div className="space-y-2">
              {lesson.referenceMaterials.map((material, i) => (
                <div key={i} className="flex items-start space-x-2 p-2 bg-gray-50 rounded">
                  {material.type === 'link' ? (
                    <LinkIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                  ) : (
                    <DocumentIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <a 
                      href={material.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-sm text-sky hover:text-sky-600"
                    >
                      {material.name}
                    </a>
                    {material.note && (
                      <p className="text-xs text-gray-500 mt-1">{material.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {lesson.plannedRoute && (
            <div>
              <p className="text-sm font-medium text-gray-700">Planned Route</p>
              <p className="mt-1 text-sm text-gray-900">{lesson.plannedRoute}</p>
            </div>
          )}
          
          {lesson.actualRoute && (
            <div>
              <p className="text-sm font-medium text-gray-700">Actual Route</p>
              <p className="mt-1 text-sm text-gray-900">{lesson.actualRoute}</p>
            </div>
          )}

          {lesson.aircraft && (
            <div>
              <p className="text-sm font-medium text-gray-700">Aircraft</p>
              <p className="mt-1 text-sm text-gray-900">{lesson.aircraft}</p>
            </div>
          )}

          {lesson.weatherNotes && (
            <div>
              <p className="text-sm font-medium text-gray-700">Weather</p>
              <p className="mt-1 text-sm text-gray-900">{lesson.weatherNotes}</p>
            </div>
          )}
        </div>

        {lesson.preNotes && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">Pre-lesson Notes</p>
            <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{lesson.preNotes}</p>
          </div>
        )}

        {lesson.postNotes && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">Post-lesson Notes</p>
            <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{lesson.postNotes}</p>
          </div>
        )}
      </div>

      {/* Items Covered */}
      {lesson.items.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Items Covered</h3>
          
          <div className="space-y-4">
            {lesson.items.map(lessonItem => {
              const item = lessonItems.get(lessonItem.itemId)
              if (!item) return null

              return (
                <div key={lessonItem.itemId} className="border border-gray-200 rounded-md p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-500 mt-1">{item.description}</p>
                    </div>
                    {lessonItem.completed && (
                      <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
                    )}
                  </div>

                  {/* Scores */}
                  <div className="mt-3 grid grid-cols-2 gap-4">
                    {(item.type === 'GROUND' || item.type === 'BOTH') && (
                      <div>
                        <p className="text-xs font-medium text-gray-700">Ground Score</p>
                        <p className="mt-1">
                          {getScoreDisplay(
                            lessonItem.score || getLatestScore(lessonItem.itemId, 'GROUND'),
                            'GROUND'
                          )}
                        </p>
                      </div>
                    )}
                    
                    {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                      <div>
                        <p className="text-xs font-medium text-gray-700">Flight Score</p>
                        <p className="mt-1">
                          {getScoreDisplay(
                            lessonItem.score || getLatestScore(lessonItem.itemId, 'FLIGHT'),
                            'FLIGHT'
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {lessonItem.notes && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-gray-700">Notes</p>
                      <p className="mt-1 text-sm text-gray-600">{lessonItem.notes}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}