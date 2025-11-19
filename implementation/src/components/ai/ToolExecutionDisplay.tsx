import React, { useState } from 'react'
import { ChevronDownIcon, ChevronRightIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

interface ToolExecution {
  toolName: string
  parameters: any
  result: string
  conversationTurn: number
}

interface ToolExecutionDisplayProps {
  executions: ToolExecution[]
  className?: string
}

export const ToolExecutionDisplay: React.FC<ToolExecutionDisplayProps> = ({ executions, className = '' }) => {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set())

  if (!executions || executions.length === 0) {
    return null
  }

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedTools)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedTools(newExpanded)
  }

  return (
    <div className={`flex flex-col gap-2 w-full max-w-md ${className}`}>
      {executions.map((exec, index) => {
        const isExpanded = expandedTools.has(index)
        const message = getToolDisplayMessage(exec.toolName)

        return (
          <div key={index} className="flex flex-col">
            <button
              onClick={() => toggleExpanded(index)}
              className="flex items-center gap-2 text-sm text-left hover:bg-gray-50 rounded p-1 -ml-1 transition-colors group"
            >
              <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="text-gray-600 flex-1">{message}</span>
              <span className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {isExpanded ? (
                  <ChevronDownIcon className="h-3 w-3" />
                ) : (
                  <ChevronRightIcon className="h-3 w-3" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="ml-6 mt-1 space-y-2 text-xs border-l-2 border-gray-100 pl-3 py-1">
                <div className="space-y-1">
                  <div className="font-medium text-gray-500">Parameters:</div>
                  <pre className="text-gray-600 bg-gray-50 rounded p-2 overflow-x-auto">
                    {formatParameters(exec.parameters)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <div className="font-medium text-gray-500">Result:</div>
                  <div className="text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap">
                    {exec.result}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getToolDisplayMessage(toolName: string): string {
  const messages: Record<string, string> = {
    'list_study_areas': 'Found study areas',
    'create_study_area': 'Created study area',
    'delete_study_areas': 'Deleted study areas',
    'list_study_items': 'Found study items',
    'create_study_item': 'Created study item',
    'delete_study_items': 'Deleted study items',
    'list_lesson_plans': 'Found lesson plans',
    'create_lesson_plan': 'Created lesson plan',
    'delete_lesson_plans': 'Deleted lesson plans',
    'delete_all_curriculum': 'Cleaned up curriculum'
  }

  return messages[toolName] || `Completed ${toolName}`
}

function formatParameters(params: any): string {
  if (!params) return 'None'
  return JSON.stringify(params, null, 2)
}