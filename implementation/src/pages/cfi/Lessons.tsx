import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  Timestamp,
} from 'firebase/firestore'
import { db, storage } from '@/lib/firebase'
import { ref, listAll, getDownloadURL } from 'firebase/storage'
import { useAuth } from '@/contexts/AuthContext'
import { Lesson, Student, User, TrainingProgram, LessonPlan, StudyItem, StudyArea, ReferenceMaterial } from '@/types'
import { ReferenceMaterialModal } from '@/components/ReferenceMaterialModal'
import {
  CalendarDaysIcon,
  PlusIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  LinkIcon,
  DocumentIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

export const Lessons: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [students, setStudents] = useState<Map<string, { student: Student; user: User; programs: TrainingProgram[] }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showNewLesson, setShowNewLesson] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState('')
  const [selectedProgram, setSelectedProgram] = useState('')
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>('')
  const [filteredAreas, setFilteredAreas] = useState<StudyArea[]>([])
  const [lessonDate, setLessonDate] = useState('')
  const [lessonTime, setLessonTime] = useState('')
  const [title, setTitle] = useState('')
  const [plannedRoute, setPlannedRoute] = useState('')
  const [preNotes, setPreNotes] = useState('')
  const [motivation, setMotivation] = useState('')
  const [objectives, setObjectives] = useState('')
  const [planDescription, setPlanDescription] = useState('')
  const [preStudyHomework, setPreStudyHomework] = useState('')
  const [studyItems, setStudyItems] = useState<Map<string, StudyItem>>(new Map())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectedItemTypes, setSelectedItemTypes] = useState<Map<string, Set<'GROUND' | 'FLIGHT'>>>(new Map())
  const [studyAreas, setStudyAreas] = useState<StudyArea[]>([])
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [referenceMaterials, setReferenceMaterials] = useState<ReferenceMaterial[]>([])
  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null)
  const [existingFiles, setExistingFiles] = useState<{ id: string; name: string; url: string }[]>([])

  const workspaceId = user?.cfiWorkspaceId || ''

  useEffect(() => {
    if (!workspaceId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Try to load lessons (may fail if index doesn't exist)
        try {
          const lessonsQuery = query(
            collection(db, 'lessons'),
            where('cfiWorkspaceId', '==', workspaceId),
            orderBy('scheduledDate', 'desc')
          )
          const lessonsSnapshot = await getDocs(lessonsQuery)
          const lessonsData = lessonsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Lesson))
          setLessons(lessonsData)
        } catch (lessonsError) {
          // Continue loading students even if lessons fail
        }

        // Load students with their programs
        const studentsMap = new Map<string, { student: Student; user: User; programs: TrainingProgram[] }>()
        const workspaceRef = doc(db, 'workspaces', workspaceId)
        const studentsRef = collection(workspaceRef, 'students')
        const studentsSnapshot = await getDocs(studentsRef)
        
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data() as Student
          
          // Get user data
          const userDoc = await getDoc(doc(db, 'users', studentData.uid))
          if (!userDoc.exists()) {
            continue
          }
          
          const userData = { uid: userDoc.id, ...userDoc.data() } as User
          
          // Get active programs for this student
          try {
            const programsQuery = query(
              collection(db, 'trainingPrograms'),
              where('studentUid', '==', studentData.uid),
              where('cfiWorkspaceId', '==', workspaceId),
              where('status', '==', 'ACTIVE')
            )
            const programsSnapshot = await getDocs(programsQuery)
            const programs = programsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            } as TrainingProgram))
            
            studentsMap.set(studentData.uid, {
              student: studentData,
              user: userData,
              programs
            })
          } catch (programError) {
            // Still add student even if programs fail to load
            studentsMap.set(studentData.uid, {
              student: studentData,
              user: userData,
              programs: []
            })
          }
        }
        
        setStudents(studentsMap)
        
        // Load all study areas
        const areasSnapshot = await getDocs(collection(workspaceRef, 'studyAreas'))
        const areasData = areasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyArea))
        // Sort areas by certificate and order
        areasData.sort((a, b) => {
          if (a.certificate !== b.certificate) {
            return a.certificate.localeCompare(b.certificate)
          }
          return a.order - b.order
        })
        setStudyAreas(areasData)
        
        // Load all study items
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const itemsMap = new Map<string, StudyItem>()
        itemsSnapshot.docs.forEach(doc => {
          itemsMap.set(doc.id, { id: doc.id, ...doc.data() } as StudyItem)
        })
        setStudyItems(itemsMap)
      } catch (error) {
        // Silently handle errors
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceId])

  // Load lesson plans and filter areas when student/program is selected
  useEffect(() => {
    if (!selectedStudent || !workspaceId) {
      setLessonPlans([])
      setSelectedPlan('')
      setFilteredAreas([])
      setSelectedProgram('')
      return
    }

    const studentData = students.get(selectedStudent)
    if (!studentData || studentData.programs.length === 0) {
      setLessonPlans([])
      setSelectedPlan('')
      setFilteredAreas([])
      setSelectedProgram('')
      return
    }

    // If only one program, auto-select it
    if (studentData.programs.length === 1) {
      setSelectedProgram(studentData.programs[0].id)
    }

    const loadLessonPlans = async () => {
      try {
        const allPlans: LessonPlan[] = []
        
        // Get unique certificates from student's active programs
        const certificates = new Set(studentData.programs.map(p => p.certificate))
        
        for (const certificate of certificates) {
          const plansQuery = query(
            collection(db, 'lessonPlans'),
            where('certificate', '==', certificate),
            where('cfiWorkspaceId', '==', workspaceId),
            orderBy('orderNumber', 'asc')
          )
          const plansSnapshot = await getDocs(plansQuery)
          const plans = plansSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as LessonPlan))
          allPlans.push(...plans)
        }
        
        // Sort by certificate and order number
        allPlans.sort((a, b) => {
          if (a.certificate !== b.certificate) {
            return a.certificate.localeCompare(b.certificate)
          }
          return a.orderNumber - b.orderNumber
        })
        
        setLessonPlans(allPlans)
      } catch (error) {
        // Silently handle error
        setLessonPlans([])
      }
    }

    loadLessonPlans()
  }, [selectedStudent, students, workspaceId])

  // Update form fields when a lesson plan is selected
  useEffect(() => {
    if (selectedPlan && lessonPlans.length > 0) {
      const plan = lessonPlans.find(p => p.id === selectedPlan)
      if (plan) {
        // Pre-populate fields from the lesson plan
        setTitle(plan.title)
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
          const item = studyItems.get(itemId)
          if (item && item.type === 'BOTH') {
            newTypes.set(itemId, new Set(['GROUND', 'FLIGHT']))
          }
        })
        setSelectedItemTypes(newTypes)
      }
    } else {
      // Clear fields when no plan is selected
      setTitle('')
      setMotivation('')
      setObjectives('')
      setPlanDescription('')
      setPreStudyHomework('')
      setReferenceMaterials([])
      setSelectedItems(new Set())
      setSelectedItemTypes(new Map())
    }
  }, [selectedPlan, lessonPlans])

  // Filter areas based on selected program
  useEffect(() => {
    if (!selectedProgram || !selectedStudent) {
      setFilteredAreas([])
      return
    }

    const studentData = students.get(selectedStudent)
    if (!studentData) {
      setFilteredAreas([])
      return
    }

    const program = studentData.programs.find(p => p.id === selectedProgram)
    if (!program) {
      setFilteredAreas([])
      return
    }

    // Filter areas by the program's certificate
    const programAreas = studyAreas.filter(area => area.certificate === program.certificate)
    setFilteredAreas(programAreas)
  }, [selectedProgram, selectedStudent, students, studyAreas])

  // Fetch existing files when modal is opened
  useEffect(() => {
    if (showReferenceModal && workspaceId) {
      const fetchExistingFiles = async () => {
        try {
          const materialsRef = ref(storage, `workspaces/${workspaceId}/materials`)
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

  const handleCreateLesson = async () => {
    console.log('handleCreateLesson called', { selectedStudent, selectedProgram })
    if (!selectedStudent || !selectedProgram) {
      console.error('Missing required fields: student or program')
      return
    }

    try {
      const lessonData: Record<string, any> = {
        cfiWorkspaceId: workspaceId,
        studentUid: selectedStudent,
        programId: selectedProgram,
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
        // Add scheduled date only if both date and time are provided
        scheduledDate: lessonDate && lessonTime 
          ? Timestamp.fromDate(new Date(`${lessonDate}T${lessonTime}`))
          : null
      }
      
      // Only add optional fields if they have values
      if (title) lessonData.title = title
      if (plannedRoute) lessonData.plannedRoute = plannedRoute
      if (preNotes) lessonData.preNotes = preNotes

      // If a lesson plan is selected, use its data but allow overrides
      if (selectedPlan) {
        const selectedLessonPlan = lessonPlans.find(p => p.id === selectedPlan)
        if (selectedLessonPlan) {
          lessonData.lessonPlanId = selectedPlan
          lessonData.title = title || selectedLessonPlan.title
          if (motivation || selectedLessonPlan.motivation) {
            lessonData.motivation = motivation || selectedLessonPlan.motivation
          }
          if (objectives || selectedLessonPlan.objectives) {
            lessonData.objectives = objectives ? objectives.split('\n').filter(o => o.trim()) : selectedLessonPlan.objectives
          }
          if (planDescription || selectedLessonPlan.planDescription) {
            lessonData.planDescription = planDescription || selectedLessonPlan.planDescription
          }
          // Merge reference materials - add any custom ones to the lesson plan ones
          const planMaterials = selectedLessonPlan.referenceMaterials || []
          lessonData.referenceMaterials = [...planMaterials, ...referenceMaterials]
          if (preStudyHomework || selectedLessonPlan.preStudyHomework) {
            lessonData.preStudyHomework = preStudyHomework || selectedLessonPlan.preStudyHomework
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
      console.error('Error creating lesson:', error)
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

  const getStudentName = (studentUid: string) => {
    const studentData = students?.get(studentUid)
    return studentData?.user.displayName || 'Unknown Student'
  }

  const formatLessonDateTime = (timestamp: Timestamp | null) => {
    if (!timestamp) {
      return 'Unscheduled'
    }
    const date = timestamp.toDate()
    // Check if this is an unscheduled lesson
    if (date.getFullYear() >= 2099) {
      return 'Unscheduled'
    }
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const toggleAreaExpansion = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
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

  // Group lessons by date
  const lessonsByDate = lessons.reduce((acc, lesson) => {
    if (!lesson.scheduledDate) return acc
    const dateKey = lesson.scheduledDate.toDate().toDateString()
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(lesson)
    return acc
  }, {} as Record<string, Lesson[]>)

  // Check if a lesson is unscheduled (has far future date)
  const isUnscheduled = (lesson: Lesson) => {
    if (!lesson.scheduledDate) return true
    const year = lesson.scheduledDate.toDate().getFullYear()
    return year >= 2099
  }

  // Separate lessons into upcoming (including unscheduled and past scheduled) and completed
  const upcomingLessons = lessons.filter(l => l.status === 'SCHEDULED')
    .sort((a, b) => {
      // Sort unscheduled lessons to the end
      const aUnscheduled = isUnscheduled(a)
      const bUnscheduled = isUnscheduled(b)
      if (aUnscheduled && !bUnscheduled) return 1
      if (!aUnscheduled && bUnscheduled) return -1
      // Otherwise sort by date
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return a.scheduledDate.toMillis() - b.scheduledDate.toMillis()
    })

  const completedLessons = lessons.filter(l => l.status === 'COMPLETED')
    .sort((a, b) => {
      if (!a.scheduledDate) return 1
      if (!b.scheduledDate) return -1
      return b.scheduledDate.toMillis() - a.scheduledDate.toMillis()
    })

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h2 className="text-2xl font-bold text-gray-900">Lessons</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage and track lessons with your students
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowNewLesson(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky-600"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Schedule Lesson
          </button>
        </div>
      </div>

      {/* New Lesson Form */}
      {showNewLesson && (
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule New Lesson</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="student" className="block text-sm font-medium text-gray-700">
                Student
              </label>
              <select
                id="student"
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
              >
                <option value="">Select a student</option>
                {Array.from(students.entries()).map(([uid, data]) => (
                  <option key={uid} value={uid}>
                    {data.user.displayName}
                  </option>
                ))}
              </select>
            </div>

            {selectedStudent && (
              <>
                {students.get(selectedStudent)?.programs && students.get(selectedStudent)!.programs.length > 0 ? (
                  <div>
                    <label htmlFor="program" className="block text-sm font-medium text-gray-700">
                      Training Program
                    </label>
                    <select
                      id="program"
                      value={selectedProgram}
                      onChange={(e) => setSelectedProgram(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
                    >
                      {students.get(selectedStudent)!.programs.length > 1 && (
                        <option value="">Select a program</option>
                      )}
                      {students.get(selectedStudent)!.programs.map(program => (
                        <option key={program.id} value={program.id}>
                          {program.certificate} Program
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="sm:col-span-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      This student has no active training programs. Please create a training program for this student first.
                    </p>
                  </div>
                )}
              </>
            )}

            {selectedProgram && lessonPlans.length > 0 && (
              <div>
                <label htmlFor="lessonPlan" className="block text-sm font-medium text-gray-700">
                  Lesson Plan (optional)
                </label>
                <select
                  id="lessonPlan"
                  value={selectedPlan}
                  onChange={(e) => setSelectedPlan(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-sky focus:outline-none focus:ring-sky sm:text-sm"
                >
                  <option value="">Custom lesson (no plan)</option>
                  {(() => {
                    const selectedProgramData = students.get(selectedStudent)?.programs.find(p => p.id === selectedProgram)
                    const filteredPlans = selectedProgramData 
                      ? lessonPlans.filter(plan => plan.certificate === selectedProgramData.certificate)
                      : lessonPlans
                    return filteredPlans.map(plan => (
                      <option key={plan.id} value={plan.id}>
                        Lesson {plan.orderNumber}: {plan.title}
                      </option>
                    ))
                  })()}
                </select>
              </div>
            )}

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
                Time (optional)
              </label>
              <input
                type="time"
                id="time"
                value={lessonTime}
                onChange={(e) => setLessonTime(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Lesson Title {!selectedPlan && '(optional)'}
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Introduction to Pattern Work"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>

            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2">
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

            <div className="sm:col-span-2">
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

            {/* Study Items Selection - Only show when program is selected */}
            {selectedProgram && (
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Study Items ({selectedItems.size} selected)
                </label>
                <div className="border border-gray-300 rounded-md max-h-96 overflow-y-auto">
                  {filteredAreas.length === 0 ? (
                    <p className="text-sm text-gray-500 p-3">No study areas available for this program</p>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredAreas.map(area => {
                      const areaItems = Array.from(studyItems.values()).filter(item => item.areaId === area.id)
                      const isExpanded = expandedAreas.has(area.id)
                      const selectedInArea = areaItems.filter(item => selectedItems.has(item.id)).length
                      
                      return (
                        <div key={area.id}>
                          <button
                            type="button"
                            onClick={() => toggleAreaExpansion(area.id)}
                            className="w-full flex items-center justify-between text-left px-3 py-3 hover:bg-gray-50"
                          >
                            <div className="flex items-center">
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-400 mr-2" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-gray-400 mr-2" />
                              )}
                              <span className="text-sm font-medium text-gray-900">{area.name}</span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({area.certificate})
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {selectedInArea}/{areaItems.length}
                            </span>
                          </button>
                          
                          {isExpanded && areaItems.length > 0 && (
                            <div className="bg-gray-50 px-3 py-2 space-y-1">
                              {areaItems.map(item => {
                                const itemTypes = selectedItemTypes.get(item.id) || new Set()
                                const isGroundSelected = itemTypes.has('GROUND')
                                const isFlightSelected = itemTypes.has('FLIGHT')
                                const isSelected = selectedItems.has(item.id)
                                
                                return (
                                  <div key={item.id} className="hover:bg-white p-2 rounded">
                                    <div className="flex items-start">
                                      <div className="flex-1">
                                        <div className="flex items-center">
                                          <span className="text-sm font-medium text-gray-900">{item.name}</span>
                                        </div>
                                        {item.description && (
                                          <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                        )}
                                        <div className="mt-2 flex items-center gap-4">
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
                                                className="h-4 w-4 text-sky focus:ring-sky border-gray-300 rounded"
                                              />
                                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
                                                className="h-4 w-4 text-sky focus:ring-sky border-gray-300 rounded"
                                              />
                                              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
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
            )}

            {/* Reference Materials Section */}
            <div className="sm:col-span-2">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reference Materials (optional)
                </label>
                
                {referenceMaterials.map((material, index) => (
                  <div key={index} className="mb-2 p-3 bg-gray-50 rounded-md group">
                    <div className="flex items-start space-x-2">
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
                            setReferenceMaterials(materials => materials.filter((_, i) => i !== index))
                          }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => {
                    setEditingMaterialIndex(null)
                    setShowReferenceModal(true)
                  }}
                  className="mt-2 inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Reference Material
                </button>
              </div>
            </div>

            <div className="sm:col-span-2">
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
                setShowNewLesson(false)
                setSelectedStudent('')
                setSelectedProgram('')
                setSelectedPlan('')
                setLessonPlans([])
                setTitle('')
                setLessonDate('')
                setLessonTime('')
                setPlannedRoute('')
                setPreNotes('')
                setMotivation('')
                setObjectives('')
                setPlanDescription('')
                setPreStudyHomework('')
                setSelectedItems(new Set())
                setSelectedItemTypes(new Map())
                setExpandedAreas(new Set())
                setFilteredAreas([])
                setReferenceMaterials([])
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateLesson}
              disabled={!selectedStudent || !selectedProgram}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Lesson
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarDaysIcon className="h-6 w-6 text-sky" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Upcoming Lessons
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {upcomingLessons.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Completed Lessons
                  </dt>
                  <dd className="mt-1 text-3xl font-semibold text-gray-900">
                    {completedLessons.length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Lessons */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Lessons</h3>
        {upcomingLessons.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {upcomingLessons.map((lesson) => (
                <li key={lesson.id}>
                  <div
                    onClick={() => navigate(`/cfi/lessons/${lesson.id}`)}
                    className="px-4 py-4 hover:bg-gray-50 sm:px-6 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <CalendarDaysIcon className="h-8 w-8 text-gray-400" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getStudentName(lesson.studentUid)}
                            {lesson.title && <span className="ml-2 text-gray-500">- {lesson.title}</span>}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatLessonDateTime(lesson.scheduledDate)}
                          </div>
                          {lesson.plannedRoute && (
                            <div className="text-xs text-gray-400 mt-1">
                              Route: {lesson.plannedRoute}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {/* Show if the lesson is past its scheduled time */}
                        {!isUnscheduled(lesson) && lesson.scheduledDate && lesson.scheduledDate.toDate() < new Date() && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Past scheduled time
                          </span>
                        )}
                        {lesson.items.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {lesson.items.length} items
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No upcoming lessons</p>
            <p className="mt-1 text-sm text-gray-500">
              Click "Schedule Lesson" to get started
            </p>
          </div>
        )}
      </div>

      {/* Completed Lessons */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Completed Lessons</h3>
        {completedLessons.length > 0 ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {completedLessons.map((lesson) => (
                <li key={lesson.id}>
                  <div
                    onClick={() => navigate(`/cfi/lessons/${lesson.id}`)}
                    className="px-4 py-4 hover:bg-gray-50 sm:px-6 cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <CheckCircleIcon className="h-8 w-8 text-green-500" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {getStudentName(lesson.studentUid)}
                            {lesson.title && <span className="ml-2 text-gray-500">- {lesson.title}</span>}
                          </div>
                          <div className="text-sm text-gray-500">
                            Completed on {lesson.completedDate ? lesson.completedDate.toDate().toLocaleDateString() : lesson.scheduledDate ? lesson.scheduledDate.toDate().toLocaleDateString() : 'Unknown'}
                          </div>
                          {lesson.actualRoute && (
                            <div className="text-xs text-gray-400 mt-1">
                              Route: {lesson.actualRoute}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLessonStatusColor(lesson.status)}`}>
                          {lesson.status}
                        </span>
                        {lesson.items.length > 0 && (
                          <span className="text-xs text-gray-500">
                            {lesson.items.filter(i => i.completed).length}/{lesson.items.length} items
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <CheckCircleIcon className="mx-auto h-12 w-12 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No completed lessons yet</p>
          </div>
        )}
      </div>
      
      {/* Reference Material Modal */}
      <ReferenceMaterialModal
        isOpen={showReferenceModal}
        onClose={() => {
          setShowReferenceModal(false)
          setEditingMaterialIndex(null)
        }}
        onSave={(material) => {
          if (editingMaterialIndex !== null) {
            // Edit existing
            const updated = [...referenceMaterials]
            updated[editingMaterialIndex] = material
            setReferenceMaterials(updated)
          } else {
            // Add new
            setReferenceMaterials([...referenceMaterials, material])
          }
          setShowReferenceModal(false)
          setEditingMaterialIndex(null)
        }}
        initialMaterial={editingMaterialIndex !== null ? referenceMaterials[editingMaterialIndex] : undefined}
        workspaceId={workspaceId}
        existingFiles={existingFiles}
      />
    </div>
  )
}