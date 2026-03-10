import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions, storage } from '@/lib/firebase'
import { ref, listAll, getDownloadURL } from 'firebase/storage'
import { useAuth } from '@/contexts/AuthContext'
import { ReferenceMaterialModal } from '@/components/ReferenceMaterialModal'
import { localDateTimeToTimestamp, timestampToLocalInputs } from '@/utils/dateTime'
import {
  Lesson,
  User,
  TrainingProgram,
  StudyArea,
  StudyItem,
  LessonItem,
  GroundScore,
  FlightScore,
  Progress,
  ReferenceMaterial,
} from '@/types'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  LinkIcon,
  DocumentIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

interface ItemWithSelection extends StudyItem {
  includeGround?: boolean
  includeFlight?: boolean
}

export const LessonDetail: React.FC = () => {
  const { lessonId } = useParams<{ lessonId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [student, setStudent] = useState<User | null>(null)
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  // Tab state
  const [activeTab, setActiveTab] = useState<'planning' | 'execution'>('planning')

  // Planning tab state - editable lesson fields
  const [title, setTitle] = useState('')
  const [motivation, setMotivation] = useState('')
  const [objectives, setObjectives] = useState('')
  const [planDescription, setPlanDescription] = useState('')
  const [preStudyHomework, setPreStudyHomework] = useState('')
  const [plannedRoute, setPlannedRoute] = useState('')
  const [preNotes, setPreNotes] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [referenceMaterials, setReferenceMaterials] = useState<ReferenceMaterial[]>([])
  const [showReferenceModal, setShowReferenceModal] = useState(false)
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null)
  const [existingFiles, setExistingFiles] = useState<{ id: string; name: string; url: string }[]>([])
  const [autoSaving, setAutoSaving] = useState(false)
  
  // Study items state for planning
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, ItemWithSelection>>(new Map())
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [showAddItems, setShowAddItems] = useState(false)

  // Execution tab state
  const [actualDate, setActualDate] = useState('')
  const [actualTime, setActualTime] = useState('')
  const [actualRoute, setActualRoute] = useState('')
  const [aircraft, setAircraft] = useState('')
  const [weatherNotes, setWeatherNotes] = useState('')
  const [postNotes, setPostNotes] = useState('')
  const [itemScores, setItemScores] = useState<Map<string, { ground?: GroundScore; flight?: FlightScore }>>(new Map())
  const [itemNotes, setItemNotes] = useState<Map<string, string>>(new Map())
  
  // Track initial auto-populated values
  const [initialActualDate, setInitialActualDate] = useState('')
  const [initialActualTime, setInitialActualTime] = useState('')
  const [initialScheduledDate, setInitialScheduledDate] = useState('')
  const [initialScheduledTime, setInitialScheduledTime] = useState('')
  const [initialItemScores, setInitialItemScores] = useState<Map<string, { ground?: GroundScore; flight?: FlightScore }>>(new Map())

  // Track changes to enable/disable save button
  useEffect(() => {
    if (!lesson || loading || !initialLoadComplete) return
    
    if (lesson.status === 'SCHEDULED') {
      const planningChanged = 
        title !== (lesson.title || '') ||
        motivation !== (lesson.motivation || '') ||
        objectives !== (lesson.objectives?.join('\n') || '') ||
        planDescription !== (lesson.planDescription || '') ||
        preStudyHomework !== (lesson.preStudyHomework || '') ||
        plannedRoute !== (lesson.plannedRoute || '') ||
        preNotes !== (lesson.preNotes || '') ||
        scheduledDate !== initialScheduledDate || 
        scheduledTime !== initialScheduledTime
      
      // Check if actual date/time have changed from initial values
      const executionChanged = 
        actualDate !== initialActualDate ||
        actualTime !== initialActualTime ||
        actualRoute !== (lesson.actualRoute || '') ||
        aircraft !== (lesson.aircraft || '') ||
        weatherNotes !== (lesson.weatherNotes || '') ||
        postNotes !== (lesson.postNotes || '')
      
      // Check if items have changed
      const currentItems = Array.from(selectedItemsMap.values()).map(item => ({
        itemId: item.id,
        planned: true,
        completed: false,
        includeGround: item.includeGround,
        includeFlight: item.includeFlight,
      }))
      
      const lessonItemsForComparison = (lesson.items || [])
        .filter(li => li.planned)
        .map(li => ({
          itemId: li.itemId,
          planned: true,
          completed: false,
          includeGround: li.includeGround,
          includeFlight: li.includeFlight,
        }))
      
      const itemsChanged = JSON.stringify(currentItems.sort((a, b) => a.itemId.localeCompare(b.itemId))) !== 
                          JSON.stringify(lessonItemsForComparison.sort((a, b) => a.itemId.localeCompare(b.itemId)))
      
      // Check if scores or notes have changed
      let scoresChanged = false
      
      // Compare current scores with initial auto-populated scores
      for (const [itemId, currentScore] of itemScores) {
        const initialScore = initialItemScores.get(itemId)
        if (!initialScore) {
          // This is a new score that wasn't initially populated
          if (currentScore.ground !== undefined || currentScore.flight !== undefined) {
            scoresChanged = true
            break
          }
        } else {
          // Compare with initial auto-populated values
          if (currentScore.ground !== initialScore.ground || currentScore.flight !== initialScore.flight) {
            scoresChanged = true
            break
          }
        }
      }
      
      // Also check if any scores were removed
      if (!scoresChanged) {
        for (const [itemId, initialScore] of initialItemScores) {
          if (!itemScores.has(itemId)) {
            scoresChanged = true
            break
          }
        }
      }
      
      // Check if notes have changed
      if (!scoresChanged) {
        for (const lessonItem of lesson.items || []) {
          const currentNotes = itemNotes.get(lessonItem.itemId)
          if ((currentNotes || '') !== (lessonItem.notes || '')) {
            scoresChanged = true
            break
          }
        }
      }
      
      const hasAnyChanges = planningChanged || executionChanged || itemsChanged || scoresChanged
      setHasChanges(hasAnyChanges)
    } else if (lesson && (lesson.status === 'COMPLETED' || lesson.status === 'CANCELLED')) {
      // For completed/cancelled lessons, only check execution fields
      // Check if actual date/time have changed
      let actualDateTimeValue = ''
      if (lesson.actualDate) {
        try {
          // Handle various date formats
          let actualDateObj: Date
          if (typeof lesson.actualDate.toDate === 'function') {
            actualDateObj = lesson.actualDate.toDate()
          } else if (lesson.actualDate instanceof Date) {
            actualDateObj = lesson.actualDate
          } else if (typeof lesson.actualDate === 'string') {
            actualDateObj = new Date(lesson.actualDate)
          } else if (lesson.actualDate.seconds !== undefined) {
            // Handle raw Firestore timestamp format {seconds, nanoseconds}
            actualDateObj = new Date(lesson.actualDate.seconds * 1000)
          } else {
            // If it's something else, try to convert it
            actualDateObj = new Date(lesson.actualDate as any)
          }
          actualDateTimeValue = `${actualDateObj.toISOString().split('T')[0]}T${actualDateObj.toTimeString().slice(0, 5)}`
        } catch (error) {
          console.error('Error parsing actualDate in change detection:', error, lesson.actualDate)
          actualDateTimeValue = ''
        }
      }
      const currentDateTime = actualDate && actualTime ? `${actualDate}T${actualTime}` : ''
      
      const executionChanged = 
        currentDateTime !== actualDateTimeValue ||
        actualRoute !== (lesson.actualRoute || '') ||
        aircraft !== (lesson.aircraft || '') ||
        weatherNotes !== (lesson.weatherNotes || '') ||
        postNotes !== (lesson.postNotes || '')
      
      setHasChanges(executionChanged)
    }
  }, [lesson, loading, initialLoadComplete, title, motivation, objectives, planDescription, preStudyHomework, plannedRoute, preNotes,
      scheduledDate, scheduledTime, initialScheduledDate, initialScheduledTime,
      actualDate, actualTime, actualRoute, aircraft, weatherNotes, postNotes, selectedItemsMap, itemScores, itemNotes, items,
      initialActualDate, initialActualTime, initialItemScores])

  // Fetch existing files when modal is opened
  useEffect(() => {
    if (showReferenceModal && user?.cfiWorkspaceId) {
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
  }, [showReferenceModal, user?.cfiWorkspaceId])

  useEffect(() => {
    if (!lessonId || !user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const loadLesson = async () => {
      try {
        // Load lesson
        const lessonDoc = await getDoc(doc(db, 'lessons', lessonId))
        if (!lessonDoc.exists()) {
          navigate('/cfi/lessons')
          return
        }

        const lessonData = { id: lessonDoc.id, ...lessonDoc.data() } as Lesson
        
        // Verify this lesson belongs to the CFI's workspace
        if (lessonData.cfiWorkspaceId !== user.cfiWorkspaceId) {
          navigate('/cfi/lessons')
          return
        }

        setLesson(lessonData)
        
        // Initialize planning fields
        setTitle(lessonData.title || '')
        setMotivation(lessonData.motivation || '')
        setObjectives(lessonData.objectives?.join('\n') || '')
        setPlanDescription(lessonData.planDescription || '')
        setPreStudyHomework(lessonData.preStudyHomework || '')
        setPlannedRoute(lessonData.plannedRoute || '')
        setPreNotes(lessonData.preNotes || '')
        setReferenceMaterials(lessonData.referenceMaterials || [])
        
        // Initialize scheduled date/time
        const scheduledParsed = timestampToLocalInputs(lessonData.scheduledDate)
        if (scheduledParsed) {
          setScheduledDate(scheduledParsed.dateStr)
          setScheduledTime(scheduledParsed.timeStr)
          setInitialScheduledDate(scheduledParsed.dateStr)
          setInitialScheduledTime(scheduledParsed.timeStr)
        }

        // Initialize execution fields
        const actualParsed = timestampToLocalInputs(lessonData.actualDate)
        if (actualParsed) {
          setActualDate(actualParsed.dateStr)
          setActualTime(actualParsed.timeStr)
          setInitialActualDate(actualParsed.dateStr)
          setInitialActualTime(actualParsed.timeStr)
        } else if (scheduledParsed) {
          // Auto-populate actual date from scheduled date (skip unscheduled placeholder)
          const year = parseInt(scheduledParsed.dateStr.slice(0, 4))
          if (year < 2099) {
            setActualDate(scheduledParsed.dateStr)
            setActualTime(scheduledParsed.timeStr)
            setInitialActualDate(scheduledParsed.dateStr)
            setInitialActualTime(scheduledParsed.timeStr)
          } else {
            setActualDate('')
            setActualTime('')
            setInitialActualDate('')
            setInitialActualTime('')
          }
        }
        setActualRoute(lessonData.actualRoute || '')
        setAircraft(lessonData.aircraft || '')
        setWeatherNotes(lessonData.weatherNotes || '')
        setPostNotes(lessonData.postNotes || '')

        // Load student info
        const studentDoc = await getDoc(doc(db, 'users', lessonData.studentUid))
        if (studentDoc.exists()) {
          setStudent(studentDoc.data() as User)
        }

        // Load student's active programs
        const programsQuery = query(
          collection(db, 'trainingPrograms'),
          where('studentUid', '==', lessonData.studentUid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId),
          where('status', '==', 'ACTIVE')
        )
        const programsSnapshot = await getDocs(programsQuery)
        const programsData = programsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TrainingProgram))
        setPrograms(programsData)

        // Load study areas and items
        const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
        const areasSnapshot = await getDocs(collection(workspaceRef, 'studyAreas'))
        const areasData = areasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyArea))
        setAreas(areasData)

        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const itemsData = itemsSnapshot.docs.map(doc => {
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
            order: data.orderNumber || data.order || 0,
            createdAt: data.createdAt
          } as StudyItem
        })
        setItems(itemsData)

        // Initialize selected items with ground/flight selection from lesson
        const selectedMap = new Map<string, ItemWithSelection>()
        const scores = new Map<string, { ground?: GroundScore; flight?: FlightScore }>()
        const notes = new Map<string, string>()
        
        lessonData.items.forEach(lessonItem => {
          if (lessonItem.planned) {
            const item = itemsData.find(i => i.id === lessonItem.itemId)
            if (item) {
              selectedMap.set(lessonItem.itemId, {
                ...item,
                includeGround: lessonItem.includeGround,
                includeFlight: lessonItem.includeFlight,
              })
            }
          }
          
          // Initialize scores and notes
          const existingScore = scores.get(lessonItem.itemId) || {}
          
          // Handle new score fields first
          if (lessonItem.groundScore !== undefined) {
            existingScore.ground = lessonItem.groundScore
          }
          if (lessonItem.flightScore !== undefined) {
            existingScore.flight = lessonItem.flightScore
          }
          
          // Fall back to old score field for backwards compatibility
          if (!existingScore.ground && !existingScore.flight && lessonItem.score !== undefined) {
            if (typeof lessonItem.score === 'string') {
              existingScore.ground = lessonItem.score as GroundScore
            } else {
              existingScore.flight = lessonItem.score as FlightScore
            }
          }
          
          if (Object.keys(existingScore).length > 0) {
            scores.set(lessonItem.itemId, existingScore)
          }
          
          if (lessonItem.notes) notes.set(lessonItem.itemId, lessonItem.notes)
        })
        
        setSelectedItemsMap(selectedMap)
        setItemScores(scores)
        setItemNotes(notes)

        // Load student's existing progress for all items
        const progressQuery = query(
          collection(db, 'progress'),
          where('studentUid', '==', lessonData.studentUid),
          where('cfiWorkspaceId', '==', user.cfiWorkspaceId)
        )
        const progressSnapshot = await getDocs(progressQuery)
        const progressData = progressSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Progress))

        // Pre-populate scores with existing progress
        const updatedScores = new Map(scores)
        
        // Group progress by itemId and get latest scores
        const latestProgress = new Map<string, { ground?: Progress; flight?: Progress }>()
        
        progressData.forEach(progress => {
          const existing = latestProgress.get(progress.itemId) || {}
          
          if (progress.scoreType === 'GROUND') {
            if (!existing.ground || progress.createdAt.toMillis() > existing.ground.createdAt.toMillis()) {
              existing.ground = progress
            }
          } else if (progress.scoreType === 'FLIGHT') {
            if (!existing.flight || progress.createdAt.toMillis() > existing.flight.createdAt.toMillis()) {
              existing.flight = progress
            }
          }
          
          latestProgress.set(progress.itemId, existing)
        })

        // Only populate scores from progress if they're not already in the lesson
        lessonData.items.forEach(lessonItem => {
          // Skip if this item already has a score in the lesson
          if (lessonItem.score !== undefined) {
            return
          }
          
          const itemProgress = latestProgress.get(lessonItem.itemId)
          if (itemProgress) {
            const existingScore = updatedScores.get(lessonItem.itemId) || {}
            
            // Only add progress scores if they don't exist in the lesson
            if (!existingScore.ground && itemProgress.ground) {
              existingScore.ground = itemProgress.ground.score as GroundScore
            }
            if (!existingScore.flight && itemProgress.flight) {
              existingScore.flight = itemProgress.flight.score as FlightScore
            }
            
            if (existingScore.ground || existingScore.flight) {
              updatedScores.set(lessonItem.itemId, existingScore)
            }
          }
        })
        
        setItemScores(updatedScores)
        // Store initial auto-populated scores for change detection
        setInitialItemScores(new Map(updatedScores))

        // If lesson is completed or cancelled, show execution tab
        if (lessonData.status !== 'SCHEDULED') {
          setActiveTab('execution')
        }
        
        // Mark initial load as complete
        setInitialLoadComplete(true)
      } catch (error) {
        console.error('Error loading lesson:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLesson()
  }, [lessonId, user?.cfiWorkspaceId, navigate])

  const handleSave = async () => {
    if (!lesson) return
    
    setSaving(true)
    try {
      // Build lesson items from selected items
      const lessonItems: LessonItem[] = Array.from(selectedItemsMap.values()).map(item => {
        const scores = itemScores.get(item.id)
        const notes = itemNotes.get(item.id)
        
        // Determine if item is completed based on scores
        let completed = false
        if (scores) {
          // Check based on what's included in the lesson
          if (item.type === 'GROUND' || (item.type === 'BOTH' && item.includeGround && !item.includeFlight)) {
            completed = scores.ground === 'LEARNED'
          } else if (item.type === 'FLIGHT' || (item.type === 'BOTH' && !item.includeGround && item.includeFlight)) {
            completed = scores.flight !== undefined && scores.flight >= 4
          } else if (item.type === 'BOTH' && item.includeGround && item.includeFlight) {
            // For BOTH items where both are included, both need to meet criteria
            const groundComplete = scores.ground === 'LEARNED'
            const flightComplete = scores.flight !== undefined && scores.flight >= 4
            completed = groundComplete && flightComplete
          }
        }
        
        const lessonItem: LessonItem = {
          itemId: item.id,
          planned: true,
          completed,
        }
        
        // Only include optional fields if they have values
        if (notes) lessonItem.notes = notes
        
        // Set include flags based on item type
        if (item.type === 'GROUND') {
          lessonItem.includeGround = true
          lessonItem.includeFlight = false
        } else if (item.type === 'FLIGHT') {
          lessonItem.includeGround = false
          lessonItem.includeFlight = true
        } else if (item.type === 'BOTH') {
          // For BOTH items, use the selection or default to both
          lessonItem.includeGround = item.includeGround !== false
          lessonItem.includeFlight = item.includeFlight !== false
        }
        
        // Store scores in the lesson item (temporarily until completion)
        if (scores) {
          if (scores.ground !== undefined) lessonItem.groundScore = scores.ground
          if (scores.flight !== undefined) lessonItem.flightScore = scores.flight
        }
        
        return lessonItem
      })

      // Update lesson with all fields
      const updates: Record<string, any> = {
        items: lessonItems || [],
      }

      // Always update execution fields (use null instead of undefined for Firestore)
      if (actualDate && actualTime) {
        updates.actualDate = localDateTimeToTimestamp(actualDate, actualTime)
      }
      if (actualRoute) updates.actualRoute = actualRoute
      if (aircraft) updates.aircraft = aircraft
      if (weatherNotes) updates.weatherNotes = weatherNotes
      if (postNotes) updates.postNotes = postNotes

      // Only update planning fields if lesson is scheduled
      if (lesson.status === 'SCHEDULED') {
        if (title) updates.title = title
        if (motivation) updates.motivation = motivation
        // Always set objectives as an array (can be empty)
        updates.objectives = objectives ? objectives.split('\n').filter(o => o.trim()) : []
        if (planDescription) updates.planDescription = planDescription
        if (preStudyHomework) updates.preStudyHomework = preStudyHomework
        if (plannedRoute) updates.plannedRoute = plannedRoute
        if (preNotes) updates.preNotes = preNotes
        // Update scheduled date/time
        if (scheduledDate) {
          updates.scheduledDate = localDateTimeToTimestamp(scheduledDate, scheduledTime || '09:00')
        }
        // Reference materials are now auto-saved, so we don't include them here
      }

      // Debug: Log updates to see what might be undefined
      console.log('Saving updates:', updates)
      
      // Deep clean function to remove undefined values from nested objects
      const deepClean = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(item => deepClean(item))
        } else if (obj !== null && typeof obj === 'object') {
          return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = deepClean(value)
            }
            return acc
          }, {} as Record<string, any>)
        }
        return obj
      }
      
      const cleanedUpdates = deepClean(updates)
      
      await updateDoc(doc(db, 'lessons', lesson.id), cleanedUpdates)

      // Note: Progress is now recorded when completing the lesson, not when saving

      // Update local state
      setLesson({ 
        ...lesson, 
        ...updates,
      })
      
      // Update initial scores to the newly saved scores to reset change detection
      setInitialItemScores(new Map(itemScores))
      
      setHasChanges(false)
    } catch (error) {
      console.error('Error saving lesson:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') => {
    if (!lesson) return

    try {
      // Build current lesson items from selected items (same as handleSave does)
      const currentLessonItems: LessonItem[] = Array.from(selectedItemsMap.values()).map(item => {
        const scores = itemScores.get(item.id)
        const notes = itemNotes.get(item.id)
        
        // Determine if item is completed based on scores
        let completed = false
        if (scores) {
          // Check based on what's included in the lesson
          if (item.type === 'GROUND' || (item.type === 'BOTH' && item.includeGround && !item.includeFlight)) {
            completed = scores.ground === 'LEARNED'
          } else if (item.type === 'FLIGHT' || (item.type === 'BOTH' && !item.includeGround && item.includeFlight)) {
            completed = scores.flight !== undefined && scores.flight >= 4
          } else if (item.type === 'BOTH' && item.includeGround && item.includeFlight) {
            // For BOTH items where both are included, both need to meet criteria
            const groundComplete = scores.ground === 'LEARNED'
            const flightComplete = scores.flight !== undefined && scores.flight >= 4
            completed = groundComplete && flightComplete
          }
        }
        
        const lessonItem: LessonItem = {
          itemId: item.id,
          planned: true,
          completed,
        }
        
        // Only include optional fields if they have values
        if (notes) lessonItem.notes = notes
        
        // Set include flags based on item type
        if (item.type === 'GROUND') {
          lessonItem.includeGround = true
          lessonItem.includeFlight = false
        } else if (item.type === 'FLIGHT') {
          lessonItem.includeGround = false
          lessonItem.includeFlight = true
        } else if (item.type === 'BOTH') {
          // For BOTH items, use the selection or default to both
          lessonItem.includeGround = item.includeGround !== false
          lessonItem.includeFlight = item.includeFlight !== false
        }
        
        // Store scores in the lesson item
        if (scores) {
          if (scores.ground !== undefined) lessonItem.groundScore = scores.ground
          if (scores.flight !== undefined) lessonItem.flightScore = scores.flight
        }
        
        return lessonItem
      })

      // Save current changes first (including actualDate)
      await handleSave()

      // Then update status
      const updates: any = { status: newStatus }
      if (newStatus === 'COMPLETED') {
        // Set completedDate to when the lesson actually occurred:
        // 1. Use actual execution date/time if available (when the lesson was actually flown)
        // 2. Otherwise use scheduled date (when it was supposed to happen) 
        // 3. If neither exists, use current time as fallback
        
        // First check if we have actualDate in state (which was just saved)
        if (actualDate && actualTime) {
          updates.completedDate = localDateTimeToTimestamp(actualDate, actualTime)
        } else {
          // If no actual date in state, check the lesson's actualDate field
          // (might exist from a previous save)
          const lessonDoc = await getDoc(doc(db, 'lessons', lesson.id))
          const currentLessonData = lessonDoc.data()
          
          if (currentLessonData?.actualDate) {
            updates.completedDate = currentLessonData.actualDate
          } else if (currentLessonData?.scheduledDate) {
            updates.completedDate = currentLessonData.scheduledDate
          } else if (lesson.scheduledDate) {
            updates.completedDate = lesson.scheduledDate
          } else {
            updates.completedDate = Timestamp.now()
          }
        }
      }

      // Clean up any undefined values before updating
      const cleanedStatusUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as Record<string, any>)
      
      await updateDoc(doc(db, 'lessons', lesson.id), cleanedStatusUpdates)
      
      // If completing lesson, record progress
      if (newStatus === 'COMPLETED') {
        const recordProgress = httpsCallable(functions, 'recordProgress')
        const progressErrors: string[] = []
        
        // Use the current lesson items we just built, not the potentially stale lesson.items
        for (const lessonItem of currentLessonItems) {
          // Skip if item wasn't planned for this lesson
          if (!lessonItem.planned) continue
          
          const itemScore = itemScores.get(lessonItem.itemId)
          
          // Only record progress if there are actual scores
          if (itemScore) {
            try {
              // Get the item type from selectedItemsMap
              const item = selectedItemsMap.get(lessonItem.itemId)
              if (!item) continue
              
              // For GROUND items or BOTH items with ground included
              const shouldRecordGround = item.type === 'GROUND' || 
                                       (item.type === 'BOTH' && lessonItem.includeGround !== false)
              
              // For FLIGHT items or BOTH items with flight included  
              const shouldRecordFlight = item.type === 'FLIGHT' || 
                                       (item.type === 'BOTH' && lessonItem.includeFlight !== false)
              
              // Record ground score if applicable and scored
              if (shouldRecordGround && itemScore.ground !== undefined) {
                await recordProgress({
                  studentUid: lesson.studentUid,
                  cfiWorkspaceId: lesson.cfiWorkspaceId,
                  itemId: lessonItem.itemId,
                  score: itemScore.ground,
                  scoreType: 'GROUND',
                  lessonId: lesson.id,
                  notes: itemNotes.get(lessonItem.itemId) || '',
                })
              }

              // Record flight score if applicable and scored
              if (shouldRecordFlight && itemScore.flight !== undefined) {
                await recordProgress({
                  studentUid: lesson.studentUid,
                  cfiWorkspaceId: lesson.cfiWorkspaceId,
                  itemId: lessonItem.itemId,
                  score: itemScore.flight,
                  scoreType: 'FLIGHT',
                  lessonId: lesson.id,
                  notes: itemNotes.get(lessonItem.itemId) || '',
                })
              }
            } catch (error) {
              console.error(`Failed to record progress for item ${lessonItem.itemId}:`, error)
              progressErrors.push(lessonItem.itemId)
            }
          }
        }
      }
      
      // Update local state with new status
      setLesson({ ...lesson, status: newStatus })

      // Switch to execution tab if completing
      if (newStatus === 'COMPLETED') {
        setActiveTab('execution')
      }
    } catch (error) {
      console.error('Error changing status:', error)
    }
  }

  const toggleAreaExpanded = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }

  const toggleItemSelection = (item: StudyItem | ItemWithSelection) => {
    const newSelectedMap = new Map(selectedItemsMap)
    
    if (newSelectedMap.has(item.id)) {
      newSelectedMap.delete(item.id)
      // Also remove scores and notes
      itemScores.delete(item.id)
      itemNotes.delete(item.id)
      setItemScores(new Map(itemScores))
      setItemNotes(new Map(itemNotes))
    } else {
      // If includeGround/includeFlight are already set, use them
      if ('includeGround' in item && 'includeFlight' in item) {
        newSelectedMap.set(item.id, item as ItemWithSelection)
      } else {
        // Default to including both ground and flight for BOTH items
        newSelectedMap.set(item.id, {
          ...item,
          includeGround: item.type === 'GROUND' || item.type === 'BOTH',
          includeFlight: item.type === 'FLIGHT' || item.type === 'BOTH',
        })
      }
    }
    
    setSelectedItemsMap(newSelectedMap)
  }

  const toggleItemGroundFlight = (itemId: string, type: 'ground' | 'flight') => {
    const newSelectedMap = new Map(selectedItemsMap)
    const item = newSelectedMap.get(itemId)
    
    if (item) {
      if (type === 'ground') {
        item.includeGround = !item.includeGround
      } else {
        item.includeFlight = !item.includeFlight
      }
      
      // If both are unchecked, remove the item
      if (item.type === 'BOTH' && !item.includeGround && !item.includeFlight) {
        newSelectedMap.delete(itemId)
        // Also remove scores and notes
        itemScores.delete(itemId)
        itemNotes.delete(itemId)
        setItemScores(new Map(itemScores))
        setItemNotes(new Map(itemNotes))
      } else {
        newSelectedMap.set(itemId, { ...item })
      }
      
      setSelectedItemsMap(newSelectedMap)
    }
  }

  const updateItemScore = (itemId: string, scoreType: 'ground' | 'flight', score: GroundScore | FlightScore | undefined) => {
    const currentScore = itemScores.get(itemId) || {}
    if (score === undefined) {
      if (scoreType === 'ground') {
        delete currentScore.ground
      } else {
        delete currentScore.flight
      }
      if (Object.keys(currentScore).length === 0) {
        itemScores.delete(itemId)
      } else {
        itemScores.set(itemId, currentScore)
      }
    } else {
      itemScores.set(itemId, { ...currentScore, [scoreType]: score })
    }
    setItemScores(new Map(itemScores))
  }

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

  if (!lesson || !student) {
    return (
      <div className="px-4 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h3 className="text-sm font-medium text-red-800">Lesson not found</h3>
          <button
            onClick={() => navigate('/cfi/lessons')}
            className="mt-2 text-sm text-red-600 hover:text-red-500"
          >
            Return to lessons
          </button>
        </div>
      </div>
    )
  }

  // Filter areas and items by active programs
  const activeCertificates = programs.map(p => p.certificate)
  // If no active programs, show all areas
  const relevantAreas = activeCertificates.length > 0 
    ? areas.filter(a => activeCertificates.includes(a.certificate))
    : areas
  const relevantAreaIds = relevantAreas.map(a => a.id)
  const relevantItems = items.filter(item => relevantAreaIds.includes(item.areaId))

  // Group items by area for hierarchical display
  const itemsByArea = new Map<string, StudyItem[]>()
  relevantItems.forEach(item => {
    const areaItems = itemsByArea.get(item.areaId) || []
    areaItems.push(item)
    itemsByArea.set(item.areaId, areaItems)
  })

  const isReadOnly = lesson.status !== 'SCHEDULED'

  return (
    <div className="px-4 sm:px-0 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/cfi/lessons')}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Lessons
        </button>

        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              Lesson with {student.displayName}
            </h2>
            <p className="mt-2 text-sm text-gray-700">
              <CalendarDaysIcon className="inline-block h-4 w-4 mr-1" />
              {(() => {
                const dateToShow = lesson.status === 'COMPLETED' && lesson.completedDate ? lesson.completedDate : lesson.scheduledDate
                if (!dateToShow) return 'Not scheduled'
                
                try {
                  let date: Date
                  if (typeof dateToShow.toDate === 'function') {
                    date = dateToShow.toDate()
                  } else if (dateToShow instanceof Date) {
                    date = dateToShow
                  } else if (dateToShow.seconds !== undefined) {
                    date = new Date(dateToShow.seconds * 1000)
                  } else {
                    date = new Date(dateToShow as any)
                  }
                  
                  return date.toLocaleString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                } catch (error) {
                  console.error('Error formatting lesson date:', error)
                  return 'Date unavailable'
                }
              })()}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {lesson.status === 'SCHEDULED' && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-sky hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                {activeTab === 'planning' && (
                  <button
                    onClick={() => handleStatusChange('CANCELLED')}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <XMarkIcon className="h-4 w-4 mr-1" />
                    Cancel Lesson
                  </button>
                )}
                {activeTab === 'execution' && (
                  <button
                    onClick={() => handleStatusChange('COMPLETED')}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Complete Lesson
                  </button>
                )}
              </>
            )}
            {lesson.status === 'CANCELLED' && (
              <button
                onClick={() => handleStatusChange('SCHEDULED')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-sky hover:bg-sky-600"
              >
                Reschedule
              </button>
            )}
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              lesson.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800' :
              lesson.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              'bg-red-100 text-red-800'
            }`}>
              {lesson.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation for scheduled lessons */}
      {!isReadOnly && (
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('planning')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'planning'
                  ? 'border-sky text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Lesson Planning
            </button>
            <button
              onClick={() => {
                setActiveTab('execution')
                // Auto-populate actual date/time with current date/time if empty
                if (!actualDate && !actualTime) {
                  const now = new Date()
                  // Use local timezone date to avoid UTC off-by-one bug (toISOString returns UTC)
                  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
                  const timeStr = now.toTimeString().slice(0, 5)
                  setActualDate(dateStr)
                  setActualTime(timeStr)
                }
              }}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'execution'
                  ? 'border-sky text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Lesson Execution
            </button>
          </nav>
        </div>
      )}

      {/* Planning Tab Content */}
      {(activeTab === 'planning' && !isReadOnly) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Lesson Planning Fields */}
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Lesson Plan
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="Enter lesson title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      id="scheduledDate"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="scheduledTime" className="block text-sm font-medium text-gray-700">
                      Scheduled Time
                    </label>
                    <input
                      type="time"
                      id="scheduledTime"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="motivation" className="block text-sm font-medium text-gray-700">
                    Motivation
                  </label>
                  <textarea
                    id="motivation"
                    rows={2}
                    value={motivation}
                    onChange={(e) => setMotivation(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="Why is this lesson important?"
                  />
                </div>

                <div>
                  <label htmlFor="objectives" className="block text-sm font-medium text-gray-700">
                    Learning Objectives
                  </label>
                  <textarea
                    id="objectives"
                    rows={3}
                    value={objectives}
                    onChange={(e) => setObjectives(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="What will the student learn? (one per line)"
                  />
                </div>

                <div>
                  <label htmlFor="planDescription" className="block text-sm font-medium text-gray-700">
                    Lesson Plan Description
                  </label>
                  <textarea
                    id="planDescription"
                    rows={4}
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="Describe the lesson activities and flow"
                  />
                </div>

                <div>
                  <label htmlFor="preStudyHomework" className="block text-sm font-medium text-gray-700">
                    Pre-Study Homework
                  </label>
                  <textarea
                    id="preStudyHomework"
                    rows={2}
                    value={preStudyHomework}
                    onChange={(e) => setPreStudyHomework(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="What should the student prepare before the lesson?"
                  />
                </div>

                <div>
                  <label htmlFor="plannedRoute" className="block text-sm font-medium text-gray-700">
                    Planned Route
                  </label>
                  <input
                    type="text"
                    id="plannedRoute"
                    value={plannedRoute}
                    onChange={(e) => setPlannedRoute(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="e.g., KPAO - KHAF - KPAO"
                  />
                </div>

                <div>
                  <label htmlFor="preNotes" className="block text-sm font-medium text-gray-700">
                    Pre-Lesson Notes
                  </label>
                  <textarea
                    id="preNotes"
                    rows={3}
                    value={preNotes}
                    onChange={(e) => setPreNotes(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    placeholder="Any preparation notes or focus areas"
                  />
                </div>
              </div>
            </div>

            {/* Reference Materials Section */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Reference Materials
                  {autoSaving && (
                    <span className="ml-2 text-sm text-gray-500">
                      Saving...
                    </span>
                  )}
                </h3>
                <button
                  onClick={() => {
                    setEditingMaterialIndex(null)
                    setShowReferenceModal(true)
                  }}
                  className="text-sm text-sky hover:text-sky-600"
                >
                  <PlusIcon className="h-4 w-4 inline mr-1" />
                  Add Material
                </button>
              </div>
              
              {referenceMaterials.length > 0 ? (
                <div className="space-y-2">
                  {referenceMaterials.map((material, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 rounded group">
                      {material.type === 'link' ? (
                        <LinkIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                      ) : (
                        <DocumentIcon className="h-5 w-5 text-gray-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <a 
                          href={material.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-sky hover:text-sky-600"
                        >
                          {material.name}
                        </a>
                        {material.note && (
                          <p className="text-xs text-gray-500 mt-1">{material.note}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingMaterialIndex(index)
                            setShowReferenceModal(true)
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <span className="text-xs">Edit</span>
                        </button>
                        <button
                          onClick={async () => {
                            const updated = referenceMaterials.filter((_, i) => i !== index)
                            setReferenceMaterials(updated)
                            
                            // Auto-save after deletion
                            if (lesson?.status === 'SCHEDULED') {
                              setAutoSaving(true)
                              try {
                                await updateDoc(doc(db, 'lessons', lesson.id), {
                                  referenceMaterials: updated
                                })
                                
                                // Update local lesson state
                                setLesson({
                                  ...lesson,
                                  referenceMaterials: updated
                                })
                                
                                // Show success feedback
                                setTimeout(() => setAutoSaving(false), 1000)
                              } catch (error) {
                                console.error('Error auto-saving after deletion:', error)
                                setAutoSaving(false)
                                alert('Failed to delete reference material')
                              }
                            }
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
                <p className="text-sm text-gray-500">No reference materials added</p>
              )}
            </div>
          </div>

          {/* Right Column - Study Items Selection */}
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Study Items</h3>
                <button
                  onClick={() => setShowAddItems(!showAddItems)}
                  className="text-sm text-sky hover:text-sky-600"
                >
                  <PlusIcon className="h-4 w-4 inline mr-1" />
                  {showAddItems ? 'Done Adding' : 'Add Items'}
                </button>
              </div>

              {/* Item Selection Mode */}
              {showAddItems && (
                <div className="mb-6 border-b pb-4">
                  <p className="text-sm text-gray-500 mb-3">
                    Select items to add to this lesson
                  </p>
                  
                  {/* Areas with items */}
                  <div className="space-y-2">
                    {relevantAreas.length === 0 ? (
                      <p className="text-sm text-gray-500 italic py-4">
                        {areas.length === 0 
                          ? 'No study curriculum has been set up yet. Please create study areas and items in the Curriculum section.'
                          : programs.length === 0 
                            ? 'The student needs an active training program to see relevant study items.'
                            : 'No study areas found for the student\'s active programs.'}
                      </p>
                    ) : (
                      <>
                      {relevantAreas.filter(area => (itemsByArea.get(area.id) || []).length > 0).length === 0 && (
                        <p className="text-sm text-gray-500 italic py-4">
                          No study items available in the curriculum. Please add items to the study areas in the Curriculum section.
                        </p>
                      )}
                      {relevantAreas.map(area => {
                      const areaItems = itemsByArea.get(area.id) || []
                      if (areaItems.length === 0) return null
                      
                      const isExpanded = expandedAreas.has(area.id)
                      
                      // Count selected items in this area
                      const selectedCount = areaItems.filter(item => selectedItemsMap.has(item.id)).length
                      
                      return (
                        <div key={area.id} className="border rounded-md">
                          <button
                            onClick={() => toggleAreaExpanded(area.id)}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50"
                          >
                            <div className="flex items-center">
                              {isExpanded ? (
                                <ChevronDownIcon className="h-4 w-4 text-gray-400 mr-2" />
                              ) : (
                                <ChevronRightIcon className="h-4 w-4 text-gray-400 mr-2" />
                              )}
                              <span className="text-sm font-medium text-gray-900">{area.name}</span>
                              <span className="ml-2 text-xs text-gray-500">
                                ({getCertificateFullName(area.certificate)})
                              </span>
                            </div>
                            <div className="flex items-center space-x-3">
                              {selectedCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                                  {selectedCount} selected
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {areaItems.length} items
                              </span>
                            </div>
                          </button>
                          
                          {isExpanded && (
                            <div className="px-4 pb-2 space-y-1">
                              {areaItems.map(item => {
                                const selectedItem = selectedItemsMap.get(item.id)
                                const isGroundSelected = selectedItem?.includeGround || false
                                const isFlightSelected = selectedItem?.includeFlight || false
                                const isSelected = selectedItemsMap.has(item.id)
                                
                                return (
                                  <div key={item.id} className="p-2 hover:bg-gray-50 rounded">
                                    <div className="flex items-start">
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                                        <div className="mt-2 flex items-center gap-4">
                                          {(item.type === 'GROUND' || item.type === 'BOTH') && (
                                            <label className="flex items-center cursor-pointer">
                                              <input
                                                type="checkbox"
                                                checked={item.type === 'GROUND' ? isSelected : isGroundSelected}
                                                onChange={() => {
                                                  if (item.type === 'GROUND') {
                                                    toggleItemSelection(item)
                                                  } else {
                                                    // For BOTH items, toggle ground selection
                                                    if (!isSelected) {
                                                      // Add item with only ground selected
                                                      const newItem: ItemWithSelection = {
                                                        ...item,
                                                        includeGround: true,
                                                        includeFlight: false,
                                                      }
                                                      toggleItemSelection(newItem)
                                                    } else {
                                                      // Toggle ground while keeping item
                                                      toggleItemGroundFlight(item.id, 'ground')
                                                    }
                                                  }
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
                                                onChange={() => {
                                                  if (item.type === 'FLIGHT') {
                                                    toggleItemSelection(item)
                                                  } else {
                                                    // For BOTH items, toggle flight selection
                                                    if (!isSelected) {
                                                      // Add item with only flight selected
                                                      const newItem: ItemWithSelection = {
                                                        ...item,
                                                        includeGround: false,
                                                        includeFlight: true,
                                                      }
                                                      toggleItemSelection(newItem)
                                                    } else {
                                                      // Toggle flight while keeping item
                                                      toggleItemGroundFlight(item.id, 'flight')
                                                    }
                                                  }
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
                    </>
                    )
                    }
                  </div>
                </div>
              )}

              {/* Selected Items */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  Selected Items ({selectedItemsMap.size})
                </p>
                
                {selectedItemsMap.size === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No items selected for this lesson
                  </p>
                ) : (
                  Array.from(selectedItemsMap.values()).map(item => {
                    const area = areas.find(a => a.id === item.areaId)
                    
                    return (
                      <div key={item.id} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {area?.name} • {item.description}
                            </p>
                          </div>
                          <button
                            onClick={() => toggleItemSelection(item)}
                            className="ml-2 text-gray-400 hover:text-gray-500"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                        
                        {/* Display which portions are included */}
                        {item.type === 'BOTH' && (
                          <div className="mt-2 flex items-center space-x-2">
                            <span className="text-xs text-gray-500">Includes:</span>
                            {item.includeGround && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Ground
                              </span>
                            )}
                            {item.includeFlight && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Flight
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Execution Tab Content (or read-only view) */}
      {(activeTab === 'execution' || isReadOnly) && (
        <div className="space-y-6">
          {/* Read-only lesson info for completed/cancelled lessons */}
          {isReadOnly && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Lesson Information
              </h3>
              
              {lesson.title && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">Title</p>
                  <p className="text-sm text-gray-900 mt-1">{lesson.title}</p>
                </div>
              )}
              
              {lesson.motivation && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">Motivation</p>
                  <p className="text-sm text-gray-600 mt-1">{lesson.motivation}</p>
                </div>
              )}
              
              {lesson.objectives && lesson.objectives.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">Learning Objectives</p>
                  <ul className="list-disc list-inside text-sm text-gray-600 space-y-1 mt-1">
                    {lesson.objectives.map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {lesson.planDescription && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">Lesson Plan</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{lesson.planDescription}</p>
                </div>
              )}

              {lesson.preStudyHomework && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">Pre-Study Homework</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{lesson.preStudyHomework}</p>
                </div>
              )}

              {lesson.preNotes && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700">Pre-Lesson Notes</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{lesson.preNotes}</p>
                </div>
              )}
            </div>
          )}
          
          {/* Execution Details */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Execution Details
            </h3>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="actualDate" className="block text-sm font-medium text-gray-700">
                  Actual Date
                </label>
                <input
                  type="date"
                  id="actualDate"
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm disabled:bg-gray-50"
                />
              </div>

              <div>
                <label htmlFor="actualTime" className="block text-sm font-medium text-gray-700">
                  Actual Time
                </label>
                <input
                  type="time"
                  id="actualTime"
                  value={actualTime}
                  onChange={(e) => setActualTime(e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm disabled:bg-gray-50"
                />
              </div>

              <div>
                <label htmlFor="plannedRoute" className="block text-sm font-medium text-gray-700">
                  Planned Route
                </label>
                <p className="mt-1 text-sm text-gray-900">{lesson.plannedRoute || 'Not specified'}</p>
              </div>

              <div>
                <label htmlFor="actualRoute" className="block text-sm font-medium text-gray-700">
                  Actual Route
                </label>
                <input
                  type="text"
                  id="actualRoute"
                  value={actualRoute}
                  onChange={(e) => setActualRoute(e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm disabled:bg-gray-50"
                  placeholder="e.g., KPAO - KHAF - KPAO"
                />
              </div>

              <div>
                <label htmlFor="aircraft" className="block text-sm font-medium text-gray-700">
                  Aircraft
                </label>
                <input
                  type="text"
                  id="aircraft"
                  value={aircraft}
                  onChange={(e) => setAircraft(e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm disabled:bg-gray-50"
                  placeholder="e.g., N12345"
                />
              </div>

              <div>
                <label htmlFor="weatherNotes" className="block text-sm font-medium text-gray-700">
                  Weather Notes
                </label>
                <input
                  type="text"
                  id="weatherNotes"
                  value={weatherNotes}
                  onChange={(e) => setWeatherNotes(e.target.value)}
                  disabled={isReadOnly}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm disabled:bg-gray-50"
                  placeholder="e.g., Clear skies, light winds"
                />
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="postNotes" className="block text-sm font-medium text-gray-700">
                Post-lesson Notes
              </label>
              {isReadOnly ? (
                <div className="mt-1 min-h-[80px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 whitespace-pre-wrap">
                  {postNotes || <span className="text-gray-400 italic">No post-lesson notes recorded.</span>}
                </div>
              ) : (
                <textarea
                  id="postNotes"
                  rows={6}
                  value={postNotes}
                  onChange={(e) => setPostNotes(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  placeholder="Summary of the lesson, areas of focus for next time..."
                />
              )}
            </div>

            {/* Reference Materials - Read-only display */}
            {lesson.referenceMaterials && lesson.referenceMaterials.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Reference Materials
                </h4>
                <div className="space-y-2">
                  {lesson.referenceMaterials.map((material, index) => (
                    <div key={index} className="flex items-start space-x-2 p-2 bg-gray-50 rounded">
                      {material.type === 'link' ? (
                        <LinkIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                      ) : (
                        <DocumentIcon className="h-4 w-4 text-gray-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <a 
                          href={material.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-sky hover:text-sky-600"
                        >
                          {material.name}
                        </a>
                        {material.note && (
                          <p className="text-xs text-gray-500 mt-1">{material.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Items Scoring */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Items Covered
            </h3>

            <div className="space-y-3">
              {selectedItemsMap.size === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  No items selected for this lesson
                </p>
              ) : (
                Array.from(selectedItemsMap.values()).map(item => {
                  const score = itemScores.get(item.id)
                  const notes = itemNotes.get(item.id) || ''
                  const area = areas.find(a => a.id === item.areaId)
                  
                  return (
                    <div key={item.id} className="border border-gray-200 rounded-md p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {area?.name} • {item.description}
                          </p>
                        </div>
                      </div>

                      {/* Scoring */}
                      <div className="mt-3 space-y-2">
                        {(item.type === 'GROUND' || (item.type === 'BOTH' && item.includeGround)) && (
                          <div>
                            <label className="text-xs font-medium text-gray-700">Ground Score</label>
                            <div className="mt-1 flex space-x-2">
                              <button
                                onClick={() => updateItemScore(item.id, 'ground', 'NOT_TAUGHT')}
                                disabled={isReadOnly}
                                className={`px-2 py-1 text-xs rounded ${
                                  score?.ground === 'NOT_TAUGHT'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-600'
                                } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Not Taught
                              </button>
                              <button
                                onClick={() => updateItemScore(item.id, 'ground', 'NEEDS_REINFORCEMENT')}
                                disabled={isReadOnly}
                                className={`px-2 py-1 text-xs rounded ${
                                  score?.ground === 'NEEDS_REINFORCEMENT'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-600'
                                } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Needs Work
                              </button>
                              <button
                                onClick={() => updateItemScore(item.id, 'ground', 'LEARNED')}
                                disabled={isReadOnly}
                                className={`px-2 py-1 text-xs rounded ${
                                  score?.ground === 'LEARNED'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-600'
                                } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                Learned
                              </button>
                            </div>
                          </div>
                        )}

                        {(item.type === 'FLIGHT' || (item.type === 'BOTH' && item.includeFlight)) && (
                          <div>
                            <label className="text-xs font-medium text-gray-700">Flight Score</label>
                            <div className="mt-1 flex space-x-1">
                              {[1, 2, 3, 4, 5].map(num => (
                                <button
                                  key={num}
                                  onClick={() => updateItemScore(item.id, 'flight', num as FlightScore)}
                                  disabled={isReadOnly}
                                  className={`px-2 py-1 text-xs rounded ${
                                    score?.flight === num
                                      ? 'bg-sky text-white'
                                      : 'bg-gray-100 text-gray-600'
                                  } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-medium text-gray-700">Notes</label>
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => {
                              itemNotes.set(item.id, e.target.value)
                              setItemNotes(new Map(itemNotes))
                            }}
                            disabled={isReadOnly}
                            className="mt-1 block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky disabled:bg-gray-50"
                            placeholder="Add notes..."
                          />
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reference Material Modal */}
      {showReferenceModal && (
        <ReferenceMaterialModal
          isOpen={showReferenceModal}
          onClose={() => {
            setShowReferenceModal(false)
            setEditingMaterialIndex(null)
          }}
          onSave={async (material) => {
            let updatedMaterials: ReferenceMaterial[]
            if (editingMaterialIndex !== null) {
              updatedMaterials = [...referenceMaterials]
              updatedMaterials[editingMaterialIndex] = material
            } else {
              updatedMaterials = [...referenceMaterials, material]
            }
            setReferenceMaterials(updatedMaterials)
            setShowReferenceModal(false)
            setEditingMaterialIndex(null)
            
            // Auto-save reference materials
            if (lesson?.status === 'SCHEDULED') {
              setAutoSaving(true)
              try {
                await updateDoc(doc(db, 'lessons', lesson.id), {
                  referenceMaterials: updatedMaterials
                })
                
                // Update local lesson state
                setLesson({
                  ...lesson,
                  referenceMaterials: updatedMaterials
                })
                
                // Show success feedback
                setTimeout(() => setAutoSaving(false), 1000)
              } catch (error) {
                console.error('Error auto-saving reference materials:', error)
                setAutoSaving(false)
                alert('Failed to save reference material')
              }
            }
          }}
          initialMaterial={editingMaterialIndex !== null ? referenceMaterials[editingMaterialIndex] : undefined}
          workspaceId={user?.cfiWorkspaceId || ''}
          existingFiles={existingFiles}
        />
      )}
    </div>
  )
}