import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { doc, setDoc, addDoc, collection, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { UserRole } from '@/types'
import { AcademicCapIcon, UserGroupIcon } from '@heroicons/react/24/outline'

export const RoleSelectionPage: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { firebaseUser, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const handleRoleSelection = async () => {
    if (!selectedRole || !firebaseUser) return

    setError('')
    setLoading(true)

    try {
      // Create user document
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const newUserData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        role: selectedRole,
        createdAt: serverTimestamp(),
        settings: {
          notifications: {
            email: true,
            lessonReminders: true,
          },
        },
      }

      await setDoc(userDocRef, newUserData)

      // If CFI, create workspace
      if (selectedRole === 'CFI') {
        const workspaceRef = await addDoc(collection(db, 'workspaces'), {
          cfiUid: firebaseUser.uid,
          name: firebaseUser.displayName + "'s Flight School",
          createdAt: serverTimestamp(),
          studentCount: 0,
          settings: {
            defaultLessonDuration: {
              ground: 60,
              flight: 1.5,
            },
          },
        })

        // Update user with workspace ID
        await updateDoc(userDocRef, {
          cfiWorkspaceId: workspaceRef.id,
        })
      }

      // Navigate to saved redirect or appropriate dashboard
      const savedRedirect = sessionStorage.getItem('redirect_after_login')
      if (savedRedirect) {
        sessionStorage.removeItem('redirect_after_login')
        navigate(savedRedirect)
      } else {
        navigate(selectedRole === 'CFI' ? '/cfi' : '/student')
      }
    } catch (error: any) {
      console.error('Error setting role:', error)
      setError('Failed to set up account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
      </div>
    )
  }

  // If no Firebase user, redirect to login
  if (!firebaseUser) {
    return <Navigate to="/login" replace />
  }

  // If user already has a role, redirect to appropriate dashboard
  if (user) {
    return <Navigate to={user.role === 'CFI' ? '/cfi' : '/student'} replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to FlightLessons!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please select your role to continue
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div className="mt-8 space-y-4">
          <button
            onClick={() => setSelectedRole('CFI')}
            className={`group relative w-full flex items-center justify-center px-4 py-4 border-2 text-sm font-medium rounded-md transition-colors ${
              selectedRole === 'CFI'
                ? 'border-sky bg-sky-50 text-sky-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <UserGroupIcon className="h-6 w-6 mr-3" />
            <div className="text-left">
              <div className="font-semibold">I'm a Flight Instructor (CFI)</div>
              <div className="text-xs text-gray-500 mt-1">
                Manage students, create lesson plans, and track progress
              </div>
            </div>
          </button>

          <button
            onClick={() => setSelectedRole('STUDENT')}
            className={`group relative w-full flex items-center justify-center px-4 py-4 border-2 text-sm font-medium rounded-md transition-colors ${
              selectedRole === 'STUDENT'
                ? 'border-sky bg-sky-50 text-sky-700'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AcademicCapIcon className="h-6 w-6 mr-3" />
            <div className="text-left">
              <div className="font-semibold">I'm a Student Pilot</div>
              <div className="text-xs text-gray-500 mt-1">
                View lessons, track progress, and access study materials
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6">
          <button
            onClick={handleRoleSelection}
            disabled={!selectedRole || loading}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-sky hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky disabled:opacity-50"
          >
            {loading ? 'Setting up your account...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}