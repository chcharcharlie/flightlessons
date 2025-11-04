import React, { useState, useEffect } from 'react'
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc,
  addDoc, 
  updateDoc,
  doc,
  Timestamp,
  orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Student, User, TrainingProgram, Certificate } from '@/types'
import { AcademicCapIcon, PlusIcon, PauseIcon, CheckIcon } from '@heroicons/react/24/outline'

export const TrainingPrograms: React.FC = () => {
  const { user } = useAuth()
  const [students, setStudents] = useState<Array<Student & { userData: User }>>([])
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewProgram, setShowNewProgram] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>('PRIVATE')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const workspaceId = user?.cfiWorkspaceId || ''

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Load enrolled students
        const studentsSnapshot = await getDocs(
          collection(db, 'workspaces', workspaceId, 'students')
        )
        
        const studentPromises = studentsSnapshot.docs.map(async (studentDoc) => {
          try {
            const studentData = studentDoc.data() as Student
            // Get user data directly by ID
            const userDocRef = doc(db, 'users', studentData.uid)
            const userDoc = await getDoc(userDocRef)
            if (!userDoc.exists()) {
              return null
            }
            const userData = userDoc.data() as User
            return { ...studentData, userData }
          } catch (err) {
            return null
          }
        })

        const studentsWithData = await Promise.all(studentPromises)
        // Filter out any null results
        setStudents(studentsWithData.filter(s => s !== null) as Array<Student & { userData: User }>)

        // Load training programs
        const programsQuery = query(
          collection(db, 'trainingPrograms'),
          where('cfiWorkspaceId', '==', workspaceId),
          orderBy('createdAt', 'desc')
        )
        const programsSnapshot = await getDocs(programsQuery)
        const programsData = programsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TrainingProgram))
        setPrograms(programsData)
      } catch (error: any) {
        console.error('Error loading training programs:', error)
        setError('Failed to load training programs: ' + error.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceId])

  const handleCreateProgram = async () => {
    if (!selectedStudent || !workspaceId || !user) return

    try {
      const newProgram: Omit<TrainingProgram, 'id'> = {
        cfiWorkspaceId: workspaceId,
        studentUid: selectedStudent,
        certificate: selectedCertificate,
        status: 'ACTIVE',
        startDate: Timestamp.now(),
        notes,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
      }

      const docRef = await addDoc(collection(db, 'trainingPrograms'), newProgram)
      
      // Reload programs
      const updatedProgram = { id: docRef.id, ...newProgram }
      setPrograms([updatedProgram, ...programs])
      
      // Reset form
      setShowNewProgram(false)
      setSelectedStudent('')
      setSelectedCertificate('PRIVATE')
      setNotes('')
    } catch (error: any) {
      setError(error.message || 'Failed to create training program')
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleUpdateStatus = async (programId: string, newStatus: 'ACTIVE' | 'COMPLETED' | 'PAUSED') => {
    try {
      const updates: any = { status: newStatus }
      if (newStatus === 'COMPLETED') {
        updates.completedDate = Timestamp.now()
      }
      
      await updateDoc(doc(db, 'trainingPrograms', programId), updates)
      
      // Update local state
      setPrograms(programs.map(p => 
        p.id === programId 
          ? { ...p, status: newStatus, ...(newStatus === 'COMPLETED' ? { completedDate: Timestamp.now() } : {}) }
          : p
      ))
    } catch (error) {
      // Silently handle error
    }
  }

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

  const getStudentName = (studentUid: string) => {
    const student = students.find(s => s.uid === studentUid)
    return student?.userData?.displayName || 'Unknown Student'
  }

  const getStudentActivePrograms = (studentUid: string) => {
    return programs.filter(p => p.studentUid === studentUid && p.status === 'ACTIVE')
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

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-2xl font-bold text-gray-900">Training Programs</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage certificate and rating training programs for your students
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowNewProgram(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Start New Program
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* New Program Form */}
      {showNewProgram && (
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Start New Training Program</h3>
          
          {students.length === 0 && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
              <p className="text-sm">
                You need to invite students before creating training programs. 
                Go to the <a href="/cfi/students" className="underline font-medium">Students</a> tab to invite your first student.
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="student" className="block text-sm font-medium text-gray-700">
                Select Student
              </label>
              <select
                id="student"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
              >
                <option value="">Choose a student</option>
                {students.length === 0 ? (
                  <option value="" disabled>No enrolled students found</option>
                ) : (
                  students.map(student => (
                    <option key={student.uid} value={student.uid}>
                      {student.userData.displayName}
                      {getStudentActivePrograms(student.uid).length > 0 && 
                        ` (Active: ${getStudentActivePrograms(student.uid).map(p => p.certificate).join(', ')})`
                      }
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor="certificate" className="block text-sm font-medium text-gray-700">
                Certificate/Rating
              </label>
              <select
                id="certificate"
                value={selectedCertificate}
                onChange={(e) => setSelectedCertificate(e.target.value as Certificate)}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
              >
                <option value="PRIVATE">Private Pilot License (PPL)</option>
                <option value="INSTRUMENT">Instrument Rating (IR)</option>
                <option value="COMMERCIAL">Commercial Pilot License (CPL)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="Any initial notes about this training program..."
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowNewProgram(false)
                setSelectedStudent('')
                setSelectedCertificate('PRIVATE')
                setNotes('')
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProgram}
              disabled={!selectedStudent}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Program
            </button>
          </div>
        </div>
      )}

      {/* Programs List */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Active Programs</h3>
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {programs.filter(p => p.status === 'ACTIVE').map((program) => (
              <li key={program.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AcademicCapIcon className="h-8 w-8 text-sky mr-3" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {getStudentName(program.studentUid)}
                        </p>
                        <p className="text-sm text-gray-500">
                          {getCertificateFullName(program.certificate)}
                        </p>
                        {program.notes && (
                          <p className="text-sm text-gray-400 mt-1">{program.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                      <button
                        onClick={() => handleUpdateStatus(program.id, 'PAUSED')}
                        className="text-gray-400 hover:text-gray-500"
                        title="Pause Program"
                      >
                        <PauseIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(program.id, 'COMPLETED')}
                        className="text-gray-400 hover:text-gray-500"
                        title="Complete Program"
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Started {program.startDate.toDate().toLocaleDateString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {programs.filter(p => p.status === 'ACTIVE').length === 0 && (
            <div className="p-6 text-center">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No active training programs</p>
            </div>
          )}
        </div>

        {/* Completed/Paused Programs */}
        {programs.filter(p => p.status !== 'ACTIVE').length > 0 && (
          <>
            <h3 className="text-lg font-medium text-gray-900 mt-8 mb-4">Completed & Paused Programs</h3>
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {programs.filter(p => p.status !== 'ACTIVE').map((program) => (
                  <li key={program.id} className="bg-gray-50">
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <AcademicCapIcon className="h-8 w-8 text-gray-400 mr-3" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {getStudentName(program.studentUid)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {getCertificateFullName(program.certificate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            program.status === 'COMPLETED' 
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {program.status === 'COMPLETED' ? 'Completed' : 'Paused'}
                          </span>
                          {program.status === 'PAUSED' && (
                            <button
                              onClick={() => handleUpdateStatus(program.id, 'ACTIVE')}
                              className="text-gray-400 hover:text-gray-500"
                              title="Resume Program"
                            >
                              <CheckIcon className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Started {program.startDate.toDate().toLocaleDateString()}
                        {program.completedDate && 
                          ` • Completed ${program.completedDate.toDate().toLocaleDateString()}`
                        }
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}