import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Lesson, Student, User, TrainingProgram } from '@/types'
import {
  CalendarDaysIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'

export const Lessons: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Map<string, { student: Student; user: User; programs: TrainingProgram[] }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showNewLesson, setShowNewLesson] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('')
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split('T')[0])
  const [lessonTime, setLessonTime] = useState('09:00')
  const [plannedRoute, setPlannedRoute] = useState('')
  const [preNotes, setPreNotes] = useState('')

  const workspaceId = user?.cfiWorkspaceId || ''

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Load lessons
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('cfiWorkspaceId', '==', workspaceId),
          orderBy('scheduledDate', 'desc')
        )
        const lessonsSnapshot = await getDocs(lessonsQuery)
        const lessonsData = lessonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Lesson))
        setLessons(lessonsData)

        // Load students with their programs
        const studentsMap = new Map<string, { student: Student; user: User; programs: TrainingProgram[] }>()
        const studentsSnapshot = await getDocs(collection(db, 'workspaces', workspaceId, 'students'))
        
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data() as Student
          
          // Get user data
          const userDoc = await getDoc(doc(db, 'users', studentData.uid))
          if (!userDoc.exists()) continue
          
          const userData = userDoc.data() as User
          
          // Get active programs for this student
          const programsQuery = query(
            collection(db, 'trainingPrograms'),
            where('studentUid', '==', studentData.uid),
            where('cfiWorkspaceId', '==', workspaceId),
            where('status', '==', 'ACTIVE')
          )
          const programsSnapshot = await getDocs(programsQuery)
          const programs = programsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as TrainingProgram))
          
          studentsMap.set(studentData.uid, {
            student: studentData,
            user: userData,
            programs
          })
        }
        
        setStudents(studentsMap)
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceId])

  const handleCreateLesson = async () => {
    if (!selectedStudent || !lessonDate || !lessonTime) return

    try {
      const scheduledDateTime = new Date(`${lessonDate}T${lessonTime}`)
      
      const newLesson: Omit<Lesson, 'id'> = {
        cfiWorkspaceId: workspaceId,
        studentUid: selectedStudent,
        scheduledDate: Timestamp.fromDate(scheduledDateTime),
        status: 'SCHEDULED',
        plannedRoute: plannedRoute,
        preNotes: preNotes,
        items: [],
        createdAt: Timestamp.now(),
      }

      const docRef = await addDoc(collection(db, 'lessons'), newLesson)
      
      // Navigate to lesson detail page
      navigate(`/cfi/lessons/${docRef.id}`)
    } catch (error) {
      // Silently handle error
    }
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

  const getStudentName = (studentUid: string) => {
    const studentData = students?.get(studentUid)
    return studentData?.user.displayName || 'Unknown Student'
  }

  const formatLessonDateTime = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
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

  // Group lessons by date
  const lessonsByDate = lessons.reduce((acc, lesson) => {
    const dateKey = lesson.scheduledDate.toDate().toDateString()
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(lesson)
    return acc
  }, {} as Record<string, Lesson[]>)

  const upcomingLessons = lessons.filter(l => 
    l.status === 'SCHEDULED' && l.scheduledDate.toDate() >= new Date()
  )

  const pastLessons = lessons.filter(l => 
    l.status === 'SCHEDULED' && l.scheduledDate.toDate() < new Date()
  )

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-2xl font-bold text-gray-900">Lessons</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage and track lessons with your students
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowNewLesson(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Schedule Lesson
          </button>
        </div>
      </div>

      {/* New Lesson Form */}
      {showNewLesson && (
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule New Lesson</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="student" className="block text-sm font-medium text-gray-700">
                Student
              </label>
              <select
                id="student"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
              >
                <option value="">Select a student</option>
                {Array.from(students.entries()).map(([uid, data]) => (
                  <option key={uid} value={uid}>
                    {data.user.displayName}
                    {data.programs.length > 0 && ` - ${data.programs.map(p => p.certificate).join(', ')}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                id="date"
                value={lessonDate}
                onChange={(e) => setLessonDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                Time
              </label>
              <input
                type="time"
                id="time"
                value={lessonTime}
                onChange={(e) => setLessonTime(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="route" className="block text-sm font-medium text-gray-700">
                Planned Route (optional)
              </label>
              <input
                type="text"
                id="route"
                value={plannedRoute}
                onChange={(e) => setPlannedRoute(e.target.value)}
                placeholder="e.g., KPAO - KHAF - KPAO"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Pre-lesson Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={preNotes}
                onChange={(e) => setPreNotes(e.target.value)}
                placeholder="Any preparation notes or focus areas for this lesson..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowNewLesson(false)
                setSelectedStudent('')
                setLessonDate(new Date().toISOString().split('T')[0])
                setLessonTime('09:00')
                setPlannedRoute('')
                setPreNotes('')
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateLesson}
              disabled={!selectedStudent || !lessonDate || !lessonTime}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Schedule & Plan Lesson
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarDaysIcon className="h-6 w-6 text-sky" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Upcoming Lessons
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {upcomingLessons.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completed This Month
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {lessons.filter(l => {
                      const lessonMonth = l.scheduledDate.toDate().getMonth()
                      const currentMonth = new Date().getMonth()
                      return l.status === 'COMPLETED' && lessonMonth === currentMonth
                    }).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Past Due
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {pastLessons.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lessons List */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">All Lessons</h3>
        {lessons.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {lessons.map((lesson) => (
                <li key={lesson.id}>
                  <div
                    onClick={() => navigate(`/cfi/lessons/${lesson.id}`)}
                    className="px-4 py-4 hover:bg-gray-50 sm:px-6 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <CalendarDaysIcon className="h-8 w-8 text-gray-400" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getStudentName(lesson.studentUid)}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatLessonDateTime(lesson.scheduledDate)}
                          </div>
                          {lesson.plannedRoute && (
                            <div className="text-xs text-gray-400 mt-1">
                              Route: {lesson.plannedRoute}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLessonStatusColor(lesson.status)}`}>
                          {lesson.status}
                        </span>
                        {lesson.status === 'COMPLETED' && lesson.items.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {lesson.items.filter(i => i.completed).length}/{lesson.items.length} items
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No lessons scheduled yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Click "Schedule Lesson" to get started
            </p>
          </div>
        )}
      </div>
    </div>
  )
}