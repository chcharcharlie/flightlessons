import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  updateDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { LessonPlan, Certificate, StudyArea, StudyItem } from '@/types'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CheckIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
  Bars3Icon,
  LinkIcon,
  DocumentIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ImportExportModal } from '@/components/curriculum/ImportExportModal'
import { useWorkspace } from '@/hooks/useWorkspace'

interface EditingLessonPlan extends LessonPlan {
  isEditing?: boolean
  selectedItems?: Set<string>
  selectedItemTypes?: Map<string, Set<'GROUND' | 'FLIGHT'>>
  expandedAreas?: Set<string>
}

export const LessonPlans: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [lessonPlans, setLessonPlans] = useState<Map<Certificate, EditingLessonPlan[]>>(new Map())
  const [studyAreas, setStudyAreas] = useState<Map<Certificate, StudyArea[]>>(new Map())
  const [studyItems, setStudyItems] = useState<StudyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>(
    (location.state as any)?.selectedCertificate || 
    (sessionStorage.getItem('selectedCertificate') as Certificate) ||
    'PRIVATE'
  )
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set())
  const [editingArea, setEditingArea] = useState<string | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editingItemData, setEditingItemData] = useState<Partial<StudyItem>>({})
  const [addingAreaFor, setAddingAreaFor] = useState<Certificate | null>(null)
  const [newAreaName, setNewAreaName] = useState('')
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null)
  const [newItemData, setNewItemData] = useState<Partial<StudyItem>>({
    name: '',
    type: 'GROUND',
    description: '',
    evaluationCriteria: '',
    acsCodeMappings: [],
    referenceMaterials: []
  })

  const { workspaceId, loading: workspaceLoading } = useWorkspace()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [showImportExport, setShowImportExport] = useState(false)
  
  const loadStudyData = async () => {
    if (!workspaceId) {
      return
    }

    try {
      // Load study areas and items
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      const areasSnapshot = await getDocs(collection(workspaceRef, 'studyAreas'))
      
      // Create a map of certificates to areas
      const areasMap = new Map<Certificate, StudyArea[]>()
      const allAreas: StudyArea[] = []
      
      areasSnapshot.docs.forEach(doc => {
        const data = doc.data()
        const area: StudyArea = {
          id: doc.id,
          name: data.name,
          certificate: data.certificate,
          order: data.orderNumber || 0,
          itemCount: 0, // Will be updated later
          createdAt: data.createdAt || Timestamp.now()
        }
        
        allAreas.push(area)
        
        const certAreas = areasMap.get(area.certificate) || []
        certAreas.push(area)
        areasMap.set(area.certificate, certAreas.sort((a, b) => a.order - b.order))
      })
      
      setStudyAreas(areasMap)
      
      // Load all study items
      const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'))
      const allItems: StudyItem[] = []
      
      itemsSnapshot.docs.forEach(doc => {
        const data = doc.data()
        allItems.push({
          id: doc.id,
          name: data.name,
          type: data.type,
          description: data.description || '',
          evaluationCriteria: data.evaluationCriteria || '',
          acsCodeMappings: data.acsCodeMappings || [],
          referenceMaterials: data.referenceMaterials || [],
          areaId: data.studyAreaId,
          order: data.orderNumber || 0,
          createdAt: data.createdAt
        })
      })
      
      setStudyItems(allItems)
      
      // Update itemCount for each area
      areasMap.forEach((areas, certificate) => {
        areas.forEach(area => {
          area.itemCount = allItems.filter(item => item.areaId === area.id).length
        })
      })
      
      // Load lesson plans
      const certificates: Certificate[] = ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL']
      const plansMap = new Map<Certificate, EditingLessonPlan[]>()
      
      for (const cert of certificates) {
        const plansQuery = query(
          collection(db, 'lessonPlans'),
          where('certificate', '==', cert),
          where('cfiWorkspaceId', '==', workspaceId),
          orderBy('orderNumber', 'asc')
        )
        
        const plansSnapshot = await getDocs(plansQuery)
        const plans = plansSnapshot.docs.map(doc => {
          const planData = doc.data() as LessonPlan
          const selectedItemTypes = new Map<string, Set<'GROUND' | 'FLIGHT'>>()
          
          // Initialize selectedItemTypes based on existing items (assuming both for BOTH type items)
          planData.itemIds.forEach(itemId => {
            const item = allItems.find(i => i.id === itemId)
            if (item) {
              if (item.type === 'GROUND') {
                selectedItemTypes.set(itemId, new Set(['GROUND']))
              } else if (item.type === 'FLIGHT') {
                selectedItemTypes.set(itemId, new Set(['FLIGHT']))
              } else if (item.type === 'BOTH') {
                selectedItemTypes.set(itemId, new Set(['GROUND', 'FLIGHT']))
              }
            }
          })
          
          return {
            id: doc.id,
            ...planData,
            isEditing: false,
            selectedItems: new Set(planData.itemIds),
            selectedItemTypes,
            expandedAreas: new Set(),
          } as EditingLessonPlan
        })
        
        plansMap.set(cert, plans)
      }
      
      setLessonPlans(plansMap)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Clear location state after using it
  useEffect(() => {
    if (location.state) {
      window.history.replaceState({}, document.title)
    }
  }, [location])

  useEffect(() => {
    loadStudyData()
  }, [workspaceId])
  
  useEffect(() => {
    if (!workspaceLoading && workspaceId) {
      setLoading(true)
    }
  }, [workspaceLoading, workspaceId])
  
  useEffect(() => {
    sessionStorage.setItem('selectedCertificate', selectedCertificate)
  }, [selectedCertificate])
  
  // Listen for refresh events from AI chat
  useEffect(() => {
    const handleRefresh = (event: CustomEvent) => {
      const certificate = event.detail?.certificate
      if (!certificate || certificate === selectedCertificate) {
        loadStudyData() // Call the loadStudyData function
      }
    }
    
    // Import and subscribe to events
    import('@/lib/events').then(({ curriculumEvents }) => {
      curriculumEvents.addEventListener('curriculum-refresh', handleRefresh as any)
    })
    
    return () => {
      import('@/lib/events').then(({ curriculumEvents }) => {
        curriculumEvents.removeEventListener('curriculum-refresh', handleRefresh as any)
      })
    }
  }, [selectedCertificate, workspaceId])

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

  const getItemsForArea = (areaId: string) => {
    return studyItems
      .filter(item => item.areaId === areaId)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)
    
    if (!over || active.id === over.id) return
    
    const activeId = active.id as string
    const overId = over.id as string
    
    // Determine if we're moving an area, item, or lesson plan
    const activeArea = (studyAreas.get(selectedCertificate) || []).find(a => a.id === activeId)
    const overArea = (studyAreas.get(selectedCertificate) || []).find(a => a.id === overId)
    const activeItem = studyItems.find(i => i.id === activeId)
    const overItem = studyItems.find(i => i.id === overId)
    const activePlan = (lessonPlans.get(selectedCertificate) || []).find(p => p.id === activeId)
    const overPlan = (lessonPlans.get(selectedCertificate) || []).find(p => p.id === overId)
    
    if (activePlan && overPlan) {
      // Reordering lesson plans
      const plans = lessonPlans.get(selectedCertificate) || []
      const oldIndex = plans.findIndex(p => p.id === activeId)
      const newIndex = plans.findIndex(p => p.id === overId)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newPlans = arrayMove(plans, oldIndex, newIndex)
        
        // Update orderNumber for all plans
        const updatedPlans = newPlans.map((plan, index) => ({
          ...plan,
          orderNumber: index + 1
        }))
        
        setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
        
        // Update in Firebase
        try {
          const batch = writeBatch(db)
          
          updatedPlans.forEach((plan) => {
            const planRef = doc(db, 'lessonPlans', plan.id)
            batch.update(planRef, { orderNumber: plan.orderNumber })
          })
          
          await batch.commit()
        } catch (error) {
          console.error('Error updating lesson plan order:', error)
        }
      }
    } else if (activeArea && overArea) {
      // Reordering areas
      const areas = studyAreas.get(selectedCertificate) || []
      const oldIndex = areas.findIndex(a => a.id === activeId)
      const newIndex = areas.findIndex(a => a.id === overId)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newAreas = arrayMove(areas, oldIndex, newIndex)
        
        // Update order in local state
        const updatedAreas = newAreas.map((area, index) => ({ ...area, order: index }))
        setStudyAreas(new Map(studyAreas).set(selectedCertificate, updatedAreas))
        
        // Update in Firebase
        try {
          const batch = writeBatch(db)
          const workspaceRef = doc(db, 'workspaces', workspaceId)
          
          updatedAreas.forEach((area, index) => {
            const areaRef = doc(workspaceRef, 'studyAreas', area.id)
            batch.update(areaRef, { orderNumber: index })
          })
          
          await batch.commit()
        } catch (error) {
          console.error('Error updating area order:', error)
        }
      }
    } else if (activeItem) {
      // Moving an item
      let newAreaId = activeItem.areaId
      let targetIndex = 0
      
      if (overArea) {
        // Dropping on an area - add as last item in that area
        newAreaId = overArea.id
        const areaItems = getItemsForArea(newAreaId)
        targetIndex = areaItems.length
      } else if (overItem) {
        // Dropping on another item
        newAreaId = overItem.areaId
        const areaItems = getItemsForArea(newAreaId)
        targetIndex = areaItems.findIndex(i => i.id === overItem.id)
        if (targetIndex === -1) targetIndex = 0
      }
      
      // Group all items by area first, maintaining their current order
      const itemsByArea = new Map<string, StudyItem[]>()
      
      // Get all unique area IDs
      const areaIds = new Set(studyItems.map(item => item.areaId))
      
      // Group items by area, preserving order
      areaIds.forEach(areaId => {
        const areaItems = studyItems
          .filter(item => item.areaId === areaId)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        itemsByArea.set(areaId, areaItems)
      })
      
      if (activeItem.areaId === newAreaId) {
        // Moving within the same area
        const areaItems = itemsByArea.get(newAreaId) || []
        const oldIndex = areaItems.findIndex(i => i.id === activeItem.id)
        
        if (oldIndex !== -1 && oldIndex !== targetIndex) {
          // Use arrayMove to reorder
          const reorderedItems = arrayMove(areaItems, oldIndex, targetIndex)
          itemsByArea.set(newAreaId, reorderedItems)
        }
      } else {
        // Moving between areas
        const oldAreaItems = itemsByArea.get(activeItem.areaId) || []
        const newAreaItems = itemsByArea.get(newAreaId) || []
        
        // Remove from old area
        const oldIndex = oldAreaItems.findIndex(i => i.id === activeItem.id)
        if (oldIndex !== -1) {
          oldAreaItems.splice(oldIndex, 1)
          itemsByArea.set(activeItem.areaId, oldAreaItems)
        }
        
        // Add to new area
        const itemToMove = { ...activeItem, areaId: newAreaId }
        newAreaItems.splice(targetIndex, 0, itemToMove)
        itemsByArea.set(newAreaId, newAreaItems)
      }
      
      // Rebuild the complete items array with updated orders
      const finalItems: StudyItem[] = []
      itemsByArea.forEach((items, areaId) => {
        items.forEach((item, index) => {
          finalItems.push({ ...item, areaId, order: index })
        })
      })
      
      setStudyItems(finalItems)
      
      // Update in Firebase
      try {
        const batch = writeBatch(db)
        const workspaceRef = doc(db, 'workspaces', workspaceId)
        
        // Update all items in affected areas
        const affectedAreaIds = new Set([activeItem.areaId, newAreaId])
        affectedAreaIds.forEach(areaId => {
          const areaItems = finalItems.filter(i => i.areaId === areaId)
          areaItems.forEach((item) => {
            const itemRef = doc(workspaceRef, 'studyItems', item.id)
            batch.update(itemRef, { 
              studyAreaId: item.areaId,
              orderNumber: item.order
            })
          })
        })
        
        await batch.commit()
        
        // Update area item counts if moving between areas
        if (activeItem.areaId !== newAreaId) {
          const areas = studyAreas.get(selectedCertificate) || []
          const updatedAreas = areas.map(area => ({
            ...area,
            itemCount: finalItems.filter(i => i.areaId === area.id).length
          }))
          setStudyAreas(new Map(studyAreas).set(selectedCertificate, updatedAreas))
        }
      } catch (error) {
        console.error('Error updating item order:', error)
      }
    }
  }

  const calculateCoverage = () => {
    const areas = studyAreas.get(selectedCertificate) || []
    const plans = lessonPlans.get(selectedCertificate) || []
    
    const allItemIds = new Set<string>()
    const coveredItemIds = new Set<string>()
    
    // Get all items for this certificate
    areas.forEach(area => {
      const items = getItemsForArea(area.id)
      items.forEach(item => allItemIds.add(item.id))
    })
    
    // Get covered items from all lesson plans
    plans.forEach(plan => {
      plan.itemIds.forEach(itemId => coveredItemIds.add(itemId))
    })
    
    const total = allItemIds.size
    const covered = Array.from(coveredItemIds).filter(id => allItemIds.has(id)).length
    
    return total > 0 ? Math.round((covered / total) * 100) : 0
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

  const togglePlan = (planId: string) => {
    const newExpanded = new Set(expandedPlans)
    if (newExpanded.has(planId)) {
      newExpanded.delete(planId)
    } else {
      newExpanded.add(planId)
    }
    setExpandedPlans(newExpanded)
  }

  const handleDeleteArea = async (area: StudyArea) => {
    if (!window.confirm(`Are you sure you want to delete the study area "${area.name}" and all its items?`)) return
    
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      
      // Delete all items in this area
      const areaItems = getItemsForArea(area.id)
      for (const item of areaItems) {
        await deleteDoc(doc(workspaceRef, 'studyItems', item.id))
      }
      
      // Delete the area
      await deleteDoc(doc(workspaceRef, 'studyAreas', area.id))
      
      // Reload data
      window.location.reload()
    } catch (error) {
      console.error('Error deleting area:', error)
      alert('Failed to delete study area')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this study item?')) return
    
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      await deleteDoc(doc(workspaceRef, 'studyItems', itemId))
      
      // Update local state
      setStudyItems(studyItems.filter(item => item.id !== itemId))
      
      // Update item count in the area
      const item = studyItems.find(i => i.id === itemId)
      if (item) {
        const areas = studyAreas.get(selectedCertificate) || []
        const area = areas.find(a => a.id === item.areaId)
        if (area) {
          const updatedAreas = areas.map(a => 
            a.id === area.id ? { ...a, itemCount: a.itemCount - 1 } : a
          )
          setStudyAreas(new Map(studyAreas).set(selectedCertificate, updatedAreas))
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error)
      alert('Failed to delete study item')
    }
  }

  const handleEditArea = (area: StudyArea) => {
    setEditingArea(area.id)
    setEditingAreaName(area.name)
  }

  const handleSaveArea = async () => {
    if (!editingArea || !editingAreaName.trim()) return
    
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      await updateDoc(doc(workspaceRef, 'studyAreas', editingArea), {
        name: editingAreaName.trim()
      })
      
      // Update local state
      const areas = studyAreas.get(selectedCertificate) || []
      const updatedAreas = areas.map(a => 
        a.id === editingArea ? { ...a, name: editingAreaName.trim() } : a
      )
      setStudyAreas(new Map(studyAreas).set(selectedCertificate, updatedAreas))
      
      setEditingArea(null)
      setEditingAreaName('')
    } catch (error) {
      console.error('Error updating area:', error)
      alert('Failed to update study area')
    }
  }

  const handleEditItem = (item: StudyItem) => {
    setEditingItem(item.id)
    setEditingItemData({
      name: item.name,
      type: item.type,
      description: item.description,
      evaluationCriteria: item.evaluationCriteria,
      acsCodeMappings: item.acsCodeMappings || [],
      referenceMaterials: item.referenceMaterials || []
    })
  }

  const handleSaveItem = async () => {
    if (!editingItem || !editingItemData.name?.trim()) return
    
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      await updateDoc(doc(workspaceRef, 'studyItems', editingItem), {
        name: editingItemData.name.trim(),
        type: editingItemData.type,
        description: editingItemData.description?.trim() || '',
        evaluationCriteria: editingItemData.evaluationCriteria?.trim() || '',
        acsCodeMappings: editingItemData.acsCodeMappings || []
      })
      
      // Update local state
      setStudyItems(studyItems.map(item => 
        item.id === editingItem 
          ? { 
              ...item, 
              name: editingItemData.name!.trim(),
              type: editingItemData.type!,
              description: editingItemData.description?.trim() || '',
              evaluationCriteria: editingItemData.evaluationCriteria?.trim() || '',
              acsCodeMappings: editingItemData.acsCodeMappings || []
            } 
          : item
      ))
      
      setEditingItem(null)
      setEditingItemData({})
    } catch (error) {
      console.error('Error updating item:', error)
      alert('Failed to update study item')
    }
  }

  const handleAddArea = async () => {
    if (!addingAreaFor || !newAreaName.trim()) return
    
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      
      // Get next order number
      const areas = studyAreas.get(addingAreaFor) || []
      const nextOrder = areas.length > 0 ? Math.max(...areas.map(a => a.order)) + 1 : 1
      
      // Add new area
      const newArea = {
        name: newAreaName.trim(),
        certificate: addingAreaFor,
        orderNumber: nextOrder,
        cfiWorkspaceId: workspaceId,
        createdAt: Timestamp.now()
      }
      
      const docRef = await addDoc(collection(workspaceRef, 'studyAreas'), newArea)
      
      // Update local state
      const updatedAreas = [...areas, { 
        id: docRef.id,
        name: newAreaName.trim(),
        certificate: addingAreaFor,
        order: nextOrder,
        itemCount: 0,
        createdAt: Timestamp.now()
      }]
      setStudyAreas(new Map(studyAreas).set(addingAreaFor, updatedAreas))
      
      setAddingAreaFor(null)
      setNewAreaName('')
    } catch (error) {
      console.error('Error adding area:', error)
      alert('Failed to add study area')
    }
  }

  const handleAddItem = async () => {
    if (!addingItemFor || !newItemData.name?.trim()) return
    
    try {
      const workspaceRef = doc(db, 'workspaces', workspaceId)
      
      // Get the current items in this area to determine the order
      const areaItems = getItemsForArea(addingItemFor)
      const nextOrder = areaItems.length
      
      // Add new item
      const newItem = {
        studyAreaId: addingItemFor,
        name: newItemData.name.trim(),
        type: newItemData.type || 'GROUND',
        description: newItemData.description?.trim() || '',
        evaluationCriteria: newItemData.evaluationCriteria?.trim() || '',
        acsCodeMappings: newItemData.acsCodeMappings || [],
        referenceMaterials: newItemData.referenceMaterials || [],
        orderNumber: nextOrder,
        cfiWorkspaceId: workspaceId,
        createdAt: Timestamp.now()
      }
      
      const docRef = await addDoc(collection(workspaceRef, 'studyItems'), newItem)
      
      // Update item count in area
      const areas = studyAreas.get(selectedCertificate) || []
      const area = areas.find(a => a.id === addingItemFor)
      if (area) {
        await updateDoc(doc(workspaceRef, 'studyAreas', addingItemFor), {
          itemCount: area.itemCount + 1
        })
        
        // Update local state
        const updatedAreas = areas.map(a => 
          a.id === addingItemFor ? { ...a, itemCount: a.itemCount + 1 } : a
        )
        setStudyAreas(new Map(studyAreas).set(selectedCertificate, updatedAreas))
      }
      
      // Update local items state
      setStudyItems([...studyItems, { 
        id: docRef.id,
        name: newItemData.name.trim(),
        type: newItemData.type || 'GROUND',
        description: newItemData.description?.trim() || '',
        evaluationCriteria: newItemData.evaluationCriteria?.trim() || '',
        acsCodeMappings: newItemData.acsCodeMappings || [],
        referenceMaterials: newItemData.referenceMaterials || [],
        areaId: addingItemFor,
        order: nextOrder,
        createdAt: Timestamp.now()
      }])
      
      setAddingItemFor(null)
      setNewItemData({
        name: '',
        type: 'GROUND',
        description: '',
        evaluationCriteria: '',
        acsCodeMappings: [],
        referenceMaterials: []
      })
    } catch (error) {
      console.error('Error adding item:', error)
      alert('Failed to add study item')
    }
  }

  const handleDeletePlan = async (planId: string) => {
    if (!window.confirm('Are you sure you want to delete this lesson plan?')) return
    
    try {
      await deleteDoc(doc(db, 'lessonPlans', planId))
      
      // Update local state
      const plans = lessonPlans.get(selectedCertificate) || []
      const updatedPlans = plans.filter(p => p.id !== planId)
      setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
    } catch (error) {
      console.error('Error deleting plan:', error)
      alert('Failed to delete lesson plan')
    }
  }

  const handleEditPlan = (planId: string) => {
    const plans = lessonPlans.get(selectedCertificate) || []
    const updatedPlans = plans.map(p => {
      if (p.id === planId && !p.isEditing) {
        // Initialize selectedItemTypes when entering edit mode
        const selectedItemTypes = new Map<string, Set<'GROUND' | 'FLIGHT'>>()
        p.itemIds.forEach(itemId => {
          const item = studyItems.find(i => i.id === itemId)
          if (item) {
            if (item.type === 'GROUND') {
              selectedItemTypes.set(itemId, new Set(['GROUND']))
            } else if (item.type === 'FLIGHT') {
              selectedItemTypes.set(itemId, new Set(['FLIGHT']))
            } else if (item.type === 'BOTH') {
              selectedItemTypes.set(itemId, new Set(['GROUND', 'FLIGHT']))
            }
          }
        })
        return {
          ...p,
          isEditing: true,
          selectedItemTypes,
          expandedAreas: new Set<string>()
        }
      } else {
        return {
          ...p,
          isEditing: false
        }
      }
    })
    setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
  }

  const handleSavePlan = async (plan: EditingLessonPlan) => {
    try {
      // Convert selectedItemTypes back to itemIds for storage
      const itemIds: string[] = []
      plan.selectedItemTypes?.forEach((types, itemId) => {
        if (types.size > 0) {
          itemIds.push(itemId)
        }
      })
      
      const updateData: any = {
        title: plan.title,
        motivation: plan.motivation,
        objectives: plan.objectives,
        itemIds: itemIds,
        planDescription: plan.planDescription,
        referenceMaterials: plan.referenceMaterials || [],
        preStudyHomework: plan.preStudyHomework,
        estimatedDuration: plan.estimatedDuration,
        updatedAt: Timestamp.now()
      }
      
      await updateDoc(doc(db, 'lessonPlans', plan.id), updateData)
      
      // Update local state
      const plans = lessonPlans.get(selectedCertificate) || []
      const updatedPlans = plans.map(p => 
        p.id === plan.id 
          ? { ...p, ...updateData, isEditing: false, selectedItems: new Set(updateData.itemIds), selectedItemTypes: undefined }
          : p
      )
      setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
    } catch (error) {
      console.error('Error updating plan:', error)
      alert('Failed to update lesson plan')
    }
  }

  const handleCancelEdit = (planId: string) => {
    const plans = lessonPlans.get(selectedCertificate) || []
    const updatedPlans = plans.map(p => ({
      ...p,
      isEditing: false
    }))
    setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
  }

  const updatePlanField = (planId: string, field: keyof LessonPlan, value: any) => {
    const plans = lessonPlans.get(selectedCertificate) || []
    const updatedPlans = plans.map(p => 
      p.id === planId ? { ...p, [field]: value } : p
    )
    setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
  }

  const togglePlanItem = (planId: string, itemId: string, type?: 'GROUND' | 'FLIGHT') => {
    const plans = lessonPlans.get(selectedCertificate) || []
    const plan = plans.find(p => p.id === planId)
    if (!plan) return
    
    const item = studyItems.find(i => i.id === itemId)
    if (!item) return
    
    const newSelectedItems = new Set(plan.selectedItems || [])
    const newSelectedTypes = new Map(plan.selectedItemTypes || new Map())
    
    if (item.type === 'BOTH' && type) {
      // Handle BOTH items with specific type selection
      const currentTypes = newSelectedTypes.get(itemId) || new Set<'GROUND' | 'FLIGHT'>()
      const newTypes = new Set(currentTypes)
      
      if (newTypes.has(type)) {
        newTypes.delete(type)
      } else {
        newTypes.add(type)
      }
      
      if (newTypes.size === 0) {
        newSelectedItems.delete(itemId)
        newSelectedTypes.delete(itemId)
      } else {
        newSelectedItems.add(itemId)
        newSelectedTypes.set(itemId, newTypes)
      }
    } else {
      // Handle single-type items
      if (newSelectedItems.has(itemId)) {
        newSelectedItems.delete(itemId)
        newSelectedTypes.delete(itemId)
      } else {
        newSelectedItems.add(itemId)
        const types = new Set<'GROUND' | 'FLIGHT'>()
        if (item.type === 'GROUND') types.add('GROUND')
        else if (item.type === 'FLIGHT') types.add('FLIGHT')
        else if (item.type === 'BOTH') {
          types.add('GROUND')
          types.add('FLIGHT')
        }
        newSelectedTypes.set(itemId, types)
      }
    }
    
    const updatedPlans = plans.map(p => 
      p.id === planId ? { ...p, selectedItems: newSelectedItems, selectedItemTypes: newSelectedTypes } : p
    )
    setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
  }

  const togglePlanArea = (planId: string, areaId: string) => {
    const plans = lessonPlans.get(selectedCertificate) || []
    const plan = plans.find(p => p.id === planId)
    if (!plan || !plan.expandedAreas) return
    
    const newExpanded = new Set(plan.expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    
    const updatedPlans = plans.map(p => 
      p.id === planId ? { ...p, expandedAreas: newExpanded } : p
    )
    setLessonPlans(new Map(lessonPlans).set(selectedCertificate, updatedPlans))
  }

  // Create context for drag handles
  const DragHandleContext = React.createContext<any>(null)

  // Drag Handle Component
  const DragHandle = ({ className }: { className?: string }) => {
    const context = React.useContext(DragHandleContext)
    if (!context) return <Bars3Icon className="h-4 w-4" />
    
    return (
      <button
        {...context.listeners}
        {...context.attributes}
        className={className || "text-gray-400 hover:text-gray-600 cursor-move"}
        title="Drag to reorder"
      >
        <Bars3Icon className="h-4 w-4" />
      </button>
    )
  }

  // Sortable Area Component
  const SortableArea = ({ area, children }: { area: StudyArea; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: area.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <DragHandleContext.Provider value={{ listeners, attributes }}>
        <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
          {children}
        </div>
      </DragHandleContext.Provider>
    )
  }

  // Sortable Item Component  
  const SortableItem = ({ item, children }: { item: StudyItem; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: item.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <DragHandleContext.Provider value={{ listeners, attributes }}>
        <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
          {children}
        </div>
      </DragHandleContext.Provider>
    )
  }

  // Sortable Plan Component
  const SortablePlan = ({ plan, children }: { plan: EditingLessonPlan; children: React.ReactNode }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: plan.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    return (
      <DragHandleContext.Provider value={{ listeners, attributes }}>
        <div ref={setNodeRef} style={style} className={isDragging ? 'z-50' : ''}>
          {children}
        </div>
      </DragHandleContext.Provider>
    )
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

  const coverage = calculateCoverage()
  const areas = studyAreas.get(selectedCertificate) || []
  const plans = lessonPlans.get(selectedCertificate) || []

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Curriculum Management</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage study items and lesson plans for your training programs
          </p>
        </div>
      </div>


      {/* Certificate Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <div className="flex justify-between items-end">
          <nav className="-mb-px flex space-x-8">
            {(['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'] as Certificate[]).map((cert) => (
              <button
                key={cert}
                onClick={() => setSelectedCertificate(cert)}
                className={`
                  py-2 px-1 border-b-2 font-medium text-sm
                  ${selectedCertificate === cert
                    ? 'border-sky text-sky'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                {getCertificateFullName(cert)}
              </button>
            ))}
          </nav>
          <div className="flex items-center space-x-2 mb-2">
            <button
              onClick={() => setShowImportExport(true)}
              className="px-3 py-1 text-sm text-sky-600 hover:text-sky-700 hover:bg-sky-50 rounded"
            >
              <ArrowsUpDownIcon className="h-4 w-4 inline mr-1" />
              Import/Export
            </button>
            <button
              onClick={async () => {
                if (confirm(`Are you sure you want to delete ALL curriculum items for ${getCertificateFullName(selectedCertificate)}? This action cannot be undone.`)) {
                  try {
                    const { bulkDeleteCurriculum } = await import('@/lib/bulk-operations')
                    const result = await bulkDeleteCurriculum(workspaceId, selectedCertificate, 'all')
                    alert(result.message)
                    // Reload the data
                    loadStudyData()
                  } catch (error: any) {
                    alert(`Error deleting curriculum: ${error.message}`)
                  }
                }
              }}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
            >
              <TrashIcon className="h-4 w-4 inline mr-1" />
              Delete All
            </button>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Study Items */}
        <div>
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Study Items</h3>
              
              {/* Coverage Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Syllabus Coverage</span>
                  <span className="text-sm font-medium text-gray-900">{coverage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-sky to-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${coverage}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {plans.flatMap(p => p.itemIds).filter((id, i, arr) => arr.indexOf(id) === i).length} of {studyItems.filter(item => areas.some(a => a.id === item.areaId)).length} items included in syllabus
                </p>
              </div>
            </div>

            <SortableContext
              items={areas.map(a => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-gray-200">
                {areas.map(area => {
                const areaItems = getItemsForArea(area.id)
                const isExpanded = expandedAreas.has(area.id)
                const isEditingArea = editingArea === area.id

                return (
                  <SortableArea key={area.id} area={area}>
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleArea(area.id)}
                          className="flex-1 flex items-center text-left"
                        >
                        {isExpanded ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400 mr-2" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2" />
                        )}
                        {isEditingArea ? (
                          <input
                            type="text"
                            value={editingAreaName}
                            onChange={(e) => setEditingAreaName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        ) : (
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{area.name}</h4>
                            <div className="flex items-center space-x-2">
                              <p className="text-xs text-gray-500">{areaItems.length} items</p>
                              {(() => {
                                const coveredItems = areaItems.filter(item => 
                                  plans.some(plan => plan.itemIds.includes(item.id))
                                ).length
                                if (coveredItems > 0) {
                                  return (
                                    <span className="text-xs text-green-600">
                                      • {coveredItems}/{areaItems.length} covered
                                    </span>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          </div>
                        )}
                      </button>
                      <div className="flex items-center space-x-2 ml-4">
                        {isEditingArea ? (
                          <>
                            <button
                              onClick={handleSaveArea}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingArea(null)
                                setEditingAreaName('')
                              }}
                              className="text-gray-400 hover:text-gray-500"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <DragHandle />
                            <button
                              onClick={() => setAddingItemFor(area.id)}
                              className="text-sky hover:text-sky-600"
                              title="Add item"
                            >
                              <PlusIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleEditArea(area)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Edit area"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteArea(area)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete area"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Add item form */}
                    {addingItemFor === area.id && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Item name"
                            value={newItemData.name}
                            onChange={(e) => setNewItemData({ ...newItemData, name: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                          />
                          <select
                            value={newItemData.type}
                            onChange={(e) => setNewItemData({ ...newItemData, type: e.target.value as any })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                          >
                            <option value="GROUND">Ground</option>
                            <option value="FLIGHT">Flight</option>
                            <option value="BOTH">Both</option>
                          </select>
                          <textarea
                            placeholder="Description"
                            value={newItemData.description}
                            onChange={(e) => setNewItemData({ ...newItemData, description: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                            rows={2}
                          />
                          <textarea
                            placeholder="Evaluation Criteria (How will proficiency be measured?)"
                            value={newItemData.evaluationCriteria}
                            onChange={(e) => setNewItemData({ ...newItemData, evaluationCriteria: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                            rows={2}
                          />
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              ACS Code Mappings
                            </label>
                            <input
                              type="text"
                              placeholder="Enter ACS codes separated by commas (e.g., PA.I.A, PA.I.B)"
                              value={newItemData.acsCodeMappings?.join(', ')}
                              onChange={(e) => {
                                const codes = e.target.value
                                  .split(',')
                                  .map(code => code.trim())
                                  .filter(code => code.length > 0)
                                setNewItemData({ ...newItemData, acsCodeMappings: codes })
                              }}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded"
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => {
                                setAddingItemFor(null)
                                setNewItemData({
                                  name: '',
                                  type: 'GROUND',
                                  description: '',
                                  evaluationCriteria: '',
                                  acsCodeMappings: [],
                                  referenceMaterials: []
                                })
                              }}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddItem}
                              className="px-3 py-1 text-sm text-white bg-sky rounded hover:bg-sky-600"
                            >
                              Add Item
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {isExpanded && (
                      <SortableContext
                        items={areaItems.map(i => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="mt-3 space-y-2">
                          {areaItems.map(item => {
                            const isEditingItem = editingItem === item.id

                            return (
                              <SortableItem key={item.id} item={item}>
                                <div className="flex items-start justify-between p-2 bg-gray-50 rounded">
                              {isEditingItem ? (
                                <div className="flex-1 space-y-2">
                                  <input
                                    type="text"
                                    value={editingItemData.name}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, name: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                  />
                                  <select
                                    value={editingItemData.type}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, type: e.target.value as any })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                  >
                                    <option value="GROUND">Ground</option>
                                    <option value="FLIGHT">Flight</option>
                                    <option value="BOTH">Both</option>
                                  </select>
                                  <textarea
                                    value={editingItemData.description}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, description: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                    rows={2}
                                  />
                                  <textarea
                                    placeholder="Evaluation Criteria"
                                    value={editingItemData.evaluationCriteria || ''}
                                    onChange={(e) => setEditingItemData({ ...editingItemData, evaluationCriteria: e.target.value })}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                    rows={2}
                                  />
                                  <input
                                    type="text"
                                    placeholder="ACS codes (comma separated)"
                                    value={editingItemData.acsCodeMappings?.join(', ') || ''}
                                    onChange={(e) => {
                                      const codes = e.target.value
                                        .split(',')
                                        .map(code => code.trim())
                                        .filter(code => code.length > 0)
                                      setEditingItemData({ ...editingItemData, acsCodeMappings: codes })
                                    }}
                                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                  />
                                </div>
                              ) : (
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                                  {item.evaluationCriteria && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      <span className="font-medium">Evaluation:</span> {item.evaluationCriteria}
                                    </p>
                                  )}
                                  {item.acsCodeMappings && item.acsCodeMappings.length > 0 && (
                                    <p className="text-xs text-gray-600 mt-1">
                                      <span className="font-medium">ACS:</span> {item.acsCodeMappings.join(', ')}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {(item.type === 'GROUND' || item.type === 'BOTH') && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                        Ground
                                      </span>
                                    )}
                                    {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        Flight
                                      </span>
                                    )}
                                    {plans
                                      .filter(plan => plan.itemIds.includes(item.id))
                                      .map(plan => (
                                        <span 
                                          key={plan.id}
                                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                                        >
                                          Lesson {plan.orderNumber}
                                        </span>
                                      ))
                                    }
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center space-x-2 ml-4">
                                {isEditingItem ? (
                                  <>
                                    <button
                                      onClick={handleSaveItem}
                                      className="text-green-600 hover:text-green-700"
                                    >
                                      <CheckIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingItem(null)
                                        setEditingItemData({})
                                      }}
                                      className="text-gray-400 hover:text-gray-500"
                                    >
                                      <XMarkIcon className="h-4 w-4" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <DragHandle />
                                    <button
                                      onClick={() => handleEditItem(item)}
                                      className="text-gray-400 hover:text-gray-500"
                                    >
                                      <PencilIcon className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteItem(item.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                                </div>
                              </SortableItem>
                            )
                          })}
                        </div>
                      </SortableContext>
                    )}
                    </div>
                  </SortableArea>
                )
              })}
              </div>
            </SortableContext>

              {/* Add area button */}
              {!addingAreaFor && (
                <div className="p-4">
                  <button
                    onClick={() => setAddingAreaFor(selectedCertificate)}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Study Area
                  </button>
                </div>
              )}

              {/* Add area form */}
              {addingAreaFor === selectedCertificate && (
                <div className="p-4 bg-gray-50">
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Study area name"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded"
                    />
                    <button
                      onClick={handleAddArea}
                      className="px-3 py-2 text-sm text-white bg-sky rounded hover:bg-sky-600"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => {
                        setAddingAreaFor(null)
                        setNewAreaName('')
                      }}
                      className="px-3 py-2 text-sm text-gray-600 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>
        
        {/* Right Column: Syllabus */}
        <div>
          <div className="bg-white shadow rounded-lg">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Syllabus</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {plans.length} lesson plans in sequence
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/cfi/curriculum/${selectedCertificate.toLowerCase()}/new`)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-sky hover:bg-sky-600"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Plan
                </button>
              </div>
            </div>

            <SortableContext
              items={plans.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y divide-gray-200">
                {plans.map((plan) => {
                  const isExpanded = expandedPlans.has(plan.id)
                const isEditing = plan.isEditing || false
                const planItems = studyItems.filter(item => plan.itemIds.includes(item.id))

                return (
                  <SortablePlan key={plan.id} plan={plan}>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start flex-1">
                          {!isEditing && <DragHandle className="mt-1 mr-2" />}
                          <button
                            onClick={() => togglePlan(plan.id)}
                            className="flex-1 flex items-start text-left"
                          >
                            {isExpanded ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-400 mr-2 mt-0.5" />
                            )}
                            <div className="flex-1">
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={plan.title}
                                  onChange={(e) => updatePlanField(plan.id, 'title', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 text-sm font-medium border border-gray-300 rounded"
                                />
                              ) : (
                                <>
                                  <p className="text-sm font-medium text-gray-900">
                                    Lesson {plan.orderNumber}: {plan.title}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {planItems.length} study items • Est. {plan.estimatedDuration.ground}min ground, {plan.estimatedDuration.flight}hr flight
                                  </p>
                                </>
                              )}
                            </div>
                          </button>
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                          {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSavePlan(plan)}
                              className="text-green-600 hover:text-green-700"
                              title="Save"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleCancelEdit(plan.id)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Cancel"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEditPlan(plan.id)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Edit"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan.id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3">
                        {isEditing ? (
                          <>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Motivation
                              </label>
                              <textarea
                                value={plan.motivation}
                                onChange={(e) => updatePlanField(plan.id, 'motivation', e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Objectives (one per line)
                              </label>
                              <textarea
                                value={plan.objectives?.join('\n') || ''}
                                onChange={(e) => updatePlanField(plan.id, 'objectives', e.target.value.split('\n').filter(o => o.trim()))}
                                rows={3}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Plan Description
                              </label>
                              <textarea
                                value={plan.planDescription}
                                onChange={(e) => updatePlanField(plan.id, 'planDescription', e.target.value)}
                                rows={3}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Pre-Study Homework
                              </label>
                              <textarea
                                value={plan.preStudyHomework}
                                onChange={(e) => updatePlanField(plan.id, 'preStudyHomework', e.target.value)}
                                rows={2}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Ground Duration (minutes)
                                </label>
                                <input
                                  type="number"
                                  value={plan.estimatedDuration.ground}
                                  onChange={(e) => updatePlanField(plan.id, 'estimatedDuration', { 
                                    ...plan.estimatedDuration, 
                                    ground: parseInt(e.target.value) || 0 
                                  })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Flight Duration (hours)
                                </label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={plan.estimatedDuration.flight}
                                  onChange={(e) => updatePlanField(plan.id, 'estimatedDuration', { 
                                    ...plan.estimatedDuration, 
                                    flight: parseFloat(e.target.value) || 0 
                                  })}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-2">
                                Study Items
                              </label>
                              <div className="space-y-2">
                                {areas.map(area => {
                                  const areaItems = getItemsForArea(area.id)
                                  if (areaItems.length === 0) return null
                                  
                                  const isAreaExpanded = plan.expandedAreas?.has(area.id)

                                  return (
                                    <div key={area.id} className="border border-gray-200 rounded">
                                      <button
                                        type="button"
                                        onClick={() => togglePlanArea(plan.id, area.id)}
                                        className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-gray-50"
                                      >
                                        <div className="flex items-center space-x-2">
                                          <span className="text-sm font-medium text-gray-700">{area.name}</span>
                                          {(() => {
                                            const selectedCount = areaItems.filter(item => {
                                              const types = plan.selectedItemTypes?.get(item.id)
                                              return types && types.size > 0
                                            }).length
                                            if (selectedCount > 0) {
                                              return (
                                                <span className="text-xs text-gray-500">
                                                  ({selectedCount}/{areaItems.length} selected)
                                                </span>
                                              )
                                            }
                                            return null
                                          })()}
                                        </div>
                                        {isAreaExpanded ? (
                                          <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                                        ) : (
                                          <ChevronRightIcon className="h-4 w-4 text-gray-400" />
                                        )}
                                      </button>
                                      {isAreaExpanded && (
                                        <div className="px-3 py-2 space-y-2 border-t border-gray-200">
                                          {areaItems.map(item => {
                                            const itemTypes = plan.selectedItemTypes?.get(item.id) || new Set()
                                            const isGroundSelected = itemTypes.has('GROUND')
                                            const isFlightSelected = itemTypes.has('FLIGHT')
                                            
                                            return (
                                              <div key={item.id} className="space-y-1">
                                                <div className="text-sm text-gray-600">{item.name}</div>
                                                <div className="flex gap-3 ml-4">
                                                  {(item.type === 'GROUND' || item.type === 'BOTH') && (
                                                    <label className="flex items-center cursor-pointer">
                                                      <input
                                                        type="checkbox"
                                                        checked={isGroundSelected}
                                                        onChange={() => togglePlanItem(plan.id, item.id, item.type === 'BOTH' ? 'GROUND' : undefined)}
                                                        className="h-3.5 w-3.5 text-sky border-gray-300 rounded"
                                                      />
                                                      <span className="ml-1.5 text-xs text-gray-700">Ground</span>
                                                    </label>
                                                  )}
                                                  {(item.type === 'FLIGHT' || item.type === 'BOTH') && (
                                                    <label className="flex items-center cursor-pointer">
                                                      <input
                                                        type="checkbox"
                                                        checked={isFlightSelected}
                                                        onChange={() => togglePlanItem(plan.id, item.id, item.type === 'BOTH' ? 'FLIGHT' : undefined)}
                                                        className="h-3.5 w-3.5 text-sky border-gray-300 rounded"
                                                      />
                                                      <span className="ml-1.5 text-xs text-gray-700">Flight</span>
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
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Reference Materials
                              </label>
                              <div className="space-y-1">
                                {(plan.referenceMaterials || []).map((material, index) => (
                                  <div key={index} className="p-1.5 bg-gray-50 rounded text-xs">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-1 flex-1">
                                        {material.type === 'link' ? (
                                          <LinkIcon className="h-3 w-3 text-gray-400" />
                                        ) : (
                                          <DocumentIcon className="h-3 w-3 text-gray-400" />
                                        )}
                                        <span className="text-gray-700">{material.name}</span>
                                      </div>
                                      <button
                                      type="button"
                                      onClick={() => {
                                        const updatedMaterials = [...(plan.referenceMaterials || [])]
                                        updatedMaterials.splice(index, 1)
                                        updatePlanField(plan.id, 'referenceMaterials', updatedMaterials)
                                      }}
                                      className="text-red-500 hover:text-red-700"
                                    >
                                      <TrashIcon className="h-3 w-3" />
                                    </button>
                                    </div>
                                    {material.note && (
                                      <p className="text-xs text-gray-500 mt-1 ml-4">{material.note}</p>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => navigate(`/cfi/curriculum/${selectedCertificate.toLowerCase()}/${plan.id}`)}
                                  className="text-xs text-sky hover:text-sky-600"
                                >
                                  Edit reference materials in full view →
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
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
                          </>
                        )}
                      </div>
                    )}
                    </div>
                  </SortablePlan>
                )
              })}
              </div>
            </SortableContext>

            {plans.length === 0 && (
                <div className="p-8 text-center">
                  <ClipboardDocumentListIcon className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No lesson plans yet</p>
                  <button
                    onClick={() => navigate(`/cfi/curriculum/${selectedCertificate.toLowerCase()}/new`)}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-sky hover:bg-sky-600"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Create First Lesson Plan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeId ? (
          <div className="bg-white shadow-lg rounded p-2 opacity-90">
            {areas.find(a => a.id === activeId)?.name || 
             studyItems.find(i => i.id === activeId)?.name ||
             plans.find(p => p.id === activeId)?.title}
          </div>
        ) : null}
      </DragOverlay>
      
      {/* Import/Export Modal */}
      <ImportExportModal
        isOpen={showImportExport}
        onClose={() => setShowImportExport(false)}
        certificate={selectedCertificate}
        onImportSuccess={loadStudyData}
      />
    </DndContext>
  )
}