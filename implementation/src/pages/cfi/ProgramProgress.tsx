import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { TrainingProgram, User, StudyArea, StudyItem, Progress, GroundScore, FlightScore } from '@/types'
import { ChartBarIcon, BookOpenIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'

export const ProgramProgress: React.FC = () => {
  const { programId } = useParams<{ programId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [student, setStudent] = useState<User | null>(null)
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
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
          navigate('/cfi/programs')
          return
        }
        
        const programData = { id: programDoc.id, ...programDoc.data() } as TrainingProgram
        
        // Verify this program belongs to the CFI's workspace
        if (programData.cfiWorkspaceId !== user.cfiWorkspaceId) {
          navigate('/cfi/programs')
          return
        }
        
        setProgram(programData)
        
        // Load student info
        const studentDoc = await getDoc(doc(db, 'users', programData.studentUid))
        if (studentDoc.exists()) {
          setStudent(studentDoc.data() as User)
        }
        
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
          where('studentUid', '==', programData.studentUid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const progressSnapshot = await getDocs(progressQuery)
        const progressData = progressSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Progress))
        setProgress(progressData)
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [programId, user?.cfiWorkspaceId, navigate])

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

  if (!program || !student) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Program not found</h3>
          <button
            onClick={() => navigate('/cfi/programs')}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Return to programs
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

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back
        </button>
        
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {student.displayName} - {getCertificateFullName(program.certificate)}
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              Track progress for this training program
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

      {/* Progress by Area */}
      <div className="space-y-6">
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

          return (
            <div key={area.id} className="bg-white shadow rounded-lg">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-medium text-gray-900">{area.name}</h4>
                  <span className="text-sm font-medium text-gray-500">
                    {areaCompleted}/{areaItems.length} completed
                  </span>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-sky h-2 rounded-full transition-all duration-500"
                    style={{ width: `${areaProgress}%` }}
                  />
                </div>
              </div>

              {areaItems.length > 0 && (
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
  )
}