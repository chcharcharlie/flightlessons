import React, { useState, useRef, useEffect } from 'react'
import { ReferenceMaterial } from '@/types'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  XMarkIcon,
  LinkIcon,
  DocumentIcon,
  CloudArrowUpIcon,
} from '@heroicons/react/24/outline'

interface ReferenceMaterialModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (material: ReferenceMaterial) => void
  initialMaterial?: ReferenceMaterial
  existingFiles?: { id: string; name: string; url: string }[]
  workspaceId: string
}

export const ReferenceMaterialModal: React.FC<ReferenceMaterialModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMaterial,
  existingFiles = [],
  workspaceId,
}) => {
  const [type, setType] = useState<'link' | 'file'>(initialMaterial?.type || 'link')
  const [name, setName] = useState(initialMaterial?.name || '')
  const [url, setUrl] = useState(initialMaterial?.url || '')
  const [note, setNote] = useState(initialMaterial?.note || '')
  const [fileId, setFileId] = useState(initialMaterial?.fileId || '')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedExistingFile, setSelectedExistingFile] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Update state when initialMaterial changes (when editing different materials)
  useEffect(() => {
    if (isOpen && initialMaterial) {
      setType(initialMaterial.type || 'link')
      setName(initialMaterial.name || '')
      setUrl(initialMaterial.url || '')
      setNote(initialMaterial.note || '')
      setFileId(initialMaterial.fileId || '')
      // If it's a file, try to find it in existing files
      if (initialMaterial.type === 'file' && initialMaterial.fileId) {
        setSelectedExistingFile(initialMaterial.fileId)
      }
    } else if (isOpen && !initialMaterial) {
      // Reset form when adding new material
      setType('link')
      setName('')
      setUrl('')
      setNote('')
      setFileId('')
      setSelectedExistingFile('')
    }
  }, [isOpen, initialMaterial])

  if (!isOpen) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Create a unique file name
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name}`
      const storageRef = ref(storage, `workspaces/${workspaceId}/materials/${fileName}`)
      
      // Upload file
      const snapshot = await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(snapshot.ref)
      
      setUrl(downloadUrl)
      setName(file.name)
      setFileId(fileName)
      setUploadProgress(100)
    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleSelectExistingFile = (fileData: { id: string; name: string; url: string }) => {
    setUrl(fileData.url)
    setName(fileData.name)
    setFileId(fileData.id)
    setSelectedExistingFile(fileData.id)
  }

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a name for the reference material')
      return
    }
    
    if (!url.trim() && type === 'link') {
      alert('Please enter a URL')
      return
    }
    
    if (!url.trim() && type === 'file') {
      alert('Please upload a file or select an existing one')
      return
    }

    const material: ReferenceMaterial = {
      type,
      name: name.trim(),
      url: url.trim(),
    }
    
    // Only add optional fields if they have values
    if (note.trim()) {
      material.note = note.trim()
    }
    
    if (type === 'file' && fileId) {
      material.fileId = fileId
    }
    
    onSave(material)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            {initialMaterial ? 'Edit' : 'Add'} Reference Material
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="link"
                  checked={type === 'link'}
                  onChange={(e) => setType(e.target.value as 'link')}
                  className="mr-2"
                />
                <LinkIcon className="h-5 w-5 mr-1 text-gray-400" />
                <span className="text-sm">Web Link</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="file"
                  checked={type === 'file'}
                  onChange={(e) => setType(e.target.value as 'file')}
                  className="mr-2"
                />
                <DocumentIcon className="h-5 w-5 mr-1 text-gray-400" />
                <span className="text-sm">File Upload</span>
              </label>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <label htmlFor="material-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="material-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AIM Chapter 4"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
            />
          </div>

          {/* URL/File Input */}
          {type === 'link' ? (
            <div>
              <label htmlFor="material-url" className="block text-sm font-medium text-gray-700">
                URL
              </label>
              <input
                type="url"
                id="material-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/resource"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File
              </label>
              
              {/* Existing files dropdown */}
              {existingFiles.length > 0 && (
                <div className="mb-3">
                  <select
                    value={selectedExistingFile}
                    onChange={(e) => {
                      const file = existingFiles.find(f => f.id === e.target.value)
                      if (file) handleSelectExistingFile(file)
                    }}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
                  >
                    <option value="">Select existing file...</option>
                    {existingFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">Or upload a new file:</p>
                </div>
              )}

              {/* File upload */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                {uploading ? (
                  <>Uploading... {uploadProgress}%</>
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                    {url ? 'Replace File' : 'Upload File'}
                  </>
                )}
              </button>
              {url && !uploading && (
                <p className="mt-2 text-sm text-green-600">
                  File uploaded: {name}
                </p>
              )}
            </div>
          )}

          {/* Note Input */}
          <div>
            <label htmlFor="material-note" className="block text-sm font-medium text-gray-700">
              Note (optional)
            </label>
            <textarea
              id="material-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Read pages 4-15 to 4-20, focus on weather minimums"
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-sky focus:ring-sky sm:text-sm"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky hover:bg-sky-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}