import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { CFIWorkspace, User, TrainingProgram } from '@/types'
import {
  CalendarDaysIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'

export const StudentDashboardHome: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [cfiInfo, setCfiInfo] = useState<{ workspace: CFIWorkspace; cfi: User } | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePrograms, setActivePrograms] = useState<TrainingProgram[]>([])
  const [completedPrograms, setCompletedPrograms] = useState<TrainingProgram[]>([])

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
                          Started {program.startDate.toDate().toLocaleDateString()}
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
                            Completed {program.completedDate?.toDate().toLocaleDateString()}
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


      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student/study"
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <BookOpenIcon className="h-8 w-8 text-sky" />
              <div className="ml-3">
                <p className="text-base font-medium text-gray-900">Study Materials</p>
                <p className="text-sm text-gray-500">Access your learning resources</p>
              </div>
            </div>
          </Link>

          <Link
            to="/student/lessons"
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <CalendarDaysIcon className="h-8 w-8 text-sky" />
              <div className="ml-3">
                <p className="text-base font-medium text-gray-900">Upcoming Lessons</p>
                <p className="text-sm text-gray-500">View your scheduled lessons</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}