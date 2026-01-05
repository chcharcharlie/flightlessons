import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { TrainingProgram, StudyArea, StudyItem, Progress, GroundScore, FlightScore, Lesson, LessonPlan } from '@/types'
import { ChartBarIcon, BookOpenIcon, ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, CalendarDaysIcon, CheckCircleIcon, DocumentTextIcon, LinkIcon, DocumentIcon } from '@heroicons/react/24/outline'

export const StudentProgramProgress: React.FC = () => {
  const { programId } = useParams<{ programId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [showSyllabus, setShowSyllabus] = useState(false)
  const [expandedLessonPlans, setExpandedLessonPlans] = useState<Set<string>>(new Set())
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAllCompletedLessons, setShowAllCompletedLessons] = useState(false)

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
    if (!programId || !user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Load program details
        const programDoc = await getDoc(doc(db, 'trainingPrograms', programId))
        if (!programDoc.exists()) {
          navigate('/student')
          return
        }
        
        const programData = { id: programDoc.id, ...programDoc.data() } as TrainingProgram
        
        // Verify this program belongs to the student
        if (programData.studentUid !== user.uid) {
          navigate('/student')
          return
        }
        
        setProgram(programData)
        
        // Load study areas for this certificate
        const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
        const areasSnapshot = await getDocs(
          query(
            collection(workspaceRef, 'studyAreas'),
            where('certificate', '==', programData.certificate)
          )
        )
        
        const areasData = areasSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            certificate: data.certificate,
            order: data.orderNumber || 0,
            itemCount: data.itemCount || 0,
            createdAt: data.createdAt
          } as StudyArea
        })
          .sort((a, b) => a.order - b.order)
        
        setAreas(areasData)
        
        // Load all study items for these areas
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        
        const allItems = itemsSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            areaId: data.studyAreaId,
            name: data.name,
            type: data.type,
            description: data.description || '',
            evaluationCriteria: data.evaluationCriteria || '',
            acsCodeMappings: data.acsCodeMappings || [],
            referenceMaterials: data.referenceMaterials || [],
            order: data.orderNumber || 0,
            createdAt: data.createdAt
          } as StudyItem
        })
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        
        // Filter items for this certificate's areas
        const areaIds = areasData.map(a => a.id)
        
        const certificateItems = allItems.filter(item => {
          return areaIds.includes(item.areaId)
        })
        
        setItems(certificateItems)
        
        // Load progress for this student
        const progressQuery = query(
          collection(db, 'progress'),
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const progressSnapshot = await getDocs(progressQuery)
        
        const progressData = progressSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data
          } as Progress
        })
        setProgress(progressData)
        
        // Load lessons for this program
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('programId', '==', programId),
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const lessonsSnapshot = await getDocs(lessonsQuery)
        
        const lessonsData = lessonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Lesson))
        setLessons(lessonsData)
        
        // Load lesson plans for this certificate
        const plansQuery = query(
          collection(db, 'lessonPlans'),
          where('certificate', '==', programData.certificate),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
          orderBy('orderNumber', 'asc')
        )
        const plansSnapshot = await getDocs(plansQuery)
        
        const plansData = plansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LessonPlan))
        setLessonPlans(plansData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [programId, user?.cfiWorkspaceId, user?.uid, navigate])

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

  const getItemProgress = (itemId: string) => {
    const itemProgress = progress.filter(p => p.itemId === itemId)
    if (itemProgress.length === 0) return null

    // Get latest progress for each type
    const groundProgress = itemProgress
      .filter(p => p.scoreType === 'GROUND')
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]
    
    const flightProgress = itemProgress
      .filter(p => p.scoreType === 'FLIGHT')
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]

    return { ground: groundProgress, flight: flightProgress }
  }

  const getScoreDisplay = (score: GroundScore | FlightScore | undefined, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return '-'
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return 'Not Taught'
        case 'NEEDS_REINFORCEMENT':
          return 'Needs Work'
        case 'LEARNED':
          return 'Learned'
        default:
          return '-'
      }
    } else {
      return score.toString()
    }
  }

  const getScoreColor = (score: GroundScore | FlightScore | undefined, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return 'text-gray-400'
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return 'text-red-600'
        case 'NEEDS_REINFORCEMENT':
          return 'text-yellow-600'
        case 'LEARNED':
          return 'text-green-600'
        default:
          return 'text-gray-400'
      }
    } else {
      const numScore = score as FlightScore
      if (numScore >= 4) return 'text-green-600'
      if (numScore >= 3) return 'text-yellow-600'
      return 'text-red-600'
    }
  }

  const getProgressBar = (score: GroundScore | FlightScore | undefined, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return 0
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return 0
        case 'NEEDS_REINFORCEMENT':
          return 50
        case 'LEARNED':
          return 100
        default:
          return 0
      }
    } else {
      const numScore = score as FlightScore
      return (numScore / 5) * 100
    }
  }
  
  const toggleArea = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }
  
  const toggleLessonPlan = (planId: string) => {
    const newExpanded = new Set(expandedLessonPlans)
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId)
    } else {
      newExpanded.add(planId)
    }
    setExpandedLessonPlans(newExpanded)
  }
  
  const formatLessonDate = (timestamp: Timestamp | null) => {
    if (!timestamp) {
      return 'Unscheduled'
    }
    const date = toDate(timestamp)
    if (!date) {
      return 'Unscheduled'
    }
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
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

  if (!program) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Program not found</h3>
          <button
            onClick={() => navigate('/student')}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    )
  }

  const totalItems = items.length
  
  const completedItems = items.filter(item => {
    const itemProgress = getItemProgress(item.id)
    
    if (item.type === 'GROUND' || item.type === 'BOTH') {
      const groundComplete = itemProgress?.ground?.score === 'LEARNED'
      if (!groundComplete) return false
    }
    
    if (item.type === 'FLIGHT' || item.type === 'BOTH') {
      const flightComplete = typeof itemProgress?.flight?.score === 'number' && itemProgress.flight.score >= 4
      if (!flightComplete) return false
    }
    
    return true
  }).length

  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  
  // Group lessons by status
  const upcomingLessons = lessons.filter(l => l.status === 'SCHEDULED')
    .sort((a, b) => {
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
    })
  
  const completedLessons = lessons.filter(l => l.status === 'COMPLETED')
    .sort((a, b) => {
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return b.scheduledDate.toMillis() - a.scheduledDate.toMillis()
    })

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/student')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Dashboard
        </button>
        
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {getCertificateFullName(program.certificate)} Progress
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              Track your progress and lessons for this training program
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              program.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              program.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {program.status}
            </span>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Progress</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Completion</span>
          <span className="text-sm font-medium text-gray-900">{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-sky to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {completedItems} of {totalItems} items completed
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Study Progress */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Study Progress by Area</h3>
          <div className="space-y-3">
            {areas.map(area => {
            const areaItems = items.filter(item => item.areaId === area.id)
            
            const areaCompleted = areaItems.filter(item => {
              const itemProgress = getItemProgress(item.id)
              
              if (item.type === 'GROUND' || item.type === 'BOTH') {
                const groundComplete = itemProgress?.ground?.score === 'LEARNED'
                if (!groundComplete) return false
              }
              
              if (item.type === 'FLIGHT' || item.type === 'BOTH') {
                const flightComplete = typeof itemProgress?.flight?.score === 'number' && itemProgress.flight.score >= 4
                if (!flightComplete) return false
              }
              
              return true
            }).length
            
            const areaProgress = areaItems.length > 0 ? Math.round((areaCompleted / areaItems.length) * 100) : 0
            const isExpanded = expandedAreas.has(area.id)

            return (
              <div key={area.id} className="bg-white shadow rounded-lg">
                <div className="p-4 border-b border-gray-200">
                  <button
                    onClick={() => toggleArea(area.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400 mr-2" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      <h4 className="text-base font-medium text-gray-900">{area.name}</h4>
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      {areaCompleted}/{areaItems.length}
                    </span>
                  </button>
                  <div className="mt-2 ml-7 mr-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-sky h-2 rounded-full transition-all duration-500"
                        style={{ width: `${areaProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isExpanded && areaItems.length > 0 && (
                  <div className="divide-y divide-gray-200">
                    {areaItems.map(item => {
                      const itemProgress = getItemProgress(item.id)
                      const showGround = item.type === 'GROUND' || item.type === 'BOTH'
                      const showFlight = item.type === 'FLIGHT' || item.type === 'BOTH'

                      return (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="text-sm font-medium text-gray-900">{item.name}</h5>
                              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>
                            </div>
                            <span className={`ml-4 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              item.type === 'GROUND'
                                ? 'bg-blue-100 text-blue-800'
                                : item.type === 'FLIGHT'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {item.type}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-4">
                            {showGround && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-500 flex items-center">
                                    <BookOpenIcon className="h-3 w-3 mr-1" />
                                    Ground
                                  </span>
                                  <span className={`text-xs font-medium ${getScoreColor(itemProgress?.ground?.score, 'GROUND')}`}>
                                    {getScoreDisplay(itemProgress?.ground?.score, 'GROUND')}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${getProgressBar(itemProgress?.ground?.score, 'GROUND')}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {showFlight && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-500 flex items-center">
                                    <ChartBarIcon className="h-3 w-3 mr-1" />
                                    Flight
                                  </span>
                                  <span className={`text-xs font-medium ${getScoreColor(itemProgress?.flight?.score, 'FLIGHT')}`}>
                                    {getScoreDisplay(itemProgress?.flight?.score, 'FLIGHT')}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${getProgressBar(itemProgress?.flight?.score, 'FLIGHT')}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {itemProgress && (itemProgress.ground?.notes || itemProgress.flight?.notes) && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 italic">
                                Last note: {itemProgress.ground?.notes || itemProgress.flight?.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>

        {/* Right Column: Lessons */}
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Lessons</h3>

          {/* Upcoming Lessons */}
          {upcomingLessons.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h4 className="text-base font-medium text-gray-900 flex items-center">
                  <CalendarDaysIcon className="h-5 w-5 text-sky mr-2" />
                  Upcoming Lessons
                </h4>
              </div>
              <ul className="divide-y divide-gray-200">
                {upcomingLessons.slice(0, 5).map(lesson => (
                  <li key={lesson.id}>
                    <div
                      onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.title || 'Untitled Lesson'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatLessonDate(lesson.scheduledDate)}
                          </p>
                          {lesson.items.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {lesson.items.length} items planned
                            </p>
                          )}
                        </div>
                        {lesson.scheduledDate && (() => {
                          const date = toDate(lesson.scheduledDate)
                          return date && date < new Date()
                        })() && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Past scheduled time
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {upcomingLessons.length > 5 && (
                <div className="p-4 bg-gray-50">
                  <button
                    onClick={() => navigate('/student/lessons')}
                    className="text-sm text-sky hover:text-sky-600"
                  >
                    View all {upcomingLessons.length} upcoming lessons →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Completed Lessons */}
          {completedLessons.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h4 className="text-base font-medium text-gray-900 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  Completed Lessons
                </h4>
              </div>
              <ul className="divide-y divide-gray-200">
                {(showAllCompletedLessons ? completedLessons : completedLessons.slice(0, 3)).map(lesson => (
                  <li key={lesson.id}>
                    <div
                      onClick={() => navigate(`/student/lessons/${lesson.id}`)}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.title || 'Untitled Lesson'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatLessonDate(lesson.scheduledDate)}
                          </p>
                          {lesson.items.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {lesson.items.filter(i => i.completed).length}/{lesson.items.length} items completed
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getLessonStatusColor(lesson.status)}`}>
                          {lesson.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {completedLessons.length > 3 && (
                <div className="p-4 bg-gray-50">
                  <button
                    onClick={() => setShowAllCompletedLessons(!showAllCompletedLessons)}
                    className="text-sm text-sky hover:text-sky-600"
                  >
                    {showAllCompletedLessons 
                      ? 'Show less' 
                      : `Show all ${completedLessons.length} completed lessons`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No Lessons */}
          {upcomingLessons.length === 0 && completedLessons.length === 0 && (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No lessons scheduled yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Your instructor will schedule lessons as you progress
              </p>
            </div>
          )}

          {/* Syllabus */}
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowSyllabus(!showSyllabus)}
                className="w-full flex items-center justify-between text-left"
              >
                <h4 className="text-base font-medium text-gray-900 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 text-sky mr-2" />
                  Syllabus
                </h4>
                {showSyllabus ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            
            {showSyllabus && lessonPlans.length > 0 && (
              <div className="divide-y divide-gray-200">
                {lessonPlans.map(plan => {
                  const isExpanded = expandedLessonPlans.has(plan.id)
                  const planItems = items.filter(item => plan.itemIds.includes(item.id))
                  
                  return (
                    <div key={plan.id} className="p-4">
                      <button
                        onClick={() => toggleLessonPlan(plan.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDownIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              Lesson {plan.orderNumber}: {plan.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {planItems.length} study items • Est. {plan.estimatedDuration.ground}min ground, {plan.estimatedDuration.flight}hr flight
                            </p>
                          </div>
                        </div>
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-4 ml-6 space-y-3">
                          {plan.motivation && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Motivation</p>
                              <p className="text-sm text-gray-600 mt-1">{plan.motivation}</p>
                            </div>
                          )}
                          
                          {plan.objectives && plan.objectives.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Objectives</p>
                              <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                                {plan.objectives.map((obj, i) => (
                                  <li key={i}>{obj}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {plan.planDescription && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Plan Description</p>
                              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{plan.planDescription}</p>
                            </div>
                          )}
                          
                          {plan.preStudyHomework && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Pre-Study Homework</p>
                              <p className="text-sm text-gray-600 mt-1">{plan.preStudyHomework}</p>
                            </div>
                          )}
                          
                          {planItems.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Study Items</p>
                              <ul className="mt-1 space-y-1">
                                {planItems.map(item => (
                                  <li key={item.id} className="text-sm text-gray-600 flex items-center">
                                    <span className="mr-2">•</span>
                                    <span>{item.name}</span>
                                    <div className="flex gap-1 ml-2">
                                      {(item.type === 'GROUND' || item.type === 'BOTH') && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                          Ground
                                        </span>
                                      )}
                                      {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Flight
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {plan.referenceMaterials && plan.referenceMaterials.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Reference Materials</p>
                              <ul className="mt-1 space-y-1">
                                {plan.referenceMaterials.map((material, index) => (
                                  <li key={index} className="text-sm text-gray-600">
                                    <div className="flex items-start">
                                      {material.type === 'link' ? (
                                        <LinkIcon className="h-3 w-3 text-gray-400 mr-2 mt-0.5" />
                                      ) : (
                                        <DocumentIcon className="h-3 w-3 text-gray-400 mr-2 mt-0.5" />
                                      )}
                                      <div>
                                        <a 
                                          href={material.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-sky hover:text-sky-600 hover:underline"
                                        >
                                          {material.name}
                                        </a>
                                        {material.note && (
                                          <p className="text-xs text-gray-500 mt-0.5">{material.note}</p>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            
            {showSyllabus && lessonPlans.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No lesson plans created for this certificate yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}