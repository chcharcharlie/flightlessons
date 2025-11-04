import React, { useState } from 'react'
import {
  UserGroupIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { useStudents, StudentWithDetails } from '@/hooks/useStudents'
import { Certificate } from '@/types'
import { InviteStudentModal } from '@/components/students/InviteStudentModal'
import { StudentDetailModal } from '@/components/students/StudentDetailModal'
import { StudentProgressModal } from '@/components/students/StudentProgressModal'

export const Students: React.FC = () => {
  const { students, loading, inviteStudent } = useStudents()
  const [searchTerm, setSearchTerm] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentWithDetails | null>(null)
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [selectedStudentForProgress, setSelectedStudentForProgress] = useState<StudentWithDetails | null>(null)

  const handleInviteStudent = async (email: string) => {
    await inviteStudent(email)
    setShowInviteModal(false)
  }

  const filteredStudents = students.filter(student =>
    student.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCertificateLabel = (cert: Certificate) => {
    switch (cert) {
      case 'PRIVATE':
        return 'PPL'
      case 'INSTRUMENT':
        return 'IR'
      case 'COMMERCIAL':
        return 'CPL'
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky"></div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-2xl font-bold text-gray-900">Students</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage your students and track their progress through their training.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Invite Student
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mt-6">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-sky focus:ring-sky sm:text-sm"
            placeholder="Search students..."
          />
        </div>
      </div>

      {/* Students Grid */}
      <div className="mt-6">
        {filteredStudents.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredStudents.map((student) => (
              <div
                key={student.uid}
                className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedStudent(student)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {student.displayName}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">{student.email}</p>
                    
                    <div className="mt-3 flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}>
                        {student.status}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                        {getCertificateLabel(student.currentCertificate)}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-gray-500">
                      Enrolled: {new Date(student.enrollmentDate.toDate()).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStudentForProgress(student)
                      setShowProgressModal(true)
                    }}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <ChartBarIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">
              {searchTerm ? 'No students found matching your search.' : 'No students yet.'}
            </p>
            {!searchTerm && (
              <p className="mt-1 text-sm text-gray-500">
                Invite your first student to get started.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showInviteModal && (
        <InviteStudentModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInviteStudent}
        />
      )}

      {selectedStudent && !showProgressModal && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onViewProgress={() => {
            setSelectedStudentForProgress(selectedStudent)
            setShowProgressModal(true)
            setSelectedStudent(null)
          }}
        />
      )}

      {showProgressModal && selectedStudentForProgress && (
        <StudentProgressModal
          student={selectedStudentForProgress}
          onClose={() => {
            setShowProgressModal(false)
            setSelectedStudentForProgress(null)
          }}
        />
      )}
    </div>
  )
}