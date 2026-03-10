import React, { useState, useEffect } from 'react'
import { XMarkIcon, ChartBarIcon, CalendarIcon, AcademicCapIcon, PlusIcon, PencilSquareIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { StudentWithDetails } from '@/hooks/useStudents'
import { Certificate, TrainingProgram } from '@/types'
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { StudentAiSessions } from './StudentAiSessions'

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
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<TrainingProgram[]>([])  
  const [loadingPrograms, setLoadingPrograms] = useState(true)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>('PRIVATE')
  const [notes, setNotes] = useState('')
  const [creatingProgram, setCreatingProgram] = useState(false)
  // Send note state
  const [sendNoteProgramId, setSendNoteProgramId] = useState<string | null>(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [showAiSessions, setShowAiSessions] = useState(false)

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

  const handleCreateProgram = async () => {
    if (!user?.cfiWorkspaceId) return
    
    setCreatingProgram(true)
    try {
      const newProgram = {
        cfiWorkspaceId: user.cfiWorkspaceId,
        studentUid: student.uid,
        certificate: selectedCertificate,
        status: 'ACTIVE' as const,
        startDate: Timestamp.now(),
        notes,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      }
      
      await addDoc(collection(db, 'trainingPrograms'), newProgram)
      
      // Reload programs
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
      
      // Reset form
      setShowNewProgram(false)
      setSelectedCertificate('PRIVATE')
      setNotes('')
    } catch (error) {
      // Silently handle error
    } finally {
      setCreatingProgram(false)
    }
  }
  const handleSendNote = async (program: TrainingProgram) => {
    if (!user?.cfiWorkspaceId || !noteTitle.trim() || !noteContent.trim()) return
    setSavingNote(true)
    try {
      await addDoc(collection(db, 'cfiNotes'), {
        cfiWorkspaceId: user.cfiWorkspaceId,
        createdBy: user.uid,
        title: noteTitle.trim(),
        content: noteContent.trim(),
        targetStudentUid: student.uid,
        certificate: program.certificate,
        createdAt: Timestamp.now(),
      })
      setNoteTitle('')
      setNoteContent('')
      setSendNoteProgramId(null)
    } catch (error) {
      // Silently handle
    } finally {
      setSavingNote(false)
    }
  }

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
          <button type="button"
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
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900">Training Programs</h4>
              <button type="button"
                onClick={() => setShowNewProgram(!showNewProgram)}
                className="text-sky hover:text-sky-600"
                title="Add new program"
              >
                <PlusIcon className="h-4 w-4" />
              </button>
            </div>
            {loadingPrograms ? (
              <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
            ) : programs.length > 0 ? (
              <div className="space-y-3">
                {programs.map(program => (
                  <div key={program.id} className="border border-gray-100 rounded-md p-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <AcademicCapIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="text-gray-600">
                          {getCertificateFullName(program.certificate)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          program.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          program.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {program.status}
                        </span>
                        <button type="button"
                          onClick={() => setSendNoteProgramId(sendNoteProgramId === program.id ? null : program.id)}
                          className="text-amber-500 hover:text-amber-600"
                          title="Send study note"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {/* Inline note form */}
                    {sendNoteProgramId === program.id && (
                      <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                        <input
                          type="text"
                          value={noteTitle}
                          onChange={e => setNoteTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                          placeholder="Note title"
                          className="w-full rounded-md border-gray-300 text-xs focus:ring-amber-400 focus:border-amber-400"
                        />
                        <textarea
                          rows={3}
                          value={noteContent}
                          onChange={e => setNoteContent(e.target.value)}
                          placeholder="Content (explanations, tips, reminders…)"
                          className="w-full rounded-md border-gray-300 text-xs focus:ring-amber-400 focus:border-amber-400"
                        />
                        <div className="flex justify-end gap-2">
                          <button type="button"
                            onClick={() => { setSendNoteProgramId(null); setNoteTitle(''); setNoteContent('') }}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >Cancel</button>
                          <button type="button"
                            onClick={() => handleSendNote(program)}
                            disabled={!noteTitle.trim() || !noteContent.trim() || savingNote}
                            className="px-2 py-1 bg-amber-500 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-amber-600"
                          >
                            {savingNote ? 'Sending…' : 'Send Note'}
                          </button>
                        </div>
                      </div>
                    )}
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

          {showNewProgram && (
            <div className="border-t border-gray-200 pt-4">
              <h5 className="text-sm font-medium text-gray-900 mb-3">Start New Program</h5>
              <div className="space-y-3">
                <div>
                  <label htmlFor="certificate" className="block text-xs font-medium text-gray-700">
                    Certificate/Rating
                  </label>
                  <select
                    id="certificate"
                    value={selectedCertificate}
                    onChange={(e) => setSelectedCertificate(e.target.value as Certificate)}
                    className="mt-1 block w-full rounded-md border-gray-300 py-1 pl-3 pr-10 text-sm focus:border-sky focus:outline-none focus:ring-sky"
                  >
                    <option value="PRIVATE">Private Pilot License (PPL)</option>
                    <option value="INSTRUMENT">Instrument Rating (IR)</option>
                    <option value="COMMERCIAL">Commercial Pilot License (CPL)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="notes" className="block text-xs font-medium text-gray-700">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky text-sm"
                    placeholder="Any initial notes..."
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button type="button"
                    onClick={() => {
                      setShowNewProgram(false)
                      setSelectedCertificate('PRIVATE')
                      setNotes('')
                    }}
                    className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="button"
                    onClick={handleCreateProgram}
                    disabled={creatingProgram}
                    className="px-3 py-1 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-sky hover:bg-sky-600 disabled:opacity-50"
                  >
                    {creatingProgram ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Tutor Sessions */}
          <div>
            <button type="button"
              onClick={() => setShowAiSessions(!showAiSessions)}
              className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-2 hover:text-blue-600 transition-colors"
            >
              <SparklesIcon className="w-4 h-4 text-blue-400" />
              AI Tutor Sessions
              <span className="ml-auto text-xs text-gray-400">{showAiSessions ? '▲' : '▼'}</span>
            </button>
            {showAiSessions && user?.cfiWorkspaceId && (
              <StudentAiSessions
                studentUid={student.uid}
                workspaceId={user.cfiWorkspaceId}
              />
            )}
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Actions</h4>
            <div className="space-y-2">
              {programs.filter(p => p.status === 'ACTIVE').map(program => (
                <button type="button"
                  key={program.id}
                  onClick={() => {
                    onClose()
                    navigate(`/cfi/programs/${program.id}/progress`)
                  }}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  View {getCertificateFullName(program.certificate)} Progress
                </button>
              ))}
              {programs.filter(p => p.status === 'ACTIVE').length === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">
                  Start a training program to view progress
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}