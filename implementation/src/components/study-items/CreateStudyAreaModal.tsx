import React, { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Certificate } from '@/types'

interface CreateStudyAreaModalProps {
  certificate: Certificate
  onClose: () => void
  onCreate: (data: { name: string; certificate: Certificate }) => Promise<void>
}

export const CreateStudyAreaModal: React.FC<CreateStudyAreaModalProps> = ({
  certificate,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onCreate({ name: name.trim(), certificate })
    } catch (err: any) {
      setError(err.message || 'Failed to create area')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Create Study Area for {certificate === 'PRIVATE' ? 'Private Pilot' : certificate === 'INSTRUMENT' ? 'Instrument Rating' : 'Commercial Pilot'}
          </h3>
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
              htmlFor="area-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Area Name
            </label>
            <input
              type="text"
              id="area-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              placeholder="e.g., Aerodynamics, Navigation, Weather"
              autoFocus
            />
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
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
              {loading ? 'Creating...' : 'Create Area'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}