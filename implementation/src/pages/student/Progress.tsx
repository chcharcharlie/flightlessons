import React, { useState, useEffect } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useProgress } from '@/hooks/useProgress'
import { TrainingProgram } from '@/types'
import { ChartBarIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

export const StudentProgress: React.FC = () => {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [loading, setLoading] = useState(true)

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
    if (!user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const loadPrograms = async () => {
      try {
        // Load all training programs
        const programsQuery = query(
          collection(db, 'trainingPrograms'),
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const programsSnapshot = await getDocs(programsQuery)
        const programsData = programsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as TrainingProgram))
        setPrograms(programsData)
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadPrograms()
  }, [user?.cfiWorkspaceId, user?.uid])

  const navigate = useNavigate()

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

  const activePrograms = programs.filter(p => p.status === 'ACTIVE')
  const completedPrograms = programs.filter(p => p.status === 'COMPLETED')

  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">Your Progress</h2>
      <p className="mt-2 text-sm text-gray-700">
        Select a training program to view detailed progress.
      </p>

      {/* Active Programs */}
      {activePrograms.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Training Programs</h3>
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
                          Click to view progress
                        </dd>
                      </dl>
                    </div>
                  </div>
                  {program.notes && (
                    <p className="mt-3 text-sm text-gray-500 line-clamp-2">{program.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Programs */}
      {completedPrograms.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Completed Training Programs</h3>
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
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Programs */}
      {programs.length === 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-yellow-800">
            No Training Programs
          </h3>
          <p className="mt-2 text-sm text-yellow-700">
            Your instructor will initiate a training program for your specific certificate or rating.
          </p>
        </div>
      )}
    </div>
  )
}