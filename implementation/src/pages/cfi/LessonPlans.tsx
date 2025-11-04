import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { LessonPlan, Certificate } from '@/types'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentListIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline'

export const LessonPlans: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [lessonPlans, setLessonPlans] = useState<Map<Certificate, LessonPlan[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>('PRIVATE')

  const workspaceId = user?.cfiWorkspaceId || ''

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    const loadLessonPlans = async () => {
      try {
        const plansMap = new Map<Certificate, LessonPlan[]>()
        
        // Load lesson plans for all certificates
        const certificates: Certificate[] = ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL']
        
        for (const cert of certificates) {
          const plansQuery = query(
            collection(db, 'lessonPlans'),
            where('certificate', '==', cert),
            where('cfiWorkspaceId', '==', workspaceId),
            orderBy('orderNumber', 'asc')
          )
          const plansSnapshot = await getDocs(plansQuery)
          const plans = plansSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as LessonPlan))
          
          plansMap.set(cert, plans)
        }
        
        setLessonPlans(plansMap)
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadLessonPlans()
  }, [workspaceId])

  const handleDeletePlan = async (planId: string, certificate: Certificate) => {
    if (!confirm('Are you sure you want to delete this lesson plan?')) return

    try {
      await deleteDoc(doc(db, 'lessonPlans', planId))
      
      // Update local state
      const currentPlans = lessonPlans.get(certificate) || []
      const updatedPlans = currentPlans.filter(p => p.id !== planId)
      const newMap = new Map(lessonPlans)
      newMap.set(certificate, updatedPlans)
      setLessonPlans(newMap)
    } catch (error) {
      // Silently handle error
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

  const formatDuration = (duration: { ground: number; flight: number }) => {
    const parts = []
    if (duration.ground > 0) {
      parts.push(`${duration.ground} min ground`)
    }
    if (duration.flight > 0) {
      parts.push(`${duration.flight} hr flight`)
    }
    return parts.join(' + ') || 'No duration set'
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

  const currentPlans = lessonPlans.get(selectedCertificate) || []

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Lesson Plan Templates</h2>
        <p className="mt-2 text-sm text-gray-700">
          Create standardized lesson plans for each certificate that will be used for all students
        </p>
      </div>

      {/* Certificate Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {(['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'] as Certificate[]).map((cert) => {
            const planCount = lessonPlans.get(cert)?.length || 0
            return (
              <button
                key={cert}
                onClick={() => setSelectedCertificate(cert)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  selectedCertificate === cert
                    ? 'border-sky text-sky'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {getCertificateFullName(cert)}
                {planCount > 0 && (
                  <span className="ml-2 text-gray-400">({planCount})</span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Add New Plan Button */}
      <div className="flex justify-end mb-6">
        <button
          onClick={() => navigate(`/cfi/lesson-plans/${selectedCertificate}/new`)}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
        >
          <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
          Create Lesson Plan
        </button>
      </div>

      {/* Lesson Plans List */}
      {currentPlans.length > 0 ? (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {currentPlans.map((plan) => (
              <li key={plan.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 bg-sky text-white rounded-full h-10 w-10 flex items-center justify-center font-medium text-sm">
                          {plan.orderNumber}
                        </div>
                        <div className="ml-4">
                          <h3 className="text-lg font-medium text-gray-900">
                            {plan.title}
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">
                            {plan.motivation}
                          </p>
                          <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                            <span className="flex items-center">
                              <ClipboardDocumentListIcon className="h-4 w-4 mr-1" />
                              {plan.itemIds.length} items
                            </span>
                            <span>{formatDuration(plan.estimatedDuration)}</span>
                            {plan.objectives.length > 0 && (
                              <span>{plan.objectives.length} objectives</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => navigate(`/cfi/lesson-plans/${selectedCertificate}/${plan.id}/edit`)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        title="Edit plan"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => navigate(`/cfi/lesson-plans/${selectedCertificate}/duplicate-${plan.id}`)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                        title="Duplicate plan"
                      >
                        <DocumentDuplicateIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan.id, selectedCertificate)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete plan"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Objectives */}
                  {plan.objectives.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700">Objectives:</h4>
                      <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                        {plan.objectives.slice(0, 3).map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                        {plan.objectives.length > 3 && (
                          <li className="text-gray-400">
                            And {plan.objectives.length - 3} more...
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            No lesson plans created for {getCertificateFullName(selectedCertificate)}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Create standardized lesson plans that all students will follow
          </p>
          <button
            onClick={() => navigate(`/cfi/lesson-plans/${selectedCertificate}/new`)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-sky hover:bg-sky-600"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Create First Lesson Plan
          </button>
        </div>
      )}
    </div>
  )
}