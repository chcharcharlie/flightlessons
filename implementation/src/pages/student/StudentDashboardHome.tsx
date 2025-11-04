import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useProgress } from '@/hooks/useProgress'
import { CFIWorkspace, User, Progress, Certificate } from '@/types'
import {
  CalendarDaysIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserIcon,
} from '@heroicons/react/24/outline'

export const StudentDashboardHome: React.FC = () => {
  const { user } = useAuth()
  const [cfiInfo, setCfiInfo] = useState<{ workspace: CFIWorkspace; cfi: User } | null>(null)
  const [loading, setLoading] = useState(true)
  const [progressStats, setProgressStats] = useState({
    totalItems: 0,
    groundLearned: 0,
    flightCompleted: 0,
    currentCertificate: 'PRIVATE' as Certificate,
  })

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

        // Load student's enrollment info
        const studentDoc = await getDoc(
          doc(db, 'workspaces', user.cfiWorkspaceId, 'students', user.uid)
        )
        if (studentDoc.exists()) {
          const studentData = studentDoc.data()
          setProgressStats(prev => ({
            ...prev,
            currentCertificate: studentData.currentCertificate || 'PRIVATE',
          }))
        }

        // Load progress statistics
        const progressRef = collection(db, 'progress')
        const progressQuery = query(
          progressRef,
          where('studentUid', '==', user.uid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        
        const progressSnapshot = await getDocs(progressQuery)
        const progressData = progressSnapshot.docs.map(doc => doc.data() as Progress)
        
        // Calculate statistics
        const itemProgress = new Map<string, { ground?: Progress; flight?: Progress }>()
        
        progressData.forEach(p => {
          const current = itemProgress.get(p.itemId) || {}
          if (p.scoreType === 'GROUND' && (!current.ground || p.createdAt.toMillis() > current.ground.createdAt.toMillis())) {
            current.ground = p
          }
          if (p.scoreType === 'FLIGHT' && (!current.flight || p.createdAt.toMillis() > current.flight.createdAt.toMillis())) {
            current.flight = p
          }
          itemProgress.set(p.itemId, current)
        })

        let groundLearned = 0
        let flightCompleted = 0
        
        itemProgress.forEach(progress => {
          if (progress.ground?.score === 'LEARNED') groundLearned++
          if (progress.flight && typeof progress.flight.score === 'number' && progress.flight.score >= 4) {
            flightCompleted++
          }
        })

        // Get total items count (this is approximate without loading all items)
        const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
        const areasSnapshot = await getDocs(collection(workspaceRef, 'studyAreas'))
        const totalAreas = areasSnapshot.docs.reduce((sum, doc) => sum + (doc.data().itemCount || 0), 0)

        setProgressStats(prev => ({
          ...prev,
          totalItems: totalAreas,
          groundLearned,
          flightCompleted,
        }))
      } catch (error) {
        console.error('Error loading CFI info:', error)
      } finally {
        setLoading(false)
      }
    }

    loadCFIInfo()
  }, [user])

  const getCertificateFullName = (cert: Certificate) => {
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

  const overallProgress = progressStats.totalItems > 0 
    ? Math.round(((progressStats.groundLearned + progressStats.flightCompleted) / (progressStats.totalItems * 2)) * 100)
    : 0

  return (
    <div className="px-4 sm:px-0">
      <h2 className="text-2xl font-bold text-gray-900">
        Welcome back, {user?.displayName}
      </h2>
      <p className="mt-2 text-gray-600">
        {getCertificateFullName(progressStats.currentCertificate)} Training
      </p>

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

      {/* Progress Overview */}
      <div className="mt-6 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900">
          {getCertificateFullName(progressStats.currentCertificate)} Progress
        </h3>
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500">
              Overall Progress
            </span>
            <span className="text-sm font-medium text-gray-900">{overallProgress}%</span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-sky to-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Ground Progress */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BookOpenIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Ground Items Learned
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {progressStats.groundLearned}
                  </dd>
                  <dd className="text-sm text-gray-500">
                    of {progressStats.totalItems} items
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Flight Progress */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Flight Skills Mastered
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {progressStats.flightCompleted}
                  </dd>
                  <dd className="text-sm text-gray-500">
                    score 4+ of 5
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Study Now */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarDaysIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Ready to Study
                  </dt>
                  <dd className="mt-1">
                    <Link
                      to="/student/study"
                      className="text-lg font-semibold text-sky hover:text-sky-600"
                    >
                      View Materials →
                    </Link>
                  </dd>
                  <dd className="text-sm text-gray-500">
                    Study at your pace
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            to="/student/progress"
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-sky" />
              <div className="ml-3">
                <p className="text-base font-medium text-gray-900">View Detailed Progress</p>
                <p className="text-sm text-gray-500">See your progress by area and item</p>
              </div>
            </div>
          </Link>

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
        </div>
      </div>
    </div>
  )
}