import React, { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useProgress } from '@/hooks/useProgress'
import { StudyArea, StudyItem, Certificate, GroundScore, FlightScore } from '@/types'
import { ChartBarIcon, BookOpenIcon } from '@heroicons/react/24/outline'

export const StudentProgress: React.FC = () => {
  const { user } = useAuth()
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>('PRIVATE')
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [loading, setLoading] = useState(true)
  
  // Use the progress hook
  const { progress } = useProgress(user?.uid || '')

  useEffect(() => {
    if (!user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const loadStudyItems = async () => {
      try {
        // Load workspace to get study areas and items
        const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
        
        // Load study areas
        const areasSnapshot = await getDocs(collection(workspaceRef, 'studyAreas'))
        const areasData = areasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyArea))
        setAreas(areasData)

        // Load study items
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const itemsData = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyItem))
        setItems(itemsData)
      } catch (error) {
        console.error('Error loading study items:', error)
      } finally {
        setLoading(false)
      }
    }

    loadStudyItems()
  }, [user?.cfiWorkspaceId])

  const CERTIFICATES: { value: Certificate; label: string; description: string }[] = [
    { value: 'PRIVATE', label: 'Private Pilot', description: 'PPL' },
    { value: 'INSTRUMENT', label: 'Instrument Rating', description: 'IR' },
    { value: 'COMMERCIAL', label: 'Commercial Pilot', description: 'CPL' },
  ]

  // Filter areas by certificate
  const certificateAreas = areas.filter(area => area.certificate === selectedCertificate)

  // Get progress for an item
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

  const totalItems = certificateAreas.reduce((sum, area) => {
    return sum + items.filter(item => item.areaId === area.id).length
  }, 0)

  const completedItems = certificateAreas.reduce((sum, area) => {
    return sum + items.filter(item => {
      if (item.areaId !== area.id) return false
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
  }, 0)

  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">Your Progress</h2>
      <p className="mt-2 text-sm text-gray-700">
        Track your learning progress across all certificates and ratings.
      </p>

      {/* Certificate Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {CERTIFICATES.map((cert) => (
            <button
              key={cert.value}
              onClick={() => setSelectedCertificate(cert.value)}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                ${selectedCertificate === cert.value
                  ? 'border-sky text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {cert.label}
              <span className="ml-2 text-gray-400">({cert.description})</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overall Progress */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          {CERTIFICATES.find(c => c.value === selectedCertificate)?.label} Progress
        </h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Overall Completion</span>
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
      <div className="mt-6 space-y-6">
        {certificateAreas.length > 0 ? (
          certificateAreas.map(area => {
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
          })
        ) : (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              No study areas available for {CERTIFICATES.find(c => c.value === selectedCertificate)?.label} yet.
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Your instructor will add study materials soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}