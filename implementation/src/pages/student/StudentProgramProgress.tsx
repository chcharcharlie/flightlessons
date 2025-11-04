import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { TrainingProgram, StudyArea, StudyItem, Progress, GroundScore, FlightScore, Lesson } from '@/types'
import { ChartBarIcon, BookOpenIcon, ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, CalendarDaysIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

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
  const [loading, setLoading] = useState(true)

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
        const areasData = areasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyArea))
        setAreas(areasData)
        
        // Load all study items for these areas
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const allItems = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyItem))
        
        // Filter items for this certificate's areas
        const areaIds = areasData.map(a => a.id)
        const certificateItems = allItems.filter(item => areaIds.includes(item.areaId))
        setItems(certificateItems)
        
        // Load progress for this student
        const progressQuery = query(
          collection(db, 'progress'),
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const progressSnapshot = await getDocs(progressQuery)
        const progressData = progressSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Progress))
        setProgress(progressData)
        
        // Load lessons for this student
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
      } catch (error) {
        // Silently handle error
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
  
  const formatLessonDate = (timestamp: Timestamp) => {
    const date = timestamp.toDate()
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
  const upcomingLessons = lessons.filter(l => 
    l.status === 'SCHEDULED' && l.scheduledDate.toDate() >= new Date()
  ).sort((a, b) => a.scheduledDate.toMillis() - b.scheduledDate.toMillis())
  
  const completedLessons = lessons.filter(l => l.status === 'COMPLETED')
    .sort((a, b) => b.scheduledDate.toMillis() - a.scheduledDate.toMillis())

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
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Study Progress by Area</h3>
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
                          {lesson.plannedRoute && (
                            <p className="text-xs text-gray-400 mt-1">
                              Route: {lesson.plannedRoute}
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
              {upcomingLessons.length > 5 && (
                <div className="p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">
                    {upcomingLessons.length - 5} more upcoming lessons
                  </p>
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
                {completedLessons.slice(0, 5).map(lesson => (
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
              {completedLessons.length > 5 && (
                <div className="p-4 bg-gray-50">
                  <p className="text-sm text-gray-500">
                    {completedLessons.length - 5} more completed lessons
                  </p>
                </div>
              )}
            </div>
          )}

          {/* No Lessons */}
          {lessons.length === 0 && (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No lessons scheduled yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Your instructor will schedule lessons as you progress
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}