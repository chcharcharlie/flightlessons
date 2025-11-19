import React, { useMemo, useEffect, useRef } from 'react'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { AIProgressUpdate } from '@/lib/ai-progress'

interface AIProgressDisplayProps {
  updates: AIProgressUpdate[]
  className?: string
}

interface ToolState {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  message: string
  startTime: number
  endTime?: number
  result?: string
}

export const AIProgressDisplay: React.FC<AIProgressDisplayProps> = ({ updates, className = '' }) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Process updates to build the current state of tool executions
  const toolStates = useMemo(() => {
    const tools: Record<string, ToolState> = {}
    const toolOrder: string[] = []

    if (!updates || updates.length === 0) return []

    updates.forEach(update => {
      if (update.type === 'tool_execution') {
        const id = update.toolCallId || `tool_${update.timestamp}_${update.toolName}`

        if (!tools[id]) {
          toolOrder.push(id)
          tools[id] = {
            id,
            name: update.toolName || 'Unknown Tool',
            status: 'running',
            message: getToolDisplayMessage(update.toolName || '', 'running'),
            startTime: new Date(update.timestamp as any).getTime(),
          }
        }
      } else if (update.type === 'tool_result') {
        // Try to find matching tool by ID first, then fall back to name matching (for older logs)
        let id = update.toolCallId

        if (!id) {
          // Fallback: find the most recent running tool with this name
          const runningToolId = [...toolOrder].reverse().find(tid =>
            tools[tid].name === update.toolName && tools[tid].status === 'running'
          )
          id = runningToolId
        }

        if (id && tools[id]) {
          tools[id].status = 'completed'
          tools[id].message = getToolDisplayMessage(tools[id].name, 'completed')
          tools[id].endTime = new Date(update.timestamp as any).getTime()
          tools[id].result = update.toolResult
        }
      }
    })

    return toolOrder.map(id => tools[id])
  }, [updates])

  // Auto-scroll to bottom when new tools are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [toolStates.length, updates.length])

  if (!updates || updates.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
        <ArrowPathIcon className="h-4 w-4 animate-spin" />
        <span className="text-sm">Starting AI assistant...</span>
      </div>
    )
  }

  const isCompleted = updates[updates.length - 1]?.type === 'completion'

  return (
    <div className={`flex flex-col gap-2 w-full max-w-md ${className}`}>
      <div
        ref={scrollRef}
        className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200"
      >
        {/* Initial Analysis State */}
        {updates.some(u => u.type === 'conversation_turn') && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
            <span>Analyzed request</span>
          </div>
        )}

        {/* Tool Executions */}
        {toolStates.map((tool) => (
          <div key={tool.id} className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-1 duration-300">
            {tool.status === 'running' ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin text-sky flex-shrink-0" />
            ) : tool.status === 'completed' ? (
              <CheckCircleIcon className="h-4 w-4 text-green-500 flex-shrink-0" />
            ) : (
              <ExclamationCircleIcon className="h-4 w-4 text-red-500 flex-shrink-0" />
            )}
            <span className={`${tool.status === 'running' ? 'text-sky-700 font-medium' : 'text-gray-600'}`}>
              {tool.message}
            </span>
          </div>
        ))}

        {/* Completion State */}
        {isCompleted && (
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 mt-1 border-t border-gray-100 pt-2">
            <CheckCircleIcon className="h-5 w-5" />
            <span>All operations completed successfully!</span>
          </div>
        )}
      </div>
    </div>
  )
}

function getToolDisplayMessage(toolName: string, status: 'running' | 'completed'): string {
  const messages: Record<string, { running: string; completed: string }> = {
    'list_study_areas': {
      running: '🔍 Finding study areas...',
      completed: 'Found study areas'
    },
    'create_study_area': {
      running: '➕ Creating study area...',
      completed: 'Created study area'
    },
    'delete_study_areas': {
      running: '🗑️ Deleting study areas...',
      completed: 'Deleted study areas'
    },
    'list_study_items': {
      running: '📚 Listing study items...',
      completed: 'Found study items'
    },
    'create_study_item': {
      running: '✏️ Creating study item...',
      completed: 'Created study item'
    },
    'delete_study_items': {
      running: '🗑️ Deleting study items...',
      completed: 'Deleted study items'
    },
    'list_lesson_plans': {
      running: '📋 Finding lesson plans...',
      completed: 'Found lesson plans'
    },
    'create_lesson_plan': {
      running: '📝 Creating lesson plan...',
      completed: 'Created lesson plan'
    },
    'delete_lesson_plans': {
      running: '🗑️ Deleting lesson plans...',
      completed: 'Deleted lesson plans'
    },
    'delete_all_curriculum': {
      running: '🧹 Cleaning up curriculum...',
      completed: 'Cleaned up curriculum'
    }
  }

  const defaultMessages = {
    running: `Executing ${toolName}...`,
    completed: `Completed ${toolName}`
  }

  return messages[toolName]?.[status] || defaultMessages[status]
}