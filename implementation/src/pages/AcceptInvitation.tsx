import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/types'

export const AcceptInvitation: React.FC = () => {
  const { user, firebaseUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invitationId = searchParams.get('id')
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitation, setInvitation] = useState<any>(null)

  useEffect(() => {
    if (!invitationId) {
      setError('Invalid invitation link')
      setLoading(false)
      return
    }

    const loadInvitation = async () => {
      try {
        const invitationDoc = await getDoc(doc(db, 'invitations', invitationId))
        
        if (!invitationDoc.exists()) {
          setError('Invitation not found')
          setLoading(false)
          return
        }

        const invitationData = invitationDoc.data()
        
        if (invitationData.status !== 'pending') {
          setError('This invitation has already been used')
          setLoading(false)
          return
        }

        setInvitation(invitationData)
        setLoading(false)

        // If user is logged in and has the right email, auto-accept
        if (firebaseUser && firebaseUser.email === invitationData.email) {
          handleAcceptInvitation()
        }
      } catch (err) {
        console.error('Error loading invitation:', err)
        setError('Failed to load invitation')
        setLoading(false)
      }
    }

    loadInvitation()
  }, [invitationId, firebaseUser])

  const handleAcceptInvitation = async () => {
    if (!firebaseUser || !invitation || !invitationId) return

    setLoading(true)
    
    try {
      // Check if user email matches invitation
      if (firebaseUser.email !== invitation.email) {
        setError('This invitation is for a different email address')
        setLoading(false)
        return
      }

      // Update user to be a student
      const userDocRef = doc(db, 'users', firebaseUser.uid)
      const userDoc = await getDoc(userDocRef)
      
      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
        await setDoc(userDocRef, {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || '',
          role: 'STUDENT' as UserRole,
          cfiWorkspaceId: invitation.workspaceId,
          createdAt: serverTimestamp(),
          settings: {
            notifications: {
              email: true,
              lessonReminders: true,
            },
          },
        })
      } else {
        // Update existing user
        await updateDoc(userDocRef, {
          role: 'STUDENT',
          cfiWorkspaceId: invitation.workspaceId,
        })
      }

      // Add student to workspace
      const workspaceRef = doc(db, 'workspaces', invitation.workspaceId)
      const studentRef = doc(workspaceRef, 'students', firebaseUser.uid)
      
      await setDoc(studentRef, {
        uid: firebaseUser.uid,
        enrollmentDate: serverTimestamp(),
        status: 'ACTIVE',
        currentCertificate: 'PRIVATE',
      })

      // Update workspace student count
      await updateDoc(workspaceRef, {
        studentCount: increment(1)
      })

      // Update invitation status
      await updateDoc(doc(db, 'invitations', invitationId), {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        acceptedBy: firebaseUser.uid,
      })

      // Force a page refresh to update auth context with new role
      window.location.href = '/student'
    } catch (err) {
      console.error('Error accepting invitation:', err)
      setError('Failed to accept invitation')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Invalid Invitation</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Join FlightLessons</h2>
            <p className="text-sm text-gray-600 mb-4">
              {invitation.cfiName} has invited you to join their flight training workspace.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Please sign in or create an account with the email address: <strong>{invitation.email}</strong>
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/login?redirect=/accept-invitation?id=${invitationId}`)}
                className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate(`/register?redirect=/accept-invitation?id=${invitationId}`)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (firebaseUser.email !== invitation.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Wrong Account</h2>
            <p className="text-sm text-gray-600 mb-4">
              This invitation is for {invitation.email}, but you're signed in as {firebaseUser.email}.
            </p>
            <p className="text-sm text-gray-600 mb-6">
              Please sign out and sign in with the correct email address.
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">Accept Invitation</h2>
          <p className="text-sm text-gray-600 mb-6">
            {invitation.cfiName} has invited you to join their flight training workspace.
          </p>
          <button
            onClick={handleAcceptInvitation}
            className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600"
          >
            Accept & Join
          </button>
        </div>
      </div>
    </div>
  )
}