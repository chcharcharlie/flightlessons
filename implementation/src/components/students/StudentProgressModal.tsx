import React, { useState } from 'react'
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline'
import { StudentWithDetails } from '@/hooks/useStudents'
import { useStudyItems } from '@/hooks/useStudyItems'
import { useProgress } from '@/hooks/useProgress'
import { StudyArea, StudyItem, Certificate, GroundScore, FlightScore } from '@/types'
import { RecordProgressModal } from './RecordProgressModal'

interface StudentProgressModalProps {
  student: StudentWithDetails
  onClose: () => void
}

export const StudentProgressModal: React.FC<StudentProgressModalProps> = ({
  student,
  onClose,
}) => {
  const { areas, items } = useStudyItems()
  const { progress, loading, recordProgress } = useProgress(student.uid)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>(student.currentCertificate)
  const [selectedArea, setSelectedArea] = useState<StudyArea | null>(null)
  const [recordingItem, setRecordingItem] = useState<StudyItem | null>(null)

  const CERTIFICATES: { value: Certificate; label: string }[] = [
    { value: 'PRIVATE', label: 'Private Pilot (PPL)' },
    { value: 'INSTRUMENT', label: 'Instrument Rating (IR)' },
    { value: 'COMMERCIAL', label: 'Commercial Pilot (CPL)' },
  ]

  // Filter areas by selected certificate
  const certificateAreas = areas.filter(area => area.certificate === selectedCertificate)

  // Get progress for an item
  const getItemProgress = (itemId: string) => {
    const itemProgress = progress.filter(p => p.itemId === itemId)
    if (itemProgress.length === 0) return null

    // Get latest progress for each type
    const groundProgress = itemProgress
      .filter(p => p.scoreType === 'GROUND')
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]
    
    const flightProgress = itemProgress
      .filter(p => p.scoreType === 'FLIGHT')
      .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0]

    return { ground: groundProgress, flight: flightProgress }
  }

  const getScoreDisplay = (score: GroundScore | FlightScore | undefined, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return '-'
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return 'Not Taught'
        case 'NEEDS_REINFORCEMENT':
          return 'Needs Work'
        case 'LEARNED':
          return 'Learned'
        default:
          return '-'
      }
    } else {
      return score.toString()
    }
  }

  const getScoreColor = (score: GroundScore | FlightScore | undefined, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return 'text-gray-400'
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return 'text-red-600'
        case 'NEEDS_REINFORCEMENT':
          return 'text-yellow-600'
        case 'LEARNED':
          return 'text-green-600'
        default:
          return 'text-gray-400'
      }
    } else {
      const numScore = score as FlightScore
      if (numScore >= 4) return 'text-green-600'
      if (numScore >= 3) return 'text-yellow-600'
      return 'text-red-600'
    }
  }

  const handleRecordProgress = async (
    score: GroundScore | FlightScore,
    scoreType: 'GROUND' | 'FLIGHT',
    notes: string
  ) => {
    if (!recordingItem) return

    await recordProgress(recordingItem.id, score, scoreType, notes)
    setRecordingItem(null)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl w-full p-6">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full p-6 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Progress for {student.displayName}
            </h3>
            <p className="text-sm text-gray-500">{student.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Certificate Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex space-x-8">
            {CERTIFICATES.map((cert) => (
              <button
                key={cert.value}
                onClick={() => setSelectedCertificate(cert.value)}
                className={`
                  whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                  ${selectedCertificate === cert.value
                    ? 'border-sky text-sky-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {cert.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-12 gap-4">
            {/* Areas sidebar */}
            <div className="col-span-3">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Study Areas</h4>
              <div className="space-y-1">
                {certificateAreas.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => setSelectedArea(area)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                      selectedArea?.id === area.id
                        ? 'bg-sky-50 text-sky-700'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {area.name}
                  </button>
                ))}
              </div>
              
              {certificateAreas.length === 0 && (
                <p className="text-sm text-gray-500 px-3">No areas for this certificate</p>
              )}
            </div>

            {/* Items and progress */}
            <div className="col-span-9">
              {selectedArea ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">
                    {selectedArea.name} Items
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Item
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ground
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Flight
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {items
                          .filter(item => item.areaId === selectedArea.id)
                          .map((item) => {
                            const itemProgress = getItemProgress(item.id)
                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                  {item.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    item.type === 'GROUND'
                                      ? 'bg-blue-100 text-blue-800'
                                      : item.type === 'FLIGHT'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-purple-100 text-purple-800'
                                  }`}>
                                    {item.type}
                                  </span>
                                </td>
                                <td className={`px-4 py-3 text-sm text-center font-medium ${
                                  getScoreColor(itemProgress?.ground?.score, 'GROUND')
                                }`}>
                                  {getScoreDisplay(itemProgress?.ground?.score, 'GROUND')}
                                </td>
                                <td className={`px-4 py-3 text-sm text-center font-medium ${
                                  getScoreColor(itemProgress?.flight?.score, 'FLIGHT')
                                }`}>
                                  {getScoreDisplay(itemProgress?.flight?.score, 'FLIGHT')}
                                </td>
                                <td className="px-4 py-3 text-sm text-center">
                                  <button
                                    onClick={() => setRecordingItem(item)}
                                    className="text-sky hover:text-sky-600"
                                  >
                                    <PlusIcon className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                    
                    {items.filter(item => item.areaId === selectedArea.id).length === 0 && (
                      <div className="text-center py-8 text-sm text-gray-500">
                        No items in this area
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Select an area to view progress</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Progress Modal */}
      {recordingItem && (
        <RecordProgressModal
          item={recordingItem}
          onClose={() => setRecordingItem(null)}
          onRecord={handleRecordProgress}
        />
      )}
    </div>
  )
}