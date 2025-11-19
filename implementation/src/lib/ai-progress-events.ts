/**
 * Event system for real-time AI tool execution progress
 */

export interface ToolExecutionEvent {
  toolName: string
  parameters: any
  status: 'started' | 'completed' | 'error'
  result?: string
  error?: string
  timestamp: Date
}

export interface AIProgressEvent {
  type: 'tool_execution' | 'conversation_turn' | 'processing'
  message?: string
  toolExecution?: ToolExecutionEvent
  conversationTurn?: number
}

class AIProgressEventEmitter extends EventTarget {
  emit(event: AIProgressEvent) {
    this.dispatchEvent(new CustomEvent('ai-progress', { detail: event }))
  }
  
  onProgress(callback: (event: AIProgressEvent) => void) {
    const handler = (e: Event) => {
      callback((e as CustomEvent<AIProgressEvent>).detail)
    }
    this.addEventListener('ai-progress', handler)
    return () => this.removeEventListener('ai-progress', handler)
  }
}

export const aiProgressEvents = new AIProgressEventEmitter()