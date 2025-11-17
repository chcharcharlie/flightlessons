import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: { name: string; type: string; url: string }[]
}

interface AIChatResponse {
  success: boolean
  response: string
  usage?: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
  requiresRefresh?: boolean
}

export async function sendChatMessage(
  message: string,
  conversationHistory: AIChatMessage[] = [],
  context?: string
): Promise<AIChatResponse> {
  try {
    const aiChat = httpsCallable<
      { message: string; conversationHistory: AIChatMessage[]; context?: string },
      AIChatResponse
    >(functions, 'aiChatWithTools')
    
    const result = await aiChat({
      message,
      conversationHistory,
      context
    })
    
    return result.data
  } catch (error: any) {
    console.error('Error calling AI chat:', error)
    throw new Error(error.message || 'Failed to send message')
  }
}

// Helper function to process documents for context
export async function processDocumentForContext(file: File): Promise<string> {
  // For now, just return basic file info
  // In a real implementation, you might want to:
  // 1. Upload to Cloud Storage
  // 2. Use a document processing service to extract text
  // 3. Return the extracted content
  
  return `Document: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB)`
}