import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  XMarkIcon,
  PaperAirplaneIcon,
  DocumentIcon,
  PaperClipIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { ToolExecutionDisplay } from './ToolExecutionDisplay'
import { AIProgressDisplay } from './AIProgressDisplay'
import { subscribeToAIProgress, initializeProgressSession, AIProgressUpdate } from '@/lib/ai-progress'

interface ToolExecution {
  toolName: string
  parameters: any
  result: string
  conversationTurn: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  attachments?: { name: string; type: string; url: string }[]
  timestamp: Date
  isStreaming?: boolean
  toolExecutions?: ToolExecution[]
}

interface ChatWindowProps {
  isOpen: boolean
  onClose: () => void
  context?: string
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ isOpen, onClose, context: propContext }) => {
  const location = useLocation()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your AI flight instructor assistant. I can help you:
      
• Create and organize study areas and items for your curriculum
• Design lesson plans based on your teaching materials
• Import your existing lesson plans and documents
• Optimize your curriculum based on FAA standards

When I suggest curriculum content, I'll provide it in a structured format that you can use to create items in your system. 

Try asking me things like:
- "Create study areas for private pilot ground school"
- "What study items should I include for navigation?"
- "Help me design a lesson plan for aerodynamics"

Feel free to upload any documents you'd like me to help you with!`,
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [progressUpdates, setProgressUpdates] = useState<AIProgressUpdate[]>([])
  const [currentAiMessageId, setCurrentAiMessageId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressUnsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!isOpen) return null

  const handleSendMessage = async () => {
    if (!inputValue.trim() && attachedFiles.length === 0) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      attachments: attachedFiles.map(file => ({
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
      })),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setAttachedFiles([])
    setIsLoading(true)

    // Add placeholder AI message that we'll update
    const aiMessageId = Date.now().toString() + '-assistant'
    setCurrentAiMessageId(aiMessageId)
    const placeholderMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '...',
      timestamp: new Date(),
      isStreaming: true,
    }
    setMessages(prev => [...prev, placeholderMessage])

    // Generate a unique session ID for progress tracking
    const sessionId = `progress_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setProgressUpdates([])
    
    // Initialize progress session document and subscribe
    
    // Initialize the session document first to avoid race condition
    await initializeProgressSession(sessionId)
    
    // Subscribe to progress updates
    progressUnsubscribeRef.current = subscribeToAIProgress(
      sessionId,
      (update) => {
        setProgressUpdates(prev => {
          const newUpdates = [...prev, update]
          return newUpdates
        })
      },
      (error) => {
        console.error('[ChatWindow] Progress subscription error:', error)
      }
    )

    try {
      const result = await sendMessageToAPI(userMessage, attachedFiles, () => {
        // This is now handled by the real-time subscription
      }, sessionId)
      
      // Make sure we have a valid response
      if (!result || !result.response || result.response === '') {
        throw new Error('Received empty response from AI')
      }
      
      // Update the placeholder with actual response and tool executions
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              content: result.response, 
              isStreaming: false,
              toolExecutions: result.toolExecutions 
            }
          : msg
      ))
    } catch (error: any) {
      console.error('Error sending message:', error)
      
      // Determine error message
      let errorMessage = 'I apologize, but I encountered an error.'
      
      if (error.message?.includes('timeout')) {
        errorMessage = 'The operation timed out. This can happen with large requests. The items may still be processing in the background - please check your curriculum in a moment.'
      } else if (error.message?.includes('empty response')) {
        errorMessage = 'I completed the operation but couldn\'t generate a response. Please check your curriculum to see if the items were created.'
      } else {
        errorMessage = `I encountered an error: ${error.message || 'Unknown error'}. Please try again.`
      }
      
      // Update placeholder with error
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              content: errorMessage,
              isStreaming: false 
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
      
      // Clean up progress subscription
      if (progressUnsubscribeRef.current) {
        progressUnsubscribeRef.current()
        progressUnsubscribeRef.current = null
      }
      
      // Clear progress state after a delay
      setTimeout(() => {
        setProgressUpdates([])
        setCurrentAiMessageId(null)
      }, 2000)
    }
  }

  const sendMessageToAPI = async (
    message: Message, 
    files: File[], 
    onProgress?: (update: { type: string; message: string }) => void,
    sessionId?: string
  ): Promise<{ response: string; toolExecutions?: ToolExecution[] }> => {
    try {
      // Import the function dynamically to avoid circular dependencies
      const { sendChatMessage, processDocumentForContext } = await import('@/lib/ai-chat')
      
      // Build context including page location
      let context = propContext || ''
      
      // Add page context if not provided
      if (!context && location.pathname.includes('/curriculum')) {
        const selectedCertificate = sessionStorage.getItem('selectedCertificate') || 'PRIVATE'
        context = `User is currently viewing the ${selectedCertificate} certificate curriculum page.\n`
      }
      
      // Process any attached files
      if (files.length > 0) {
        const fileContexts = await Promise.all(
          files.map(file => processDocumentForContext(file))
        )
        context += '\n' + fileContexts.join('\n\n')
      }
      
      // Get conversation history (exclude the current message)
      const conversationHistory = messages
        .filter(msg => msg.id !== message.id)
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      
      // Send to API
      const response = await sendChatMessage(
        message.content,
        conversationHistory,
        context,
        onProgress,
        sessionId
      )
      
      
      // If the response indicates a refresh is needed, emit an event
      if (response.requiresRefresh) {
        const { curriculumEvents } = await import('@/lib/events')
        const selectedCertificate = sessionStorage.getItem('selectedCertificate')
        setTimeout(() => {
          curriculumEvents.emitRefresh(selectedCertificate || undefined)
        }, 500) // Small delay to ensure message is shown
      }
      
      // Make sure we have a response
      if (!response || !response.response) {
        console.error('Invalid response structure:', response)
        throw new Error('Invalid response from AI service')
      }
      
      return {
        response: response.response,
        toolExecutions: response.toolExecutions
      }
    } catch (error: any) {
      console.error('Error calling AI API:', error)
      throw new Error(error.message || 'Failed to get AI response')
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setAttachedFiles(prev => [...prev, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] bg-white rounded-lg shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="h-6 w-6 text-sky" />
          <h3 className="text-lg font-semibold text-gray-900">CFI AI Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-sky text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* Show progress display for streaming messages */}
              {message.isStreaming && message.id === currentAiMessageId && progressUpdates.length > 0 ? (
                <AIProgressDisplay updates={progressUpdates} />
              ) : (
                <p className="text-sm whitespace-pre-wrap">
                  {message.content}
                  {message.isStreaming && progressUpdates.length === 0 && (
                    <span className="inline-block w-1 h-4 ml-1 bg-current animate-pulse" />
                  )}
                </p>
              )}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.attachments.map((attachment, index) => (
                    <div
                      key={index}
                      className={`flex items-center space-x-2 text-xs ${
                        message.role === 'user'
                          ? 'text-sky-100'
                          : 'text-gray-600'
                      }`}
                    >
                      <DocumentIcon className="h-4 w-4" />
                      <span>{attachment.name}</span>
                    </div>
                  ))}
                </div>
              )}
              {message.toolExecutions && message.toolExecutions.length > 0 && message.role === 'assistant' && (
                <ToolExecutionDisplay 
                  executions={message.toolExecutions} 
                  className="mt-2"
                />
              )}
              <p
                className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-sky-100' : 'text-gray-500'
                }`}
              >
                {message.timestamp.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachments Preview */}
      {attachedFiles.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center space-x-1 bg-gray-100 rounded px-2 py-1 text-xs text-gray-700"
              >
                <DocumentIcon className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button
                  onClick={() => removeAttachment(index)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Ask me about curriculum design..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky focus:border-transparent"
              disabled={isLoading}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            multiple
            accept=".pdf,.doc,.docx,.txt,.md"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            <PaperClipIcon className="h-5 w-5" />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)}
            className="p-2 bg-sky text-white rounded-lg hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Upload PDFs, Word docs, or text files of your lesson plans
        </p>
      </div>
    </div>
  )
}