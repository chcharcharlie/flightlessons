import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, collection, query, where, getDocs, orderBy, addDoc, Timestamp } from 'firebase/firestore'
import { db, storage } from '@/lib/firebase'
import { ref, listAll, getDownloadURL } from 'firebase/storage'
import { useAuth } from '@/contexts/AuthContext'
import { TrainingProgram, User, StudyArea, StudyItem, Progress, GroundScore, FlightScore, Lesson, LessonPlan, ReferenceMaterial } from '@/types'
import { ChartBarIcon, BookOpenIcon, ArrowLeftIcon, ChevronDownIcon, ChevronRightIcon, CalendarDaysIcon, PlusIcon, CheckCircleIcon, DocumentTextIcon, LinkIcon, DocumentIcon, TrashIcon } from '@heroicons/react/24/outline'
import { ReferenceMaterialModal } from '@/components/ReferenceMaterialModal'
import { useWorkspace } from '@/hooks/useWorkspace'

export const ProgramProgress: React.FC = () => {
  const { programId } = useParams<{ programId: string }>()
  const { user } = useAuth()
  const { workspaceId, loading: workspaceLoading } = useWorkspace()
  const navigate = useNavigate()
  
  const [program, setProgram] = useState<TrainingProgram | null>(null)
  const [student, setStudent] = useState<User | null>(null)
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [progress, setProgress] = useState<Progress[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [showScheduleLesson, setShowScheduleLesson] = useState(false)
  const [selectedLessonPlan, setSelectedLessonPlan] = useState('')
  const [showSyllabus, setShowSyllabus] = useState(false)
  const [expandedLessonPlans, setExpandedLessonPlans] = useState<Set<string>>(new Set())
  const [lessonDate, setLessonDate] = useState('')
  const [lessonTime, setLessonTime] = useState('')
  const [lessonTitle, setLessonTitle] = useState('')
  const [plannedRoute, setPlannedRoute] = useState('')
  const [preNotes, setPreNotes] = useState('')
  const [motivation, setMotivation] = useState('')
  const [objectives, setObjectives] = useState('')
  const [planDescription, setPlanDescription] = useState('')
  const [preStudyHomework, setPreStudyHomework] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectedItemTypes, setSelectedItemTypes] = useState<Map<string, Set<'GROUND' | 'FLIGHT'>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [referenceMaterials, setReferenceMaterials] = useState<ReferenceMaterial[]>([])
  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null)
  const [existingFiles, setExistingFiles] = useState<{ id: string; name: string; url: string }[]>([])
  const [showAllCompletedLessons, setShowAllCompletedLessons] = useState(false)

  // Helper function to safely convert timestamps to dates
  const toDate = (timestamp: any): Date | null => {
    if (!timestamp) return null
    try {
      if (typeof timestamp.toDate === 'function') {
        return timestamp.toDate()
      } else if (timestamp instanceof Date) {
        return timestamp
      } else if (timestamp.seconds !== undefined) {
        return new Date(timestamp.seconds * 1000)
      } else {
        return new Date(timestamp)
      }
    } catch (error) {
      console.error('Error converting timestamp to date:', error)
      return null
    }
  }

  useEffect(() => {
    if (!programId || !workspaceId || workspaceLoading) {
      if (!workspaceLoading) {
        setLoading(false)
      }
      return
    }

    const loadData = async () => {
      try {
        // Load program details
        const programDoc = await getDoc(doc(db, 'trainingPrograms', programId))
        if (!programDoc.exists()) {
          navigate('/cfi/programs')
          return
        }
        
        const programData = { id: programDoc.id, ...programDoc.data() } as TrainingProgram
        
        // Verify this program belongs to the CFI's workspace
        if (programData.cfiWorkspaceId !== workspaceId) {
          navigate('/cfi/programs')
          return
        }
        
        setProgram(programData)
        
        // Load student info
        const studentDoc = await getDoc(doc(db, 'users', programData.studentUid))
        if (studentDoc.exists()) {
          setStudent(studentDoc.data() as User)
        }
        
        // Load study areas for this certificate
        const workspaceRef = doc(db, 'workspaces', workspaceId)
        const areasSnapshot = await getDocs(
          query(
            collection(workspaceRef, 'studyAreas'),
            where('certificate', '==', programData.certificate)
          )
        )
        const areasData = areasSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            name: data.name,
            certificate: data.certificate,
            order: data.orderNumber || 0,
            itemCount: data.itemCount || 0,
            createdAt: data.createdAt
          } as StudyArea
        })
          .sort((a, b) => a.order - b.order)
        setAreas(areasData)
        
        // Load all study items for these areas
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const allItems = itemsSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            areaId: data.studyAreaId || data.areaId, // Handle both field names
            name: data.name,
            type: data.type,
            description: data.description || '',
            evaluationCriteria: data.evaluationCriteria || '',
            acsCodeMappings: data.acsCodeMappings || [],
            referenceMaterials: data.referenceMaterials || [],
            order: data.orderNumber || 0,
            createdAt: data.createdAt
          } as StudyItem
        })
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        
        // Filter items for this certificate's areas
        const areaIds = areasData.map(a => a.id)
        const certificateItems = allItems.filter(item => areaIds.includes(item.areaId))
        setItems(certificateItems)
        
        // Load progress for this student
        const progressQuery = query(
          collection(db, 'progress'),
          where('studentUid', '==', programData.studentUid),
          where('cfiWorkspaceId', '==', workspaceId)
        )
        const progressSnapshot = await getDocs(progressQuery)
        const progressData = progressSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Progress))
        setProgress(progressData)
        
        // Load lessons for this program
        const lessonsQuery = query(
          collection(db, 'lessons'),
          where('programId', '==', programId),
          where('cfiWorkspaceId', '==', workspaceId)
        )
        const lessonsSnapshot = await getDocs(lessonsQuery)
        const lessonsData = lessonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Lesson))
        
        setLessons(lessonsData)
        
        // Load lesson plans for this certificate
        const plansQuery = query(
          collection(db, 'lessonPlans'),
          where('certificate', '==', programData.certificate),
          where('cfiWorkspaceId', '==', workspaceId),
          orderBy('orderNumber', 'asc')
        )
        const plansSnapshot = await getDocs(plansQuery)
        const plansData = plansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LessonPlan))
        setLessonPlans(plansData)
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [programId, workspaceId, workspaceLoading, navigate])

  // Update form fields when a lesson plan is selected
  useEffect(() => {
    if (selectedLessonPlan && lessonPlans.length > 0) {
      const plan = lessonPlans.find(p => p.id === selectedLessonPlan)
      if (plan) {
        // Pre-populate fields from the lesson plan
        setLessonTitle(plan.title)
        setMotivation(plan.motivation || '')
        setObjectives(plan.objectives ? plan.objectives.join('\n') : '')
        setPlanDescription(plan.planDescription || '')
        setPreStudyHomework(plan.preStudyHomework || '')
        // Pre-populate reference materials from the lesson plan
        setReferenceMaterials(plan.referenceMaterials || [])
        // Pre-select items from the lesson plan
        setSelectedItems(new Set(plan.itemIds))
        // Set default types for BOTH items (both ground and flight)
        const newTypes = new Map<string, Set<'GROUND' | 'FLIGHT'>>()
        plan.itemIds.forEach(itemId => {
          const item = items.find(i => i.id === itemId)
          if (item && item.type === 'BOTH') {
            newTypes.set(itemId, new Set(['GROUND', 'FLIGHT']))
          }
        })
        setSelectedItemTypes(newTypes)
      }
    } else {
      // Clear fields when no plan is selected
      setLessonTitle('')
      setMotivation('')
      setObjectives('')
      setPlanDescription('')
      setPreStudyHomework('')
      setReferenceMaterials([])
      setSelectedItems(new Set())
      setSelectedItemTypes(new Map())
    }
  }, [selectedLessonPlan, lessonPlans])

  // Fetch existing files when modal is opened
  useEffect(() => {
    if (showReferenceModal && workspaceId) {
      const fetchExistingFiles = async () => {
        try {
          const materialsRef = ref(storage, `workspaces/${user.cfiWorkspaceId}/materials`)
          const filesList = await listAll(materialsRef)
          
          const filesData = await Promise.all(
            filesList.items.map(async (item) => {
              const url = await getDownloadURL(item)
              // Extract original file name from the stored name (remove timestamp prefix)
              const fullName = item.name
              const originalName = fullName.includes('_') 
                ? fullName.substring(fullName.indexOf('_') + 1)
                : fullName
              
              return {
                id: fullName,
                name: originalName,
                url
              }
            })
          )
          
          setExistingFiles(filesData)
        } catch (error) {
          console.error('Error fetching existing files:', error)
        }
      }
      
      fetchExistingFiles()
    }
  }, [showReferenceModal, workspaceId])

  const getCertificateFullName = (cert: string) => {
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

  const getProgressBar = (score: GroundScore | FlightScore | undefined, type: 'GROUND' | 'FLIGHT') => {
    if (!score) return 0
    
    if (type === 'GROUND') {
      switch (score) {
        case 'NOT_TAUGHT':
          return 0
        case 'NEEDS_REINFORCEMENT':
          return 50
        case 'LEARNED':
          return 100
        default:
          return 0
      }
    } else {
      const numScore = score as FlightScore
      return (numScore / 5) * 100
    }
  }
  
  const toggleArea = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }
  
  const toggleLessonPlan = (planId: string) => {
    const newExpanded = new Set(expandedLessonPlans)
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId)
    } else {
      newExpanded.add(planId)
    }
    setExpandedLessonPlans(newExpanded)
  }
  
  const handleScheduleFromSyllabus = (planId: string) => {
    setSelectedLessonPlan(planId)
    setShowScheduleLesson(true)
    // Scroll to the schedule form
    setTimeout(() => {
      document.getElementById('schedule-lesson-form')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }
  
  const handleScheduleLesson = async () => {
    console.log('handleScheduleLesson called in ProgramProgress')
    if (!program) {
      console.error('No program found')
      return
    }
    
    try {
      const lessonData: Record<string, any> = {
        cfiWorkspaceId: workspaceId || '',
        studentUid: program.studentUid,
        programId: programId,
        status: 'SCHEDULED',
        items: Array.from(selectedItems).map(itemId => {
          const itemTypes = selectedItemTypes.get(itemId)
          return {
            itemId,
            planned: true,
            completed: false,
            includeGround: itemTypes?.has('GROUND') || false,
            includeFlight: itemTypes?.has('FLIGHT') || false,
          }
        }),
        createdAt: Timestamp.now(),
        // Add scheduled date - use default time if not provided
        scheduledDate: lessonDate 
          ? Timestamp.fromDate(new Date(`${lessonDate}T${lessonTime || '09:00'}`))
          : null
      }
      
      // Only add optional fields if they have values
      if (lessonTitle) lessonData.title = lessonTitle
      if (plannedRoute) lessonData.plannedRoute = plannedRoute
      if (preNotes) lessonData.preNotes = preNotes
      
      // If a lesson plan is selected, use its data but allow overrides
      if (selectedLessonPlan) {
        const plan = lessonPlans.find(p => p.id === selectedLessonPlan)
        if (plan) {
          lessonData.lessonPlanId = selectedLessonPlan
          lessonData.title = lessonTitle || plan.title
          if (motivation || plan.motivation) {
            lessonData.motivation = motivation || plan.motivation
          }
          if (objectives || plan.objectives) {
            lessonData.objectives = objectives ? objectives.split('\n').filter(o => o.trim()) : plan.objectives
          }
          if (planDescription || plan.planDescription) {
            lessonData.planDescription = planDescription || plan.planDescription
          }
          // Use reference materials from form (which includes plan's materials if pre-populated)
          if (referenceMaterials.length > 0) {
            lessonData.referenceMaterials = referenceMaterials
          }
          if (preStudyHomework || plan.preStudyHomework) {
            lessonData.preStudyHomework = preStudyHomework || plan.preStudyHomework
          }
        }
      } else {
        // For custom lessons, add the custom fields only if they have values
        if (motivation) lessonData.motivation = motivation
        if (objectives) {
          lessonData.objectives = objectives.split('\n').filter(o => o.trim())
        }
        if (planDescription) lessonData.planDescription = planDescription
        if (preStudyHomework) lessonData.preStudyHomework = preStudyHomework
        if (referenceMaterials.length > 0) lessonData.referenceMaterials = referenceMaterials
      }
      
      const docRef = await addDoc(collection(db, 'lessons'), lessonData)
      
      // Navigate to lesson detail page
      navigate(`/cfi/lessons/${docRef.id}`)
    } catch (error) {
      console.error('Error creating lesson in ProgramProgress:', error)
    }
  }
  
  const formatLessonDate = (lesson: { status: string; scheduledDate: Timestamp | null; completedDate?: Timestamp | null }) => {
    const timestamp = lesson.status === 'COMPLETED' && lesson.completedDate ? lesson.completedDate : lesson.scheduledDate
    
    if (!timestamp) {
      return 'Unscheduled'
    }
    
    try {
      let date: Date
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate()
      } else if (timestamp instanceof Date) {
        date = timestamp
      } else if ((timestamp as any).seconds !== undefined) {
        date = new Date((timestamp as any).seconds * 1000)
      } else {
        date = new Date(timestamp as any)
      }
      
      // Check for unscheduled lessons
      if (date.getFullYear() >= 2099) {
        return 'Unscheduled'
      }
      
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    } catch (error) {
      console.error('Error formatting lesson date:', error)
      return 'Date unavailable'
    }
  }
  
  const getLessonStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
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

  if (!program || !student) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Program not found</h3>
          <button
            onClick={() => navigate('/cfi/programs')}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Return to programs
          </button>
        </div>
      </div>
    )
  }

  const totalItems = items.length
  const completedItems = items.filter(item => {
    const itemProgress = getItemProgress(item.id)
    
    if (item.type === 'GROUND' || item.type === 'BOTH') {
      const groundComplete = itemProgress?.ground?.score === 'LEARNED'
      if (!groundComplete) return false
    }
    
    if (item.type === 'FLIGHT' || item.type === 'BOTH') {
      const flightComplete = typeof itemProgress?.flight?.score === 'number' && itemProgress.flight.score >= 4
      if (!flightComplete) return false
    }
    
    return true
  }).length

  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  
  // Group lessons by status
  const upcomingLessons = lessons.filter(l => l.status === 'SCHEDULED')
    .sort((a, b) => {
      // Handle null scheduledDate
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
    })
  
  const completedLessons = lessons.filter(l => l.status === 'COMPLETED')
    .sort((a, b) => {
      // Use completedDate for completed lessons, fallback to scheduledDate
      const aDate = a.completedDate || a.scheduledDate
      const bDate = b.completedDate || b.scheduledDate
      if (!aDate) return 1
      if (!bDate) return -1
      return bDate.toMillis() - aDate.toMillis()
    })

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back
        </button>
        
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {student.displayName} - {getCertificateFullName(program.certificate)}
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              Track progress and lessons for this training program
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              program.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
              program.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {program.status}
            </span>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Overall Progress</h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Completion</span>
          <span className="text-sm font-medium text-gray-900">{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-sky to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {completedItems} of {totalItems} items completed
        </p>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Study Progress */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Study Progress by Area</h3>
          <div className="space-y-3">
            {areas.map(area => {
            const areaItems = items.filter(item => item.areaId === area.id)
            const areaCompleted = areaItems.filter(item => {
              const itemProgress = getItemProgress(item.id)
              
              if (item.type === 'GROUND' || item.type === 'BOTH') {
                const groundComplete = itemProgress?.ground?.score === 'LEARNED'
                if (!groundComplete) return false
              }
              
              if (item.type === 'FLIGHT' || item.type === 'BOTH') {
                const flightComplete = typeof itemProgress?.flight?.score === 'number' && itemProgress.flight.score >= 4
                if (!flightComplete) return false
              }
              
              return true
            }).length
            
            const areaProgress = areaItems.length > 0 ? Math.round((areaCompleted / areaItems.length) * 100) : 0
            const isExpanded = expandedAreas.has(area.id)

            return (
              <div key={area.id} className="bg-white shadow rounded-lg">
                <div className="p-4 border-b border-gray-200">
                  <button
                    onClick={() => toggleArea(area.id)}
                    className="w-full flex items-center justify-between text-left"
                  >
                    <div className="flex items-center">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400 mr-2" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      <h4 className="text-base font-medium text-gray-900">{area.name}</h4>
                    </div>
                    <span className="text-sm font-medium text-gray-500">
                      {areaCompleted}/{areaItems.length}
                    </span>
                  </button>
                  <div className="mt-2 ml-7 mr-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-sky h-2 rounded-full transition-all duration-500"
                        style={{ width: `${areaProgress}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isExpanded && areaItems.length > 0 && (
                  <div className="divide-y divide-gray-200">
                    {areaItems.map(item => {
                      const itemProgress = getItemProgress(item.id)
                      const showGround = item.type === 'GROUND' || item.type === 'BOTH'
                      const showFlight = item.type === 'FLIGHT' || item.type === 'BOTH'

                      return (
                        <div key={item.id} className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="text-sm font-medium text-gray-900">{item.name}</h5>
                              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>
                            </div>
                            <span className={`ml-4 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              item.type === 'GROUND'
                                ? 'bg-blue-100 text-blue-800'
                                : item.type === 'FLIGHT'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}>
                              {item.type}
                            </span>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-4">
                            {showGround && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-500 flex items-center">
                                    <BookOpenIcon className="h-3 w-3 mr-1" />
                                    Ground
                                  </span>
                                  <span className={`text-xs font-medium ${getScoreColor(itemProgress?.ground?.score, 'GROUND')}`}>
                                    {getScoreDisplay(itemProgress?.ground?.score, 'GROUND')}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${getProgressBar(itemProgress?.ground?.score, 'GROUND')}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {showFlight && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-gray-500 flex items-center">
                                    <ChartBarIcon className="h-3 w-3 mr-1" />
                                    Flight
                                  </span>
                                  <span className={`text-xs font-medium ${getScoreColor(itemProgress?.flight?.score, 'FLIGHT')}`}>
                                    {getScoreDisplay(itemProgress?.flight?.score, 'FLIGHT')}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                                    style={{ width: `${getProgressBar(itemProgress?.flight?.score, 'FLIGHT')}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {itemProgress && (itemProgress.ground?.notes || itemProgress.flight?.notes) && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 italic">
                                Last note: {itemProgress.ground?.notes || itemProgress.flight?.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>

        {/* Right Column: Lessons */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Lessons</h3>
            <button
              onClick={() => setShowScheduleLesson(true)}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky hover:bg-sky-600"
            >
              <PlusIcon className="h-4 w-4 mr-1" />
              Schedule Lesson
            </button>
          </div>

          {/* Schedule Lesson Form */}
          {showScheduleLesson && (
            <div id="schedule-lesson-form" className="bg-white shadow rounded-lg p-6">
              <h4 className="text-base font-medium text-gray-900 mb-4">Schedule New Lesson</h4>
              
              <div className="space-y-4">
                {lessonPlans.length > 0 && (
                  <div>
                    <label htmlFor="lessonPlan" className="block text-sm font-medium text-gray-700">
                      Lesson Plan (optional)
                    </label>
                    <select
                      id="lessonPlan"
                      value={selectedLessonPlan}
                      onChange={(e) => setSelectedLessonPlan(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
                    >
                      <option value="">Custom lesson (no plan)</option>
                      {lessonPlans.map(plan => (
                        <option key={plan.id} value={plan.id}>
                          Lesson {plan.orderNumber}: {plan.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                      Date (optional)
                    </label>
                    <input
                      type="date"
                      id="date"
                      value={lessonDate}
                      onChange={(e) => setLessonDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                      Time (optional, defaults to 9:00 AM)
                    </label>
                    <input
                      type="time"
                      id="time"
                      value={lessonTime}
                      onChange={(e) => setLessonTime(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Lesson Title {!selectedLessonPlan && '(optional)'}
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="e.g., Introduction to Pattern Work"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="motivation" className="block text-sm font-medium text-gray-700">
                    Motivation (optional)
                  </label>
                  <textarea
                    id="motivation"
                    rows={2}
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    placeholder="Why is this lesson important? What will the student gain?"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="objectives" className="block text-sm font-medium text-gray-700">
                    Objectives (optional, one per line)
                  </label>
                  <textarea
                    id="objectives"
                    rows={3}
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    placeholder="What will the student be able to do after this lesson?&#10;- Objective 1&#10;- Objective 2"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="planDescription" className="block text-sm font-medium text-gray-700">
                    Lesson Plan (optional)
                  </label>
                  <textarea
                    id="planDescription"
                    rows={3}
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    placeholder="Describe the lesson plan and activities..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="preStudyHomework" className="block text-sm font-medium text-gray-700">
                    Pre-Study Homework (optional)
                  </label>
                  <textarea
                    id="preStudyHomework"
                    rows={2}
                    value={preStudyHomework}
                    onChange={(e) => setPreStudyHomework(e.target.value)}
                    placeholder="What should the student study or prepare before the lesson?"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="route" className="block text-sm font-medium text-gray-700">
                    Planned Route (optional)
                  </label>
                  <input
                    type="text"
                    id="route"
                    value={plannedRoute}
                    onChange={(e) => setPlannedRoute(e.target.value)}
                    placeholder="e.g., KPAO - KHAF - KPAO"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>

                {/* Study Items Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Study Items ({selectedItems.size} selected)
                  </label>
                  <div className="border border-gray-300 rounded-md max-h-48 overflow-y-auto">
                    {areas.length === 0 ? (
                      <p className="text-sm text-gray-500 p-3">No study areas available</p>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {areas.map(area => {
                          const areaItems = items.filter(item => item.areaId === area.id)
                          const isExpanded = expandedAreas.has(area.id)
                          const selectedInArea = areaItems.filter(item => selectedItems.has(item.id)).length
                          
                          return (
                            <div key={area.id}>
                              <button
                                type="button"
                                onClick={() => toggleArea(area.id)}
                                className="w-full flex items-center justify-between text-left px-3 py-2 hover:bg-gray-50"
                              >
                                <div className="flex items-center">
                                  {isExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 text-gray-400 mr-2" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 text-gray-400 mr-2" />
                                  )}
                                  <span className="text-sm font-medium text-gray-900">{area.name}</span>
                                </div>
                                <span className="text-xs text-gray-500">
                                  {selectedInArea}/{areaItems.length}
                                </span>
                              </button>
                              
                              {isExpanded && areaItems.length > 0 && (
                                <div className="bg-gray-50 px-3 py-1 space-y-0.5">
                                  {areaItems.map(item => {
                                    const itemTypes = selectedItemTypes.get(item.id) || new Set()
                                    const isGroundSelected = itemTypes.has('GROUND')
                                    const isFlightSelected = itemTypes.has('FLIGHT')
                                    const isSelected = selectedItems.has(item.id)
                                    
                                    return (
                                      <div key={item.id} className="hover:bg-white p-1.5 rounded">
                                        <div className="flex items-start">
                                          <div className="flex-1">
                                            <div className="flex items-center">
                                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                            </div>
                                            {item.description && (
                                              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                            )}
                                            <div className="mt-1.5 flex items-center gap-3">
                                              {(item.type === 'GROUND' || item.type === 'BOTH') && (
                                                <label className="flex items-center cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={item.type === 'GROUND' ? isSelected : isGroundSelected}
                                                    onChange={(e) => {
                                                      const newSelected = new Set(selectedItems)
                                                      const newTypes = new Map(selectedItemTypes)
                                                      const types = new Set(selectedItemTypes.get(item.id))
                                                      
                                                      if (item.type === 'GROUND') {
                                                        if (e.target.checked) {
                                                          newSelected.add(item.id)
                                                        } else {
                                                          newSelected.delete(item.id)
                                                        }
                                                      } else {
                                                        if (e.target.checked) {
                                                          types.add('GROUND')
                                                          newSelected.add(item.id)
                                                        } else {
                                                          types.delete('GROUND')
                                                          if (types.size === 0) {
                                                            newSelected.delete(item.id)
                                                          }
                                                        }
                                                        newTypes.set(item.id, types)
                                                      }
                                                      
                                                      setSelectedItems(newSelected)
                                                      setSelectedItemTypes(newTypes)
                                                    }}
                                                    className="h-3.5 w-3.5 text-sky focus:ring-sky border-gray-300 rounded"
                                                  />
                                                  <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                    Ground
                                                  </span>
                                                </label>
                                              )}
                                              {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                                                <label className="flex items-center cursor-pointer">
                                                  <input
                                                    type="checkbox"
                                                    checked={item.type === 'FLIGHT' ? isSelected : isFlightSelected}
                                                    onChange={(e) => {
                                                      const newSelected = new Set(selectedItems)
                                                      const newTypes = new Map(selectedItemTypes)
                                                      const types = new Set(selectedItemTypes.get(item.id))
                                                      
                                                      if (item.type === 'FLIGHT') {
                                                        if (e.target.checked) {
                                                          newSelected.add(item.id)
                                                        } else {
                                                          newSelected.delete(item.id)
                                                        }
                                                      } else {
                                                        if (e.target.checked) {
                                                          types.add('FLIGHT')
                                                          newSelected.add(item.id)
                                                        } else {
                                                          types.delete('FLIGHT')
                                                          if (types.size === 0) {
                                                            newSelected.delete(item.id)
                                                          }
                                                        }
                                                        newTypes.set(item.id, types)
                                                      }
                                                      
                                                      setSelectedItems(newSelected)
                                                      setSelectedItemTypes(newTypes)
                                                    }}
                                                    className="h-3.5 w-3.5 text-sky focus:ring-sky border-gray-300 rounded"
                                                  />
                                                  <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                    Flight
                                                  </span>
                                                </label>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reference Materials */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Materials
                  </label>
                  
                  {referenceMaterials.length > 0 ? (
                    <div className="space-y-2 mb-2">
                      {referenceMaterials.map((material, index) => (
                        <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 rounded group">
                          {material.type === 'link' ? (
                            <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                          ) : (
                            <DocumentIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{material.name}</p>
                            {material.note && (
                              <p className="text-xs text-gray-500 mt-1">{material.note}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMaterialIndex(index)
                                setShowReferenceModal(true)
                              }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = referenceMaterials.filter((_, i) => i !== index)
                                setReferenceMaterials(updated)
                              }}
                              className="text-gray-400 hover:text-red-600"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-2">No reference materials added</p>
                  )}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMaterialIndex(null)
                      setShowReferenceModal(true)
                    }}
                    className="text-sm text-sky hover:text-sky-600"
                  >
                    <PlusIcon className="h-4 w-4 inline mr-1" />
                    Add Reference Material
                  </button>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Pre-lesson Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    value={preNotes}
                    onChange={(e) => setPreNotes(e.target.value)}
                    placeholder="Any preparation notes or focus areas for this lesson..."
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowScheduleLesson(false)
                    setSelectedLessonPlan('')
                    setLessonTitle('')
                    setLessonDate('')
                    setLessonTime('')
                    setPlannedRoute('')
                    setPreNotes('')
                    setMotivation('')
                    setObjectives('')
                    setPlanDescription('')
                    setPreStudyHomework('')
                    setSelectedItems(new Set())
                    setReferenceMaterials([])
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScheduleLesson}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600"
                >
                  Create Lesson
                </button>
              </div>
            </div>
          )}



          {/* Upcoming Lessons */}
          {upcomingLessons.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h4 className="text-base font-medium text-gray-900 flex items-center">
                  <CalendarDaysIcon className="h-5 w-5 text-sky mr-2" />
                  Upcoming Lessons
                </h4>
              </div>
              <ul className="divide-y divide-gray-200">
                {upcomingLessons.slice(0, 5).map(lesson => (
                  <li key={lesson.id}>
                    <div
                      onClick={() => navigate(`/cfi/lessons/${lesson.id}`)}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.title || 'Untitled Lesson'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatLessonDate(lesson)}
                          </p>
                          {lesson.items.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {lesson.items.length} items planned
                            </p>
                          )}
                        </div>
                        {lesson.scheduledDate && (() => {
                          const date = toDate(lesson.scheduledDate)
                          return date && date < new Date()
                        })() && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Past scheduled time
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {upcomingLessons.length > 5 && (
                <div className="p-4 bg-gray-50">
                  <button
                    onClick={() => navigate('/cfi/lessons')}
                    className="text-sm text-sky hover:text-sky-600"
                  >
                    View all {upcomingLessons.length} upcoming lessons →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Completed Lessons */}
          {completedLessons.length > 0 && (
            <div className="bg-white shadow rounded-lg">
              <div className="p-4 border-b border-gray-200">
                <h4 className="text-base font-medium text-gray-900 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  Completed Lessons
                </h4>
              </div>
              <ul className="divide-y divide-gray-200">
                {(showAllCompletedLessons ? completedLessons : completedLessons.slice(0, 3)).map(lesson => (
                  <li key={lesson.id}>
                    <div
                      onClick={() => navigate(`/cfi/lessons/${lesson.id}`)}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {lesson.title || 'Untitled Lesson'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatLessonDate(lesson)}
                          </p>
                          {lesson.items.length > 0 && (
                            <p className="text-xs text-gray-400 mt-1">
                              {lesson.items.filter(i => i.completed).length}/{lesson.items.length} items completed
                            </p>
                          )}
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getLessonStatusColor(lesson.status)}`}>
                          {lesson.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {completedLessons.length > 3 && (
                <div className="p-4 bg-gray-50">
                  <button
                    onClick={() => setShowAllCompletedLessons(!showAllCompletedLessons)}
                    className="text-sm text-sky hover:text-sky-600"
                  >
                    {showAllCompletedLessons 
                      ? 'Show less' 
                      : `Show all ${completedLessons.length} completed lessons`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No Lessons */}
          {upcomingLessons.length === 0 && completedLessons.length === 0 && (
            <div className="bg-white shadow rounded-lg p-6 text-center">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">No lessons scheduled yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Click "Schedule Lesson" to get started
              </p>
            </div>
          )}

          {/* Syllabus */}
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <button
                onClick={() => setShowSyllabus(!showSyllabus)}
                className="w-full flex items-center justify-between text-left"
              >
                <h4 className="text-base font-medium text-gray-900 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 text-sky mr-2" />
                  Syllabus
                </h4>
                {showSyllabus ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>
            </div>
            
            {showSyllabus && lessonPlans.length > 0 && (
              <div className="divide-y divide-gray-200">
                {lessonPlans.map(plan => {
                  const isExpanded = expandedLessonPlans.has(plan.id)
                  const planItems = items.filter(item => plan.itemIds.includes(item.id))
                  
                  return (
                    <div key={plan.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <button
                          onClick={() => toggleLessonPlan(plan.id)}
                          className="flex-1 text-left"
                        >
                          <div className="flex items-center">
                            {isExpanded ? (
                              <ChevronDownIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            ) : (
                              <ChevronRightIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                Lesson {plan.orderNumber}: {plan.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {planItems.length} study items • Est. {plan.estimatedDuration.ground}min ground, {plan.estimatedDuration.flight}hr flight
                              </p>
                            </div>
                          </div>
                        </button>
                        <button
                          onClick={() => handleScheduleFromSyllabus(plan.id)}
                          className="ml-4 inline-flex items-center px-3 py-1.5 border border-sky text-xs font-medium rounded text-sky bg-white hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky"
                        >
                          <CalendarDaysIcon className="h-3.5 w-3.5 mr-1" />
                          Schedule
                        </button>
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-4 ml-6 space-y-3">
                          {plan.motivation && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Motivation</p>
                              <p className="text-sm text-gray-600 mt-1">{plan.motivation}</p>
                            </div>
                          )}
                          
                          {plan.objectives && plan.objectives.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Objectives</p>
                              <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                                {plan.objectives.map((obj, i) => (
                                  <li key={i}>{obj}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {plan.planDescription && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Plan Description</p>
                              <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{plan.planDescription}</p>
                            </div>
                          )}
                          
                          {plan.preStudyHomework && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Pre-Study Homework</p>
                              <p className="text-sm text-gray-600 mt-1">{plan.preStudyHomework}</p>
                            </div>
                          )}
                          
                          {planItems.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Study Items</p>
                              <ul className="mt-1 space-y-1">
                                {planItems.map(item => (
                                  <li key={item.id} className="text-sm text-gray-600 flex items-center">
                                    <span className="mr-2">•</span>
                                    <span>{item.name}</span>
                                    <div className="flex gap-1 ml-2">
                                      {(item.type === 'GROUND' || item.type === 'BOTH') && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                          Ground
                                        </span>
                                      )}
                                      {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                          Flight
                                        </span>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {plan.referenceMaterials && plan.referenceMaterials.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-gray-700">Reference Materials</p>
                              <ul className="mt-1 space-y-1">
                                {plan.referenceMaterials.map((material, index) => (
                                  <li key={index} className="text-sm text-gray-600">
                                    <div className="flex items-start">
                                      {material.type === 'link' ? (
                                        <LinkIcon className="h-3 w-3 text-gray-400 mr-2 mt-0.5" />
                                      ) : (
                                        <DocumentIcon className="h-3 w-3 text-gray-400 mr-2 mt-0.5" />
                                      )}
                                      <div>
                                        <a 
                                          href={material.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-sky hover:text-sky-600 hover:underline"
                                        >
                                          {material.name}
                                        </a>
                                        {material.note && (
                                          <p className="text-xs text-gray-500 mt-0.5">{material.note}</p>
                                        )}
                                      </div>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            
            {showSyllabus && lessonPlans.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No lesson plans created for this certificate yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reference Material Modal */}
      {showReferenceModal && (
        <ReferenceMaterialModal
          isOpen={showReferenceModal}
          onClose={() => {
            setShowReferenceModal(false)
            setEditingMaterialIndex(null)
          }}
          onSave={(material) => {
            if (editingMaterialIndex !== null) {
              const updated = [...referenceMaterials]
              updated[editingMaterialIndex] = material
              setReferenceMaterials(updated)
            } else {
              setReferenceMaterials([...referenceMaterials, material])
            }
            setShowReferenceModal(false)
            setEditingMaterialIndex(null)
          }}
          initialMaterial={editingMaterialIndex !== null ? referenceMaterials[editingMaterialIndex] : undefined}
          workspaceId={workspaceId || ''}
          existingFiles={existingFiles}
        />
      )}
    </div>
  )
}