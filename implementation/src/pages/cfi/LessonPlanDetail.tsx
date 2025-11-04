import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import {
  LessonPlan,
  Certificate,
  StudyArea,
  StudyItem,
  ReferenceMaterial,
} from '@/types'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  LinkIcon,
  DocumentIcon,
  ChevronRightIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'

export const LessonPlanDetail: React.FC = () => {
  const { certificate, planId } = useParams<{ certificate: string; planId: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [orderNumber, setOrderNumber] = useState(1)
  const [motivation, setMotivation] = useState('')
  const [objectives, setObjectives] = useState<string[]>([''])
  const [selectedItems, setSelectedItems] = useState<Map<string, Set<'GROUND' | 'FLIGHT'>>>(new Map())
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [planDescription, setPlanDescription] = useState('')
  const [referenceMaterials, setReferenceMaterials] = useState<ReferenceMaterial[]>([])
  const [preStudyHomework, setPreStudyHomework] = useState('')
  const [groundDuration, setGroundDuration] = useState(60)
  const [flightDuration, setFlightDuration] = useState(1.5)

  const workspaceId = user?.cfiWorkspaceId || ''
  const isNewPlan = planId === 'new'
  const isDuplicating = planId?.startsWith('duplicate-')

  useEffect(() => {
    if (!workspaceId || !certificate) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        // Load study areas and items for this certificate
        const workspaceRef = doc(db, 'workspaces', workspaceId)
        
        const areasQuery = query(
          collection(workspaceRef, 'studyAreas'),
          where('certificate', '==', certificate.toUpperCase())
          // orderBy('order', 'asc') // Temporarily removed while index builds
        )
        const areasSnapshot = await getDocs(areasQuery)
        const areasData = areasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyArea))
        setAreas(areasData)
        
        // Start with all areas expanded
        setExpandedAreas(new Set(areasData.map(area => area.id)))

        // Load all study items
        const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
        const allItemsData = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyItem))
        
        // Filter items to only those belonging to areas for this certificate
        const areaIds = new Set(areasData.map(area => area.id))
        const certificateItems = allItemsData.filter(item => areaIds.has(item.areaId))
        setItems(certificateItems)

        // Get the next order number for new plans
        if (isNewPlan && !isDuplicating) {
          const existingPlansQuery = query(
            collection(db, 'lessonPlans'),
            where('certificate', '==', certificate.toUpperCase()),
            where('cfiWorkspaceId', '==', workspaceId)
          )
          const plansSnapshot = await getDocs(existingPlansQuery)
          setOrderNumber(plansSnapshot.size + 1)
        }

        // Load existing plan if editing or duplicating
        if (!isNewPlan) {
          const actualPlanId = isDuplicating ? planId.replace('duplicate-', '') : planId
          const planDoc = await getDoc(doc(db, 'lessonPlans', actualPlanId))
          if (!planDoc.exists()) {
            navigate('/cfi/lesson-plans')
            return
          }

          const planData = planDoc.data() as LessonPlan
          setTitle(isDuplicating ? `${planData.title} (Copy)` : planData.title)
          setOrderNumber(isDuplicating ? orderNumber : planData.orderNumber)
          setMotivation(planData.motivation)
          setObjectives(planData.objectives.length > 0 ? planData.objectives : [''])
          // Convert legacy itemIds to new format
          const itemMap = new Map<string, Set<'GROUND' | 'FLIGHT'>>()
          planData.itemIds.forEach(itemId => {
            const item = certificateItems.find(i => i.id === itemId)
            if (item) {
              const types = new Set<'GROUND' | 'FLIGHT'>()
              if (item.type === 'BOTH') {
                types.add('GROUND')
                types.add('FLIGHT')
              } else if (item.type === 'GROUND') {
                types.add('GROUND')
              } else if (item.type === 'FLIGHT') {
                types.add('FLIGHT')
              }
              itemMap.set(itemId, types)
            }
          })
          setSelectedItems(itemMap)
          setPlanDescription(planData.planDescription)
          setReferenceMaterials(planData.referenceMaterials)
          setPreStudyHomework(planData.preStudyHomework)
          setGroundDuration(planData.estimatedDuration.ground)
          setFlightDuration(planData.estimatedDuration.flight)
        }
      } catch (error) {
        // Silently handle error
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workspaceId, certificate, planId, isNewPlan, isDuplicating, navigate])

  const handleSave = async () => {
    if (!title.trim() || !certificate) return

    setSaving(true)
    try {
      const planData = {
        certificate: certificate.toUpperCase() as Certificate,
        cfiWorkspaceId: workspaceId,
        orderNumber,
        title: title.trim(),
        motivation: motivation.trim(),
        objectives: objectives.filter(o => o.trim()),
        itemIds: Array.from(selectedItems.keys()),
        planDescription: planDescription.trim(),
        referenceMaterials,
        preStudyHomework: preStudyHomework.trim(),
        estimatedDuration: {
          ground: groundDuration,
          flight: flightDuration,
        },
        updatedAt: Timestamp.now(),
      }

      if (isNewPlan || isDuplicating) {
        await addDoc(collection(db, 'lessonPlans'), {
          ...planData,
          createdAt: Timestamp.now(),
        })
      } else {
        await updateDoc(doc(db, 'lessonPlans', planId), planData)
      }

      navigate('/cfi/lesson-plans')
    } catch (error) {
      // Silently handle error
    } finally {
      setSaving(false)
    }
  }

  const addObjective = () => {
    setObjectives([...objectives, ''])
  }

  const updateObjective = (index: number, value: string) => {
    const updated = [...objectives]
    updated[index] = value
    setObjectives(updated)
  }

  const removeObjective = (index: number) => {
    if (objectives.length > 1) {
      setObjectives(objectives.filter((_, i) => i !== index))
    }
  }

  const addReferenceMaterial = () => {
    setReferenceMaterials([
      ...referenceMaterials,
      { type: 'link', name: '', url: '' }
    ])
  }

  const updateReferenceMaterial = (index: number, field: keyof ReferenceMaterial, value: string) => {
    const updated = [...referenceMaterials]
    updated[index] = { ...updated[index], [field]: value }
    setReferenceMaterials(updated)
  }

  const removeReferenceMaterial = (index: number) => {
    setReferenceMaterials(referenceMaterials.filter((_, i) => i !== index))
  }

  const toggleItemSelection = (itemId: string, type: 'GROUND' | 'FLIGHT', item: StudyItem) => {
    const newSelected = new Map(selectedItems)
    const currentTypes = newSelected.get(itemId) || new Set<'GROUND' | 'FLIGHT'>()
    const newTypes = new Set(currentTypes)

    if (newTypes.has(type)) {
      newTypes.delete(type)
    } else {
      newTypes.add(type)
    }

    if (newTypes.size === 0) {
      newSelected.delete(itemId)
    } else {
      newSelected.set(itemId, newTypes)
    }

    setSelectedItems(newSelected)
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

  const isItemSelected = (itemId: string, type: 'GROUND' | 'FLIGHT') => {
    const types = selectedItems.get(itemId)
    return types ? types.has(type) : false
  }

  const getSelectedCount = () => {
    let count = 0
    selectedItems.forEach(types => {
      count += types.size
    })
    return count
  }

  const toggleAreaItems = (areaId: string, select: boolean) => {
    const newSelected = new Map(selectedItems)
    const areaItems = items.filter(item => item.areaId === areaId)
    
    areaItems.forEach(item => {
      if (select) {
        const types = new Set<'GROUND' | 'FLIGHT'>()
        if (item.type === 'BOTH') {
          types.add('GROUND')
          types.add('FLIGHT')
        } else if (item.type === 'GROUND') {
          types.add('GROUND')
        } else if (item.type === 'FLIGHT') {
          types.add('FLIGHT')
        }
        if (types.size > 0) {
          newSelected.set(item.id, types)
        }
      } else {
        newSelected.delete(item.id)
      }
    })
    
    setSelectedItems(newSelected)
  }

  const hasAreaSelection = (areaId: string) => {
    const areaItems = items.filter(item => item.areaId === areaId)
    return areaItems.some(item => selectedItems.has(item.id))
  }

  const getCertificateFullName = () => {
    switch (certificate?.toUpperCase()) {
      case 'PRIVATE':
        return 'Private Pilot License'
      case 'INSTRUMENT':
        return 'Instrument Rating'
      case 'COMMERCIAL':
        return 'Commercial Pilot License'
      default:
        return certificate
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

  return (
    <div className="px-4 sm:px-0 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/cfi/lesson-plans"
          className="flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Lesson Plans
        </Link>

        <h2 className="text-2xl font-bold text-gray-900">
          {isNewPlan ? 'Create' : 'Edit'} Lesson Plan - {getCertificateFullName()}
        </h2>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Basic Information */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Lesson Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="e.g., Introduction to Slow Flight"
              />
            </div>

            <div>
              <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700">
                Lesson Number
              </label>
              <input
                type="number"
                id="orderNumber"
                value={orderNumber}
                onChange={(e) => setOrderNumber(parseInt(e.target.value) || 1)}
                min="1"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Estimated Duration
              </label>
              <div className="mt-1 flex space-x-4">
                <div className="flex-1">
                  <input
                    type="number"
                    value={groundDuration}
                    onChange={(e) => setGroundDuration(parseInt(e.target.value) || 0)}
                    min="0"
                    step="15"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Ground (min)</p>
                </div>
                <div className="flex-1">
                  <input
                    type="number"
                    value={flightDuration}
                    onChange={(e) => setFlightDuration(parseFloat(e.target.value) || 0)}
                    min="0"
                    step="0.1"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Flight (hr)</p>
                </div>
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="motivation" className="block text-sm font-medium text-gray-700">
                Motivation
              </label>
              <textarea
                id="motivation"
                rows={3}
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="Why is this lesson important? What will the student gain?"
              />
            </div>
          </div>
        </div>

        {/* Objectives */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Learning Objectives</h3>
            <button
              type="button"
              onClick={addObjective}
              className="text-sm text-sky hover:text-sky-600"
            >
              <PlusIcon className="h-4 w-4 inline mr-1" />
              Add Objective
            </button>
          </div>
          
          <div className="space-y-2">
            {objectives.map((objective, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-sm text-gray-500 w-6">{index + 1}.</span>
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => updateObjective(index, e.target.value)}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  placeholder="What will the student be able to do?"
                />
                {objectives.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeObjective(index)}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Study Items */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Study Items</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Selected Items */}
            <div className="order-2 lg:order-1">
              <div className="border border-gray-200 rounded-lg p-4">
                {(() => {
                  const groundItems: { item: StudyItem; id: string }[] = []
                  const flightItems: { item: StudyItem; id: string }[] = []
                  
                  selectedItems.forEach((types, itemId) => {
                    const item = items.find(i => i.id === itemId)
                    if (item) {
                      if (types.has('GROUND')) {
                        groundItems.push({ item, id: itemId })
                      }
                      if (types.has('FLIGHT')) {
                        flightItems.push({ item, id: itemId })
                      }
                    }
                  })
                  
                  const hasGroundItems = groundItems.length > 0
                  const hasFlightItems = flightItems.length > 0
                  
                  if (!hasGroundItems && !hasFlightItems) {
                    return (
                      <p className="text-sm text-gray-500 italic">No items selected</p>
                    )
                  }
                  
                  return (
                    <div className="space-y-1">
                      {groundItems.map(({ item }) => (
                        <div key={`ground-${item.id}`} className="text-sm text-gray-700 flex items-center justify-between group hover:bg-gray-50 rounded px-1 py-0.5">
                          <span>
                            <span className="font-medium text-sky">GND</span> {item.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleItemSelection(item.id, 'GROUND', item)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
                            title="Remove from lesson"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      
                      {hasGroundItems && hasFlightItems && (
                        <hr className="my-2 border-gray-300" />
                      )}
                      
                      {flightItems.map(({ item }) => (
                        <div key={`flight-${item.id}`} className="text-sm text-gray-700 flex items-center justify-between group hover:bg-gray-50 rounded px-1 py-0.5">
                          <span>
                            <span className="font-medium text-amber-600">FLT</span> {item.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleItemSelection(item.id, 'FLIGHT', item)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
                            title="Remove from lesson"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
            
            {/* Right Column - Selection Interface */}
            <div className="order-1 lg:order-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (expandedAreas.size === areas.length) {
                        setExpandedAreas(new Set())
                      } else {
                        setExpandedAreas(new Set(areas.map(area => area.id)))
                      }
                    }}
                    className="text-sm text-sky hover:text-sky-600"
                  >
                    {expandedAreas.size === areas.length ? 'Collapse All' : 'Expand All'}
                  </button>
                  <p className="text-sm text-gray-500">
                    {getSelectedCount()} item{getSelectedCount() !== 1 ? 's' : ''} selected
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
            {areas.map(area => {
              const areaItems = items.filter(item => item.areaId === area.id)
              if (areaItems.length === 0) return null
              
              const isExpanded = expandedAreas.has(area.id)
              
              return (
                <div key={area.id} className="border border-gray-200 rounded-lg">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => toggleAreaExpansion(area.id)}
                      className="flex items-center flex-1 text-left hover:text-gray-700 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400 mr-2" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2" />
                      )}
                      <span className="font-medium text-gray-900">{area.name}</span>
                      <span className="ml-2 text-sm text-gray-500">({areaItems.length} items)</span>
                    </button>
                    {isExpanded && (
                      <button
                        type="button"
                        onClick={() => toggleAreaItems(area.id, !hasAreaSelection(area.id))}
                        className="ml-4 text-sm text-sky hover:text-sky-600"
                      >
                        {hasAreaSelection(area.id) ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                  </div>
                  
                  {isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-100">
                      {areaItems.map(item => {
                        const isAnySelected = selectedItems.has(item.id)
                        return (
                          <div key={item.id} className={`px-4 py-3 ${isAnySelected ? 'bg-sky-50' : ''}`}>
                            <div className="mb-2">
                              <h5 className="text-sm font-medium text-gray-900">{item.name}</h5>
                              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                            </div>
                          
                          <div className="flex flex-wrap gap-3">
                            {(item.type === 'GROUND' || item.type === 'BOTH') && (
                              <label className="flex items-center cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isItemSelected(item.id, 'GROUND')}
                                  onChange={() => toggleItemSelection(item.id, 'GROUND', item)}
                                  className="h-4 w-4 text-sky focus:ring-sky border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
                                  Ground
                                </span>
                              </label>
                            )}
                            
                            {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                              <label className="flex items-center cursor-pointer group">
                                <input
                                  type="checkbox"
                                  checked={isItemSelected(item.id, 'FLIGHT')}
                                  onChange={() => toggleItemSelection(item.id, 'FLIGHT', item)}
                                  className="h-4 w-4 text-sky focus:ring-sky border-gray-300 rounded"
                                />
                                <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900">
                                  Flight
                                </span>
                              </label>
                            )}
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
          
          {areas.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No study areas have been created for this certificate yet.
              Please create study areas and items first.
            </p>
          )}
          
          {areas.length > 0 && items.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No study items have been created in the study areas for this certificate.
              Please add study items to the areas first.
            </p>
          )}
            </div>
          </div>
        </div>

        {/* Plan Description */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Lesson Plan</h3>
          <label htmlFor="planDescription" className="block text-sm font-medium text-gray-700 mb-2">
            Detailed Plan
          </label>
          <textarea
            id="planDescription"
            rows={6}
            value={planDescription}
            onChange={(e) => setPlanDescription(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
            placeholder="Describe the lesson flow, maneuvers, procedures, where to fly, what to demonstrate, etc."
          />
        </div>

        {/* Reference Materials */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Reference Materials</h3>
            <button
              type="button"
              onClick={addReferenceMaterial}
              className="text-sm text-sky hover:text-sky-600"
            >
              <PlusIcon className="h-4 w-4 inline mr-1" />
              Add Material
            </button>
          </div>
          
          <div className="space-y-3">
            {referenceMaterials.map((material, index) => (
              <div key={index} className="flex items-start space-x-2">
                <select
                  value={material.type}
                  onChange={(e) => updateReferenceMaterial(index, 'type', e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                >
                  <option value="link">Link</option>
                  <option value="file">File</option>
                </select>
                <input
                  type="text"
                  value={material.name}
                  onChange={(e) => updateReferenceMaterial(index, 'name', e.target.value)}
                  placeholder="Material name"
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                />
                <input
                  type="url"
                  value={material.url}
                  onChange={(e) => updateReferenceMaterial(index, 'url', e.target.value)}
                  placeholder="https://..."
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeReferenceMaterial(index)}
                  className="text-gray-400 hover:text-red-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
            
            {referenceMaterials.length === 0 && (
              <p className="text-sm text-gray-500">No reference materials added</p>
            )}
          </div>
        </div>

        {/* Pre-Study Homework */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pre-Study Homework</h3>
          <label htmlFor="preStudyHomework" className="block text-sm font-medium text-gray-700 mb-2">
            What should the student prepare before this lesson?
          </label>
          <textarea
            id="preStudyHomework"
            rows={4}
            value={preStudyHomework}
            onChange={(e) => setPreStudyHomework(e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
            placeholder="Reading assignments, videos to watch, concepts to review, etc."
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 mb-8">
          <Link
            to="/cfi/lesson-plans"
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving || !title.trim()}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 disabled:opacity-50"
          >
            {saving ? 'Saving...' : (isNewPlan ? 'Create Plan' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  )
}