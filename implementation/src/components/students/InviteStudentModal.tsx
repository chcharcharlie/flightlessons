import React, { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface InviteStudentModalProps {
  onClose: () => void
  onInvite: (email: string) => Promise<void>
}

export const InviteStudentModal: React.FC<InviteStudentModalProps> = ({
  onClose,
  onInvite,
}) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      setError('Email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onInvite(email.trim())
    } catch (err: any) {
      setError(err.message || 'Failed to invite student')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Invite Student</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="student-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Student Email Address
            </label>
            <input
              type="email"
              id="student-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              placeholder="student@example.com"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded-md mb-4">
            <p className="text-sm text-gray-600">
              The student will receive an invitation email to join your workspace.
              They'll need to create an account or sign in to accept the invitation.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky disabled:opacity-50"
            >
              {loading ? 'Sending invitation...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}