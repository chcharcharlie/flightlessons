import React, { useState } from 'react'
import {
  PlusIcon,
  ChevronRightIcon,
  BookOpenIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline'
import { useStudyItems } from '@/hooks/useStudyItems'
import { StudyArea, StudyItem, Certificate } from '@/types'
import { CreateStudyAreaModal } from '@/components/study-items/CreateStudyAreaModal'
import { CreateStudyItemModal } from '@/components/study-items/CreateStudyItemModal'
import { StudyItemDetail } from '@/components/study-items/StudyItemDetail'

const CERTIFICATES: { value: Certificate; label: string; description: string }[] = [
  { value: 'PRIVATE', label: 'Private Pilot', description: 'PPL' },
  { value: 'INSTRUMENT', label: 'Instrument Rating', description: 'IR' },
  { value: 'COMMERCIAL', label: 'Commercial Pilot', description: 'CPL' },
]

export const StudyItems: React.FC = () => {
  const { areas, items, loading, createArea, createItem, updateItem, deleteItem } = useStudyItems()
  
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate>('PRIVATE')
  const [selectedArea, setSelectedArea] = useState<StudyArea | null>(null)
  const [selectedItem, setSelectedItem] = useState<StudyItem | null>(null)
  const [showCreateAreaModal, setShowCreateAreaModal] = useState(false)
  const [showCreateItemModal, setShowCreateItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<StudyItem | null>(null)

  const handleCreateArea = async (data: { name: string; certificate: Certificate }) => {
    await createArea(data.name, data.certificate)
    setShowCreateAreaModal(false)
  }

  const handleCreateItem = async (data: Omit<StudyItem, 'id' | 'createdAt'>) => {
    if (selectedArea) {
      await createItem(selectedArea.id, data)
      setShowCreateItemModal(false)
    }
  }

  const handleUpdateItem = async (itemId: string, data: Partial<StudyItem>) => {
    await updateItem(itemId, data)
    setEditingItem(null)
  }

  const handleDeleteItem = async (itemId: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      await deleteItem(itemId)
      setSelectedItem(null)
    }
  }

  // When certificate changes, clear selected area if it doesn't match
  React.useEffect(() => {
    if (selectedArea && selectedArea.certificate !== selectedCertificate) {
      setSelectedArea(null)
    }
  }, [selectedCertificate, selectedArea])

  // Filter areas by selected certificate
  const certificateAreas = areas.filter(area => area.certificate === selectedCertificate)

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
          <h2 className="text-2xl font-bold text-gray-900">Study Items</h2>
          <p className="mt-2 text-sm text-gray-700">
            Manage your ground and flight training items organized by certificate and area.
          </p>
        </div>
      </div>

      {/* Certificate Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {CERTIFICATES.map((cert) => (
            <button
              key={cert.value}
              onClick={() => setSelectedCertificate(cert.value)}
              className={`
                whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm
                ${selectedCertificate === cert.value
                  ? 'border-sky text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {cert.label}
              <span className="ml-2 text-gray-400">({cert.description})</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-8 flex gap-6">
        {/* Areas sidebar */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Study Areas</h3>
                <button
                  onClick={() => setShowCreateAreaModal(true)}
                  className="inline-flex items-center justify-center rounded-md border border-transparent bg-sky px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                {certificateAreas.map((area) => {
                  const areaItems = items.filter(item => item.areaId === area.id)
                  const isSelected = selectedArea?.id === area.id
                  
                  return (
                    <button
                      key={area.id}
                      onClick={() => setSelectedArea(area)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-sky-50 text-sky-700 border-sky'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{area.name}</div>
                          <div className="text-sm text-gray-500">
                            {areaItems.length} items
                          </div>
                        </div>
                        <ChevronRightIcon className={`h-5 w-5 ${
                          isSelected ? 'text-sky-600' : 'text-gray-400'
                        }`} />
                      </div>
                    </button>
                  )
                })}
              </div>

              {certificateAreas.length === 0 && (
                <div className="text-center py-6 text-gray-500">
                  <BookOpenIcon className="mx-auto h-12 w-12 text-gray-300" />
                  <p className="mt-2 text-sm">No areas yet</p>
                  <p className="mt-1 text-sm">Create your first study area to get started</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-1">
          {selectedArea ? (
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="sm:flex sm:items-center sm:justify-between mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {selectedArea.name} Items
                  </h3>
                  <button
                    onClick={() => setShowCreateItemModal(true)}
                    className="mt-3 sm:mt-0 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2"
                  >
                    <PlusIcon className="h-4 w-4 mr-2" />
                    Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {items
                    .filter(item => item.areaId === selectedArea.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="block hover:bg-gray-50 cursor-pointer p-4 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center">
                              <h4 className="text-base font-medium text-gray-900">
                                {item.name}
                              </h4>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                item.type === 'GROUND'
                                  ? 'bg-blue-100 text-blue-800'
                                  : item.type === 'FLIGHT'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-purple-100 text-purple-800'
                              }`}>
                                {item.type}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                              {item.description}
                            </p>
                            {item.acsCodeMappings.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {item.acsCodeMappings.map((code) => (
                                  <span
                                    key={code}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                                  >
                                    {code}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 flex items-center space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingItem(item)
                              }}
                              className="text-gray-400 hover:text-gray-500"
                            >
                              <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteItem(item.id)
                              }}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>

                {items.filter(item => item.areaId === selectedArea.id).length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <p className="text-sm">No items in this area yet</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg h-full flex items-center justify-center">
              <div className="text-center">
                <BookOpenIcon className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">Select an area to view items</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreateAreaModal && (
        <CreateStudyAreaModal
          certificate={selectedCertificate}
          onClose={() => setShowCreateAreaModal(false)}
          onCreate={handleCreateArea}
        />
      )}

      {showCreateItemModal && selectedArea && (
        <CreateStudyItemModal
          areaId={selectedArea.id}
          onClose={() => setShowCreateItemModal(false)}
          onCreate={handleCreateItem}
        />
      )}

      {selectedItem && (
        <StudyItemDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={(item) => setEditingItem(item)}
          onDelete={handleDeleteItem}
        />
      )}

      {editingItem && (
        <CreateStudyItemModal
          areaId={editingItem.areaId}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onCreate={(data) => handleUpdateItem(editingItem.id, data)}
        />
      )}
      
    </div>
  )
}