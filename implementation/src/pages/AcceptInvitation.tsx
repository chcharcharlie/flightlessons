import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'

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

      // Use Cloud Function to accept invitation
      const acceptInvitationFunction = httpsCallable(functions, 'acceptInvitation')
      await acceptInvitationFunction({ invitationId })

      // Force a page refresh to update auth context with new role
      window.location.href = '/student'
    } catch (err: any) {
      
      // Handle specific error codes from Cloud Function
      if (err.code === 'functions/not-found') {
        setError('Invitation not found')
      } else if (err.code === 'functions/failed-precondition') {
        setError('This invitation has already been used')
      } else if (err.code === 'functions/permission-denied') {
        setError('This invitation is for a different email address')
      } else {
        setError(`Failed to accept invitation: ${err.message || 'Unknown error'}`)
      }
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
            <h2 className="text-lg font-medium text-gray-900 mb-2">Join FirstSolo</h2>
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