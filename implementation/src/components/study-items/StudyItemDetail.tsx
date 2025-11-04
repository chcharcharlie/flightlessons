import React from 'react'
import { XMarkIcon, PencilSquareIcon, TrashIcon, LinkIcon } from '@heroicons/react/24/outline'
import { StudyItem } from '@/types'

interface StudyItemDetailProps {
  item: StudyItem
  onClose: () => void
  onEdit: (item: StudyItem) => void
  onDelete: (itemId: string) => void
}

export const StudyItemDetail: React.FC<StudyItemDetailProps> = ({
  item,
  onClose,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
            <span className={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              item.type === 'GROUND'
                ? 'bg-blue-100 text-blue-800'
                : item.type === 'FLIGHT'
                ? 'bg-green-100 text-green-800'
                : 'bg-purple-100 text-purple-800'
            }`}>
              {item.type}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(item)}
              className="text-gray-400 hover:text-gray-500"
            >
              <PencilSquareIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="text-gray-400 hover:text-red-500"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">Description</h4>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.description}</p>
          </div>

          {item.evaluationCriteria && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">Evaluation Criteria</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{item.evaluationCriteria}</p>
            </div>
          )}

          {item.acsCodeMappings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">ACS Code Mappings</h4>
              <div className="flex flex-wrap gap-2">
                {item.acsCodeMappings.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.referenceMaterials.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-1">Reference Materials</h4>
              <ul className="space-y-2">
                {item.referenceMaterials.map((material, index) => (
                  <li key={index} className="flex items-center text-sm">
                    <LinkIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                    {material.url ? (
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky hover:text-sky-600 underline"
                      >
                        {material.name || material.url}
                      </a>
                    ) : (
                      <span className="text-gray-600">{material.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Created: {new Date(item.createdAt.toDate()).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}