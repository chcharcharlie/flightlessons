import React, { useState, useEffect } from 'react'
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom'
import { AdBanner } from '@/components/AdBanner'
import { useAuth } from '@/contexts/AuthContext'
import {
  HomeIcon,
  UserGroupIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ClipboardDocumentListIcon,
  ArrowLeftOnRectangleIcon,
  CalendarIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Students } from './Students'
import { TrainingPrograms } from './TrainingPrograms'
import { ProgramProgress } from './ProgramProgress'
import { Lessons } from './Lessons'
import { LessonDetail } from './LessonDetail'
import { LessonPlans } from './LessonPlans'
import { LessonPlanDetail } from './LessonPlanDetail'
import { FloatingChatButton } from '@/components/ai/FloatingChatButton'
import { ChatWindow } from '@/components/ai/ChatWindow'
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, getDocs, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Lesson, TrainingProgram, Progress, User } from '@/types'
import { format, isToday, isTomorrow } from 'date-fns'

const navigation = [
  { name: 'Dashboard', href: '/cfi', icon: HomeIcon },
  { name: 'Students', href: '/cfi/students', icon: UserGroupIcon },
  { name: 'Programs', href: '/cfi/programs', icon: AcademicCapIcon },
  { name: 'Curriculum', href: '/cfi/curriculum', icon: BookOpenIcon },
  { name: 'Lessons', href: '/cfi/lessons', icon: ClipboardDocumentListIcon },
]

export const CFIDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [isChatOpen, setIsChatOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-semibold text-gray-900">
                  FirstSolo
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-sky text-gray-900'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <item.icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="ml-3 relative flex items-center space-x-4">
                <span className="text-sm text-gray-700">
                  {user?.displayName}
                </span>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <ArrowLeftOnRectangleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 pb-20">
        <Routes>
          <Route index element={<CFIDashboardHome />} />
          <Route path="students" element={<Students />} />
          <Route path="programs" element={<TrainingPrograms />} />
          <Route path="programs/:programId/progress" element={<ProgramProgress />} />
          <Route path="curriculum" element={<LessonPlans />} />
          <Route path="curriculum/:certificate/:planId" element={<LessonPlanDetail />} />
          <Route path="curriculum/:certificate/:planId/edit" element={<LessonPlanDetail />} />
          <Route path="lessons" element={<Lessons />} />
          <Route path="lessons/:lessonId" element={<LessonDetail />} />
        </Routes>
      </main>

      {/* AI Assistant — temporarily hidden, re-enable when ready
      <FloatingChatButton 
        onClick={() => setIsChatOpen(true)}
      />
      <ChatWindow 
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
      */}

      {/* Ad Banner — fixed bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex justify-center py-1 shadow-sm">
        <AdBanner format="horizontal" className="w-full max-w-3xl" />
      </div>
    </div>
  )
}

interface DashboardProgram extends TrainingProgram {
  studentName: string
  progressPercentage: number
  recentProgress?: Progress[]
}

interface DashboardLesson extends Lesson {
  studentName: string
  programName?: string
}

interface DashboardStats {
  activeStudents: number
  weeklyLessons: number
  completedThisWeek: number
  activePrograms: number
}

const CFIDashboardHome: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    activeStudents: 0,
    weeklyLessons: 0,
    completedThisWeek: 0,
    activePrograms: 0,
  })
  const [activePrograms, setActivePrograms] = useState<DashboardProgram[]>([])
  const [scheduledLessons, setScheduledLessons] = useState<DashboardLesson[]>([])
  const [recentLessons, setRecentLessons] = useState<DashboardLesson[]>([])
  const [loading, setLoading] = useState(true)
  const [schoolName, setSchoolName] = useState<string>('')
  const [isEditingSchoolName, setIsEditingSchoolName] = useState(false)
  const [editSchoolName, setEditSchoolName] = useState('')
  const [savingSchoolName, setSavingSchoolName] = useState(false)
  const [pendingQuestions, setPendingQuestions] = useState<import('@/types').Question[]>([])
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

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

  // Load workspace (school) name
  useEffect(() => {
    if (!user?.cfiWorkspaceId) return
    getDoc(doc(db, 'workspaces', user.cfiWorkspaceId)).then(snap => {
      if (snap.exists()) {
        setSchoolName(snap.data().name || '')
      }
    })
  }, [user?.cfiWorkspaceId])

  // Load pending questions
  useEffect(() => {
    if (!user?.cfiWorkspaceId) return
    import('firebase/firestore').then(({ query, collection, where, getDocs }) => {
      getDocs(query(
        collection(db, 'questions'),
        where('cfiWorkspaceId', '==', user.cfiWorkspaceId!),
        where('status', '==', 'open')
      )).then(snap => {
        const qs = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as import('@/types').Question))
          .sort((a, b) => {
            const ta = (a.createdAt as any)?.toMillis?.() ?? 0
            const tb = (b.createdAt as any)?.toMillis?.() ?? 0
            return ta - tb
          })
        setPendingQuestions(qs)
      }).catch(err => console.error('[Dashboard] pending questions error:', err))
    })
  }, [user?.cfiWorkspaceId])

  const submitAnswer = async (questionId: string) => {
    if (!answerText.trim()) return
    setSubmittingAnswer(true)
    try {
      const { updateDoc, doc: firestoreDoc, Timestamp: TS } = await import('firebase/firestore')
      await updateDoc(firestoreDoc(db, 'questions', questionId), {
        answer: answerText.trim(),
        status: 'answered',
        answeredAt: TS.now(),
      })
      setPendingQuestions(prev => prev.filter(q => q.id !== questionId))
      setAnsweringId(null)
      setAnswerText('')
    } finally {
      setSubmittingAnswer(false)
    }
  }

  const saveSchoolName = async () => {
    if (!user?.cfiWorkspaceId || !editSchoolName.trim()) return
    setSavingSchoolName(true)
    try {
      await updateDoc(doc(db, 'workspaces', user.cfiWorkspaceId), { name: editSchoolName.trim() })
      setSchoolName(editSchoolName.trim())
      setIsEditingSchoolName(false)
    } catch (e) {
      console.error('Failed to update school name', e)
    } finally {
      setSavingSchoolName(false)
    }
  }

  // Fetch active programs with progress
  useEffect(() => {
    if (!user?.cfiWorkspaceId) return

    const programsQuery = query(
      collection(db, 'trainingPrograms'),
      where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
      where('status', '==', 'ACTIVE'),
      orderBy('startDate', 'desc')
    )

    const unsubscribe = onSnapshot(programsQuery, async (snapshot) => {
      const programs: DashboardProgram[] = []
      
      for (const docSnapshot of snapshot.docs) {
        const program = { id: docSnapshot.id, ...docSnapshot.data() } as TrainingProgram
        
        // Get student name
        const userDoc = await getDoc(doc(db, 'users', program.studentUid))
        const studentUser = userDoc.data() as User | undefined
        
        // Calculate progress
        const progressQuery = query(
          collection(db, 'progress'),
          where('studentUid', '==', program.studentUid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const progressSnapshot = await getDocs(progressQuery)
        
        // Get recent progress (last 5 items)
        const recentProgress = progressSnapshot.docs
          .map(progressDoc => ({ id: progressDoc.id, ...progressDoc.data() }) as Progress)
          .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
          .slice(0, 5)
        
        // Get study areas and items count like ProgramProgress does
        const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId!)
        const areasSnapshot = await getDocs(
          query(
            collection(workspaceRef, 'studyAreas'),
            where('certificate', '==', program.certificate)
          )
        )
        const areaIds = areasSnapshot.docs.map(doc => doc.id)
        
        // Get all study items for these areas
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const certificateItems = itemsSnapshot.docs.filter(doc => {
          const itemData = doc.data()
          return areaIds.includes(itemData.studyAreaId)
        })
        
        const totalItems = certificateItems.length
        
        // Skip programs with no study items
        if (totalItems === 0) {
          continue
        }
        
        // Count completed items using the same logic as ProgramProgress
        const itemIds = certificateItems.map(doc => doc.id)
        const progressMap = new Map<string, Map<'ground' | 'flight', Progress>>()
        
        progressSnapshot.docs.forEach(progressDoc => {
          const progress = progressDoc.data() as Progress
          if (!itemIds.includes(progress.itemId)) return
          
          if (!progressMap.has(progress.itemId)) {
            progressMap.set(progress.itemId, new Map())
          }
          
          const scoreType = progress.scoreType === 'GROUND' ? 'ground' : 'flight'
          progressMap.get(progress.itemId)!.set(scoreType, progress)
        })
        
        const completedItems = certificateItems.filter(itemDoc => {
          const item = itemDoc.data()
          const itemId = itemDoc.id
          const itemProgress = progressMap.get(itemId)
          
          if (!itemProgress) return false
          
          // Check ground completion
          if (item.type === 'GROUND' || item.type === 'BOTH') {
            const groundProgress = itemProgress.get('ground')
            const groundComplete = groundProgress?.score === 'LEARNED'
            if (!groundComplete) return false
          }
          
          // Check flight completion (score >= 4)
          if (item.type === 'FLIGHT' || item.type === 'BOTH') {
            const flightProgress = itemProgress.get('flight')
            const flightComplete = typeof flightProgress?.score === 'number' && flightProgress.score >= 4
            if (!flightComplete) return false
          }
          
          return true
        }).length
        
        programs.push({
          ...program,
          studentName: studentUser?.displayName || 'Unknown Student',
          progressPercentage: Math.round((completedItems / totalItems) * 100),
          recentProgress,
        })
      }
      
      setActivePrograms(programs)
    })

    return () => unsubscribe()
  }, [user?.cfiWorkspaceId])

  // Fetch lessons (scheduled and recent)
  useEffect(() => {
    if (!user?.cfiWorkspaceId) return

    // All scheduled lessons
    const scheduledQuery = query(
      collection(db, 'lessons'),
      where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
      where('status', '==', 'SCHEDULED')
    )

    const scheduledUnsubscribe = onSnapshot(scheduledQuery, async (snapshot) => {
      const lessons: DashboardLesson[] = []
      
      for (const lessonDoc of snapshot.docs) {
        const lesson = { id: lessonDoc.id, ...lessonDoc.data() } as Lesson
        
        // Get student name
        const userDoc = await getDoc(doc(db, 'users', lesson.studentUid))
        const studentUser = userDoc.data() as User | undefined
        
        lessons.push({
          ...lesson,
          studentName: studentUser?.displayName || 'Unknown Student',
        })
      }
      
      // Sort lessons by date (handle null dates)
      lessons.sort((a, b) => {
        const aDate = toDate(a.scheduledDate)
        const bDate = toDate(b.scheduledDate)
        if (!aDate && !bDate) return 0
        if (!aDate) return 1
        if (!bDate) return -1
        return aDate.getTime() - bDate.getTime()
      })
      
      setScheduledLessons(lessons)
    })

    // Recently completed lessons
    const recentQuery = query(
      collection(db, 'lessons'),
      where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
      where('status', '==', 'COMPLETED'),
      orderBy('completedDate', 'desc')
    )

    const recentUnsubscribe = onSnapshot(recentQuery, async (snapshot) => {
      const lessons: DashboardLesson[] = []
      
      // Calculate start of this week (Sunday) and 7 days ago
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      sevenDaysAgo.setHours(0, 0, 0, 0)
      
      let completedThisWeek = 0
      
      for (const lessonDoc of snapshot.docs) {
        const lesson = { id: lessonDoc.id, ...lessonDoc.data() } as Lesson
        
        // Count completed in the last 7 days
        if (lesson.completedDate) {
          const completedDate = toDate(lesson.completedDate)
          if (completedDate && completedDate >= sevenDaysAgo) {
            completedThisWeek++
          }
        }
        
        // Get student name
        const userDoc = await getDoc(doc(db, 'users', lesson.studentUid))
        const studentUser = userDoc.data() as User | undefined
        
        lessons.push({
          ...lesson,
          studentName: studentUser?.displayName || 'Unknown Student',
        })
      }
      
      // Only show the most recent 5 in the UI
      setRecentLessons(lessons.slice(0, 5))
      setStats(prev => ({ ...prev, completedThisWeek }))
    })

    return () => {
      scheduledUnsubscribe()
      recentUnsubscribe()
    }
  }, [user?.cfiWorkspaceId])

  // Fetch student stats
  useEffect(() => {
    if (!user?.cfiWorkspaceId) return

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId!)
    const studentsRef = collection(workspaceRef, 'students')
    
    const unsubscribe = onSnapshot(studentsRef, (snapshot) => {
      const activeCount = snapshot.docs.filter(studentDoc => 
        studentDoc.data().status === 'ACTIVE'
      ).length
      
      setStats(prev => ({ 
        ...prev, 
        activeStudents: activeCount,
        activePrograms: activePrograms.length 
      }))
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user?.cfiWorkspaceId, activePrograms.length])

  const formatLessonDate = (date: Timestamp | null) => {
    if (!date) return ''
    const lessonDate = toDate(date)
    if (!lessonDate) return ''
    
    if (isToday(lessonDate)) {
      return format(lessonDate, 'h:mm a')
    } else if (isTomorrow(lessonDate)) {
      return 'Tomorrow ' + format(lessonDate, 'h:mm a')
    } else {
      return format(lessonDate, 'MMM d, h:mm a')
    }
  }

  const certificateNames = {
    PRIVATE: 'Private Pilot',
    INSTRUMENT: 'Instrument Rating',
    COMMERCIAL: 'Commercial Pilot',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.displayName}
          </h2>
          <div className="mt-1 flex items-center gap-2">
            {isEditingSchoolName ? (
              <>
                <input
                  type="text"
                  value={editSchoolName}
                  onChange={e => setEditSchoolName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveSchoolName(); if (e.key === 'Escape') setIsEditingSchoolName(false) }}
                  className="text-sm text-gray-600 border border-gray-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-sky"
                  autoFocus
                  disabled={savingSchoolName}
                />
                <button onClick={saveSchoolName} disabled={savingSchoolName} className="text-green-600 hover:text-green-700">
                  <CheckIcon className="w-4 h-4" />
                </button>
                <button onClick={() => setIsEditingSchoolName(false)} className="text-gray-400 hover:text-gray-500">
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-500">{schoolName}</span>
                <button
                  onClick={() => { setEditSchoolName(schoolName); setIsEditingSchoolName(true) }}
                  className="text-gray-400 hover:text-gray-600"
                  title="Edit school name"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <p className="mt-2 text-gray-600">
        {scheduledLessons.filter(l => {
          const date = toDate(l.scheduledDate)
          return date && isToday(date)
        }).length > 0
          ? `You have ${scheduledLessons.filter(l => {
              const date = toDate(l.scheduledDate)
              return date && isToday(date)
            }).length} lessons scheduled today`
          : 'No lessons scheduled for today'}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Students */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Students
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {stats.activeStudents}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* This Week */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Scheduled
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {scheduledLessons.length}
                  </dd>
                  <dd className="text-sm text-gray-500">upcoming</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Completed This Week */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completed
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {stats.completedThisWeek}
                  </dd>
                  <dd className="text-sm text-gray-500">last 7 days</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Active Programs */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AcademicCapIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Programs
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {activePrograms.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Training Programs */}
      {activePrograms.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Training Programs</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePrograms.map((program) => (
              <div
                key={program.id}
                onClick={() => navigate(`/cfi/programs/${program.id}/progress`)}
                className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-5">
                  <h4 className="text-sm font-medium text-gray-900">{program.studentName}</h4>
                  <p className="mt-1 text-sm text-gray-500">{certificateNames[program.certificate]}</p>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Progress</span>
                      <span className="font-medium">{program.progressPercentage}%</span>
                    </div>
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-sky h-2 rounded-full transition-all duration-300"
                        style={{ width: `${program.progressPercentage}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center text-sm text-sky hover:text-sky-600">
                    View Progress
                    <ChevronRightIcon className="ml-1 h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scheduled Lessons */}
      {scheduledLessons.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900">Upcoming Lessons</h3>
          <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {scheduledLessons.slice(0, 5).map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    to={`/cfi/lessons/${lesson.id}`}
                    className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <span className="text-sm font-medium text-gray-900">
                            {formatLessonDate(lesson.scheduledDate)}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {lesson.studentName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {lesson.title || 'Untitled Lesson'}
                          </div>
                        </div>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {scheduledLessons.length > 5 && (
              <div className="bg-gray-50 px-4 py-3 text-sm">
                <Link to="/cfi/lessons" className="text-sky hover:text-sky-600">
                  View all {scheduledLessons.length} scheduled lessons →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Lessons */}
      {recentLessons.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900">Recently Completed</h3>
          <div className="mt-4 bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {recentLessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link
                    to={`/cfi/lessons/${lesson.id}`}
                    className="block hover:bg-gray-50 px-4 py-4 sm:px-6"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {lesson.studentName} - {lesson.title || 'Untitled Lesson'}
                        </div>
                        <div className="text-sm text-gray-500">
                          Completed {lesson.completedDate ? (() => {
                            const date = toDate(lesson.completedDate)
                            return date ? format(date, 'MMM d, yyyy') : 'Unknown'
                          })() : 'Unknown'}
                        </div>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Student Questions */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            Student Questions
            {pendingQuestions.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                {pendingQuestions.length}
              </span>
            )}
          </h3>
        </div>
        {pendingQuestions.length === 0 ? (
          <div className="bg-white shadow sm:rounded-md px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No pending questions from students</p>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {pendingQuestions.map(q => (
                <li key={q.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {q.studentName || 'Student'}
                        {q.studyItemName && (
                          <span className="ml-2 text-xs font-normal text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            re: {q.studyItemName}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-gray-700">{q.question}</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {q.createdAt?.toDate ? q.createdAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => { setAnsweringId(q.id); setAnswerText('') }}
                      className="flex-shrink-0 text-sm text-sky-600 hover:text-sky-800 font-medium"
                    >
                      Reply
                    </button>
                  </div>
                  {answeringId === q.id && (
                    <div className="mt-3">
                      <textarea
                        rows={3}
                        value={answerText}
                        onChange={e => setAnswerText(e.target.value)}
                        placeholder="Type your answer…"
                        className="w-full rounded-md border-gray-300 text-sm focus:ring-sky-500 focus:border-sky-500"
                        autoFocus
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button onClick={() => setAnsweringId(null)} className="text-sm text-gray-500 hover:text-gray-700">
                          Cancel
                        </button>
                        <button
                          onClick={() => submitAnswer(q.id)}
                          disabled={!answerText.trim() || submittingAnswer}
                          className="px-3 py-1.5 bg-sky-500 text-white rounded-md text-sm font-medium disabled:opacity-50 hover:bg-sky-600"
                        >
                          {submittingAnswer ? 'Sending…' : 'Send Answer'}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Empty States */}
      {activePrograms.length === 0 && scheduledLessons.length === 0 && (
        <div className="mt-8 text-center py-12">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No active programs</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a training program for a student.</p>
          <div className="mt-6">
            <Link
              to="/cfi/programs"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky hover:bg-sky-600"
            >
              Go to Programs
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}