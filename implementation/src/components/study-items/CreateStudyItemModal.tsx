import React, { useState } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { StudyItem, StudyItemType, ReferenceMaterial } from '@/types'

interface CreateStudyItemModalProps {
  areaId: string
  item?: StudyItem
  onClose: () => void
  onCreate: (data: Omit<StudyItem, 'id' | 'createdAt'>) => Promise<void>
}

export const CreateStudyItemModal: React.FC<CreateStudyItemModalProps> = ({
  areaId,
  item,
  onClose,
  onCreate,
}) => {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    type: item?.type || 'GROUND' as StudyItemType,
    description: item?.description || '',
    evaluationCriteria: item?.evaluationCriteria || '',
    acsCodeMappings: item?.acsCodeMappings || [] as string[],
    referenceMaterials: item?.referenceMaterials || [] as ReferenceMaterial[],
  })
  const [newAcsCode, setNewAcsCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Name is required')
      return
    }

    if (!formData.description.trim()) {
      setError('Description is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      await onCreate({
        areaId,
        name: formData.name.trim(),
        type: formData.type,
        description: formData.description.trim(),
        evaluationCriteria: formData.evaluationCriteria.trim(),
        acsCodeMappings: formData.acsCodeMappings,
        referenceMaterials: formData.referenceMaterials,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save item')
      setLoading(false)
    }
  }

  const addAcsCode = () => {
    if (newAcsCode.trim() && !formData.acsCodeMappings.includes(newAcsCode.trim())) {
      setFormData({
        ...formData,
        acsCodeMappings: [...formData.acsCodeMappings, newAcsCode.trim()],
      })
      setNewAcsCode('')
    }
  }

  const removeAcsCode = (code: string) => {
    setFormData({
      ...formData,
      acsCodeMappings: formData.acsCodeMappings.filter(c => c !== code),
    })
  }

  const addReferenceMaterial = () => {
    setFormData({
      ...formData,
      referenceMaterials: [
        ...formData.referenceMaterials,
        { type: 'link', name: '', url: '' },
      ],
    })
  }

  const updateReferenceMaterial = (index: number, field: string, value: string) => {
    const materials = [...formData.referenceMaterials]
    materials[index] = { ...materials[index], [field]: value }
    setFormData({ ...formData, referenceMaterials: materials })
  }

  const removeReferenceMaterial = (index: number) => {
    setFormData({
      ...formData,
      referenceMaterials: formData.referenceMaterials.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {item ? 'Edit Study Item' : 'Create Study Item'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="e.g., Lift and Drag"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as StudyItemType })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              >
                <option value="GROUND">Ground</option>
                <option value="FLIGHT">Flight</option>
                <option value="BOTH">Both</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="Describe what the student will learn..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evaluation Criteria
              </label>
              <textarea
                value={formData.evaluationCriteria}
                onChange={(e) => setFormData({ ...formData, evaluationCriteria: e.target.value })}
                rows={3}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                placeholder="How will you evaluate mastery of this item?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ACS Code Mappings
              </label>
              <div className="flex items-center space-x-2 mb-2">
                <input
                  type="text"
                  value={newAcsCode}
                  onChange={(e) => setNewAcsCode(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAcsCode())}
                  className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  placeholder="e.g., PA.I.A.K1"
                />
                <button
                  type="button"
                  onClick={addAcsCode}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.acsCodeMappings.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800"
                  >
                    {code}
                    <button
                      type="button"
                      onClick={() => removeAcsCode(code)}
                      className="ml-1.5 text-sky-600 hover:text-sky-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Reference Materials
                </label>
                <button
                  type="button"
                  onClick={addReferenceMaterial}
                  className="inline-flex items-center text-sm text-sky hover:text-sky-600"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Material
                </button>
              </div>
              <div className="space-y-2">
                {formData.referenceMaterials.map((material, index) => (
                  <div key={index} className="flex items-start space-x-2">
                    <input
                      type="text"
                      value={material.name}
                      onChange={(e) => updateReferenceMaterial(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    />
                    <input
                      type="text"
                      value={material.url}
                      onChange={(e) => updateReferenceMaterial(index, 'url', e.target.value)}
                      placeholder="URL"
                      className="block flex-1 rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeReferenceMaterial(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600">{error}</p>
          )}

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky disabled:opacity-50"
            >
              {loading ? 'Saving...' : item ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}