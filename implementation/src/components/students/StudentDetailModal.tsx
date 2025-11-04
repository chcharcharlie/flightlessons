import React, { useState, useEffect } from 'react'
import { XMarkIcon, ChartBarIcon, CalendarIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import { StudentWithDetails } from '@/hooks/useStudents'
import { Certificate, TrainingProgram } from '@/types'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'

interface StudentDetailModalProps {
  student: StudentWithDetails
  onClose: () => void
  onViewProgress: () => void
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  student,
  onClose,
  onViewProgress,
}) => {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<TrainingProgram[]>([])  
  const [loadingPrograms, setLoadingPrograms] = useState(true)

  useEffect(() => {
    if (!user?.cfiWorkspaceId) return

    const loadPrograms = async () => {
      try {
        const programsQuery = query(
          collection(db, 'trainingPrograms'),
          where('studentUid', '==', student.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const programsSnapshot = await getDocs(programsQuery)
        const programsData = programsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TrainingProgram))
        setPrograms(programsData)
      } finally {
        setLoadingPrograms(false)
      }
    }

    loadPrograms()
  }, [student.uid, user?.cfiWorkspaceId])
  const getCertificateFullName = (cert: Certificate) => {
    switch (cert) {
      case 'PRIVATE':
        return 'Private Pilot License (PPL)'
      case 'INSTRUMENT':
        return 'Instrument Rating (IR)'
      case 'COMMERCIAL':
        return 'Commercial Pilot License (CPL)'
      default:
        return cert
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-800'
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {student.displayName}
            </h3>
            <p className="mt-1 text-sm text-gray-500">{student.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Status</h4>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(student.status)}`}>
              {student.status}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Training Programs</h4>
            {loadingPrograms ? (
              <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
            ) : programs.length > 0 ? (
              <div className="space-y-2">
                {programs.map(program => (
                  <div key={program.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <AcademicCapIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <span className="text-gray-600">
                        {getCertificateFullName(program.certificate)}
                      </span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      program.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                      program.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {program.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No training programs assigned yet
              </p>
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Enrollment Date</h4>
            <div className="flex items-center text-sm text-gray-600">
              <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
              {new Date(student.enrollmentDate.toDate()).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Actions</h4>
            <div className="space-y-2">
              {programs.filter(p => p.status === 'ACTIVE').map(program => (
                <button
                  key={program.id}
                  onClick={onViewProgress}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  View {getCertificateFullName(program.certificate)} Progress
                </button>
              ))}
              {programs.filter(p => p.status === 'ACTIVE').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Assign a training program to view progress
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}