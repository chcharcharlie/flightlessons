import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  increment,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { StudyArea, StudyItem } from '@/types'

export const useStudyItems = () => {
  const { user } = useAuth()
  const [areas, setAreas] = useState<StudyArea[]>([])
  const [items, setItems] = useState<StudyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.cfiWorkspaceId) {
      setLoading(false)
      return
    }

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)

    // Subscribe to study areas
    const areasRef = collection(workspaceRef, 'studyAreas')
    const areasQuery = query(areasRef, orderBy('order', 'asc'))
    
    const unsubscribeAreas = onSnapshot(
      areasQuery,
      (snapshot) => {
        const areasData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyArea))
        setAreas(areasData)
      },
      (error) => {
        console.error('Error fetching areas:', error)
        setError(error.message)
      }
    )

    // Subscribe to study items
    const itemsRef = collection(workspaceRef, 'studyItems')
    const itemsQuery = query(itemsRef, orderBy('createdAt', 'desc'))
    
    const unsubscribeItems = onSnapshot(
      itemsQuery,
      (snapshot) => {
        const itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as StudyItem))
        setItems(itemsData)
        setLoading(false)
      },
      (error) => {
        console.error('Error fetching items:', error)
        setError(error.message)
        setLoading(false)
      }
    )

    return () => {
      unsubscribeAreas()
      unsubscribeItems()
    }
  }, [user?.cfiWorkspaceId])

  const createArea = async (name: string, certificate: string) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const areasRef = collection(workspaceRef, 'studyAreas')
    
    // Get the highest order number for this certificate
    const areasSnapshot = await getDocs(areasRef)
    const maxOrder = areasSnapshot.docs
      .filter(doc => doc.data().certificate === certificate)
      .reduce((max, doc) => {
        const order = doc.data().order || 0
        return order > max ? order : max
      }, 0)

    await addDoc(areasRef, {
      name,
      certificate,
      order: maxOrder + 1,
      itemCount: 0,
      createdAt: serverTimestamp(),
    })
  }

  const createItem = async (areaId: string, data: Omit<StudyItem, 'id' | 'createdAt' | 'areaId'>) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const itemsRef = collection(workspaceRef, 'studyItems')
    
    // Add the item
    await addDoc(itemsRef, {
      ...data,
      areaId,
      createdAt: serverTimestamp(),
    })

    // Update area item count
    const areaRef = doc(workspaceRef, 'studyAreas', areaId)
    await updateDoc(areaRef, {
      itemCount: increment(1)
    })
  }

  const updateItem = async (itemId: string, data: Partial<StudyItem>) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const itemRef = doc(workspaceRef, 'studyItems', itemId)
    
    await updateDoc(itemRef, data)
  }

  const deleteItem = async (itemId: string) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const itemRef = doc(workspaceRef, 'studyItems', itemId)
    
    // Get the item to find its areaId
    const item = items.find(i => i.id === itemId)
    if (item) {
      // Delete the item
      await deleteDoc(itemRef)
      
      // Update area item count
      const areaRef = doc(workspaceRef, 'studyAreas', item.areaId)
      await updateDoc(areaRef, {
        itemCount: increment(-1)
      })
    }
  }

  const updateArea = async (areaId: string, data: Partial<StudyArea>) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const areaRef = doc(workspaceRef, 'studyAreas', areaId)
    
    await updateDoc(areaRef, data)
  }

  const deleteArea = async (areaId: string) => {
    if (!user?.cfiWorkspaceId) throw new Error('No workspace ID')

    // Check if area has items
    const areaItems = items.filter(item => item.areaId === areaId)
    if (areaItems.length > 0) {
      throw new Error('Cannot delete area with items. Delete all items first.')
    }

    const workspaceRef = doc(db, 'workspaces', user.cfiWorkspaceId)
    const areaRef = doc(workspaceRef, 'studyAreas', areaId)
    
    await deleteDoc(areaRef)
  }

  return {
    areas,
    items,
    loading,
    error,
    createArea,
    createItem,
    updateItem,
    deleteItem,
    updateArea,
    deleteArea,
  }
}