import React, { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { StudyItem, GroundScore, FlightScore } from '@/types'

interface RecordProgressModalProps {
  item: StudyItem
  onClose: () => void
  onRecord: (
    score: GroundScore | FlightScore,
    scoreType: 'GROUND' | 'FLIGHT',
    notes: string
  ) => Promise<void>
}

export const RecordProgressModal: React.FC<RecordProgressModalProps> = ({
  item,
  onClose,
  onRecord,
}) => {
  const [scoreType, setScoreType] = useState<'GROUND' | 'FLIGHT'>(
    item.type === 'FLIGHT' ? 'FLIGHT' : 'GROUND'
  )
  const [groundScore, setGroundScore] = useState<GroundScore>('NOT_TAUGHT')
  const [flightScore, setFlightScore] = useState<FlightScore>(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const score = scoreType === 'GROUND' ? groundScore : flightScore
      await onRecord(score, scoreType, notes)
    } catch (error) {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Record Progress: {item.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Score Type Selection */}
          {item.type === 'BOTH' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Progress Type
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="GROUND"
                    checked={scoreType === 'GROUND'}
                    onChange={() => setScoreType('GROUND')}
                    className="form-radio h-4 w-4 text-sky"
                  />
                  <span className="ml-2">Ground</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="FLIGHT"
                    checked={scoreType === 'FLIGHT'}
                    onChange={() => setScoreType('FLIGHT')}
                    className="form-radio h-4 w-4 text-sky"
                  />
                  <span className="ml-2">Flight</span>
                </label>
              </div>
            </div>
          )}

          {/* Score Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Score
            </label>
            
            {scoreType === 'GROUND' ? (
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="NOT_TAUGHT"
                    checked={groundScore === 'NOT_TAUGHT'}
                    onChange={() => setGroundScore('NOT_TAUGHT')}
                    className="form-radio h-4 w-4 text-red-600"
                  />
                  <span className="ml-3 flex-1">
                    <span className="font-medium">Not Taught</span>
                    <span className="block text-sm text-gray-500">
                      Student has not been introduced to this concept
                    </span>
                  </span>
                </label>
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="NEEDS_REINFORCEMENT"
                    checked={groundScore === 'NEEDS_REINFORCEMENT'}
                    onChange={() => setGroundScore('NEEDS_REINFORCEMENT')}
                    className="form-radio h-4 w-4 text-yellow-600"
                  />
                  <span className="ml-3 flex-1">
                    <span className="font-medium">Needs Reinforcement</span>
                    <span className="block text-sm text-gray-500">
                      Student understands basics but needs more practice
                    </span>
                  </span>
                </label>
                <label className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    value="LEARNED"
                    checked={groundScore === 'LEARNED'}
                    onChange={() => setGroundScore('LEARNED')}
                    className="form-radio h-4 w-4 text-green-600"
                  />
                  <span className="ml-3 flex-1">
                    <span className="font-medium">Learned</span>
                    <span className="block text-sm text-gray-500">
                      Student has mastered this concept
                    </span>
                  </span>
                </label>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                {[1, 2, 3, 4, 5].map((score) => (
                  <label key={score} className="flex flex-col items-center cursor-pointer">
                    <input
                      type="radio"
                      value={score}
                      checked={flightScore === score}
                      onChange={() => setFlightScore(score as FlightScore)}
                      className="form-radio h-4 w-4 text-sky mb-1"
                    />
                    <span className={`text-lg font-bold ${
                      score <= 2 ? 'text-red-600' : 
                      score === 3 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {score}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="mb-4">
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              placeholder="Add any observations or feedback..."
            />
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
              {loading ? 'Recording...' : 'Record Progress'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}