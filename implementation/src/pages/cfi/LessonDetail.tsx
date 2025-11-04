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
import { db, functions } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  Lesson,
  User,
  TrainingProgram,
  StudyArea,
  StudyItem,
  LessonItem,
  GroundScore,
  FlightScore,
} from '@/types'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  XMarkIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'

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

  // Form state
  const [actualRoute, setActualRoute] = useState('')
  const [aircraft, setAircraft] = useState('')
  const [weatherNotes, setWeatherNotes] = useState('')
  const [postNotes, setPostNotes] = useState('')
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [itemScores, setItemScores] = useState<Map<string, { ground?: GroundScore; flight?: FlightScore }>>(new Map())
  const [itemNotes, setItemNotes] = useState<Map<string, string>>(new Map())
  const [showAddItems, setShowAddItems] = useState(false)
  const [selectedArea, setSelectedArea] = useState('')

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
        setActualRoute(lessonData.actualRoute || '')
        setAircraft(lessonData.aircraft || '')
        setWeatherNotes(lessonData.weatherNotes || '')
        setPostNotes(lessonData.postNotes || '')

        // Set selected items and scores from existing lesson items
        const selected = new Set<string>()
        const scores = new Map<string, { ground?: GroundScore; flight?: FlightScore }>()
        const notes = new Map<string, string>()
        
        lessonData.items.forEach(item => {
          if (item.planned) selected.add(item.itemId)
          if (item.score !== undefined) {
            const existingScore = scores.get(item.itemId) || {}
            // Determine if it's ground or flight score based on the type
            if (typeof item.score === 'string') {
              scores.set(item.itemId, { ...existingScore, ground: item.score as GroundScore })
            } else {
              scores.set(item.itemId, { ...existingScore, flight: item.score as FlightScore })
            }
          }
          if (item.notes) notes.set(item.itemId, item.notes)
        })
        
        setSelectedItems(selected)
        setItemScores(scores)
        setItemNotes(notes)

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
        const itemsData = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyItem))
        setItems(itemsData)
      } catch (error) {
        // Silently handle error
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
      const lessonItems: LessonItem[] = Array.from(selectedItems).map(itemId => {
        const score = itemScores.get(itemId)
        const notes = itemNotes.get(itemId)
        const completed = lesson.items.find(i => i.itemId === itemId)?.completed || false
        
        return {
          itemId,
          planned: true,
          completed,
          score: score?.ground || score?.flight,
          notes: notes || '',
        }
      })

      // Update lesson
      await updateDoc(doc(db, 'lessons', lesson.id), {
        actualRoute,
        aircraft,
        weatherNotes,
        postNotes,
        items: lessonItems,
      })

      // If lesson is completed, record progress for completed items
      if (lesson.status === 'COMPLETED') {
        const recordProgress = httpsCallable(functions, 'recordProgress')
        
        for (const lessonItem of lessonItems) {
          if (lessonItem.completed && lessonItem.score !== undefined) {
            const item = items.find(i => i.id === lessonItem.itemId)
            if (!item) continue

            // Record ground score
            if ((item.type === 'GROUND' || item.type === 'BOTH') && itemScores.get(lessonItem.itemId)?.ground) {
              await recordProgress({
                studentUid: lesson.studentUid,
                cfiWorkspaceId: lesson.cfiWorkspaceId,
                itemId: lessonItem.itemId,
                score: itemScores.get(lessonItem.itemId)?.ground,
                scoreType: 'GROUND',
                lessonId: lesson.id,
                notes: lessonItem.notes,
              })
            }

            // Record flight score
            if ((item.type === 'FLIGHT' || item.type === 'BOTH') && itemScores.get(lessonItem.itemId)?.flight) {
              await recordProgress({
                studentUid: lesson.studentUid,
                cfiWorkspaceId: lesson.cfiWorkspaceId,
                itemId: lessonItem.itemId,
                score: itemScores.get(lessonItem.itemId)?.flight,
                scoreType: 'FLIGHT',
                lessonId: lesson.id,
                notes: lessonItem.notes,
              })
            }
          }
        }
      }

      // Update local state
      setLesson({ ...lesson, actualRoute, aircraft, weatherNotes, postNotes, items: lessonItems })
    } catch (error) {
      // Silently handle error
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (newStatus: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') => {
    if (!lesson) return

    try {
      const updates: any = { status: newStatus }
      if (newStatus === 'COMPLETED') {
        updates.completedDate = Timestamp.now()
      }

      await updateDoc(doc(db, 'lessons', lesson.id), updates)
      setLesson({ ...lesson, status: newStatus })

      // Save and record progress if completing
      if (newStatus === 'COMPLETED') {
        await handleSave()
      }
    } catch (error) {
      // Silently handle error
    }
  }

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId)
      itemScores.delete(itemId)
      itemNotes.delete(itemId)
    } else {
      newSelected.add(itemId)
    }
    setSelectedItems(newSelected)
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
  const relevantAreas = areas.filter(a => activeCertificates.includes(a.certificate))
  const relevantAreaIds = relevantAreas.map(a => a.id)

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
              {lesson.scheduledDate.toDate().toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex space-x-3">
            {lesson.status === 'SCHEDULED' && (
              <>
                <button
                  onClick={() => handleStatusChange('CANCELLED')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <XMarkIcon className="h-4 w-4 mr-1" />
                  Cancel
                </button>
                <button
                  onClick={() => handleStatusChange('COMPLETED')}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  <CheckIcon className="h-4 w-4 mr-1" />
                  Complete
                </button>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lesson Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lesson Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Lesson Information</h3>
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
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
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  placeholder="e.g., Clear skies, light winds"
                />
              </div>
            </div>

            {lesson.preNotes && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Pre-lesson Notes</label>
                <p className="mt-1 text-sm text-gray-600 italic">{lesson.preNotes}</p>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="postNotes" className="block text-sm font-medium text-gray-700">
                Post-lesson Notes
              </label>
              <textarea
                id="postNotes"
                rows={3}
                value={postNotes}
                onChange={(e) => setPostNotes(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="Summary of the lesson, areas of focus for next time..."
              />
            </div>

            <div className="mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Items Covered */}
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Items to Cover</h3>
              <button
                onClick={() => setShowAddItems(!showAddItems)}
                className="text-sm text-sky hover:text-sky-600"
              >
                <PlusIcon className="h-4 w-4 inline mr-1" />
                Add Items
              </button>
            </div>

            {showAddItems && (
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Area
                </label>
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                >
                  <option value="">Choose an area</option>
                  {relevantAreas.map(area => (
                    <option key={area.id} value={area.id}>
                      {area.name} ({getCertificateFullName(area.certificate)})
                    </option>
                  ))}
                </select>

                {selectedArea && (
                  <div className="mt-3 max-h-60 overflow-y-auto">
                    {items
                      .filter(item => item.areaId === selectedArea)
                      .map(item => (
                        <label key={item.id} className="flex items-start p-2 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => toggleItemSelection(item.id)}
                            className="mt-0.5 h-4 w-4 text-sky focus:ring-sky border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">{item.name}</span>
                        </label>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Items List */}
            <div className="space-y-3">
              {Array.from(selectedItems).map(itemId => {
                const item = items.find(i => i.id === itemId)
                if (!item) return null

                const score = itemScores.get(itemId)
                const notes = itemNotes.get(itemId) || ''
                const lessonItem = lesson.items.find(i => i.itemId === itemId)

                return (
                  <div key={itemId} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                      </div>
                      <button
                        onClick={() => toggleItemSelection(itemId)}
                        className="ml-2 text-gray-400 hover:text-gray-500"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Scoring */}
                    <div className="mt-3 space-y-2">
                      {(item.type === 'GROUND' || item.type === 'BOTH') && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Ground</label>
                          <div className="mt-1 flex space-x-2">
                            <button
                              onClick={() => updateItemScore(itemId, 'ground', 'NOT_TAUGHT')}
                              className={`px-2 py-1 text-xs rounded ${
                                score?.ground === 'NOT_TAUGHT'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              Not Taught
                            </button>
                            <button
                              onClick={() => updateItemScore(itemId, 'ground', 'NEEDS_REINFORCEMENT')}
                              className={`px-2 py-1 text-xs rounded ${
                                score?.ground === 'NEEDS_REINFORCEMENT'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              Needs Work
                            </button>
                            <button
                              onClick={() => updateItemScore(itemId, 'ground', 'LEARNED')}
                              className={`px-2 py-1 text-xs rounded ${
                                score?.ground === 'LEARNED'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                            >
                              Learned
                            </button>
                          </div>
                        </div>
                      )}

                      {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                        <div>
                          <label className="text-xs font-medium text-gray-700">Flight</label>
                          <div className="mt-1 flex space-x-1">
                            {[1, 2, 3, 4, 5].map(num => (
                              <button
                                key={num}
                                onClick={() => updateItemScore(itemId, 'flight', num as FlightScore)}
                                className={`px-2 py-1 text-xs rounded ${
                                  score?.flight === num
                                    ? 'bg-sky text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
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
                            itemNotes.set(itemId, e.target.value)
                            setItemNotes(new Map(itemNotes))
                          }}
                          className="mt-1 block w-full text-xs rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky"
                          placeholder="Add notes..."
                        />
                      </div>

                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={lessonItem?.completed || false}
                          onChange={(e) => {
                            const updatedItems = lesson.items.map(i =>
                              i.itemId === itemId ? { ...i, completed: e.target.checked } : i
                            )
                            setLesson({ ...lesson, items: updatedItems })
                          }}
                          className="h-4 w-4 text-sky focus:ring-sky border-gray-300 rounded"
                        />
                        <label className="ml-2 text-xs text-gray-700">
                          Completed in this lesson
                        </label>
                      </div>
                    </div>
                  </div>
                )
              })}

              {selectedItems.size === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No items selected for this lesson
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}