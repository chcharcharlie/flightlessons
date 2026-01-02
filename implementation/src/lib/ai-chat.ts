import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

interface AIChatMessage {
  role: 'user' | 'assistant'
  content: string
  attachments?: { name: string; type: string; url: string }[]
}

interface ToolExecution {
  toolName: string
  parameters: any
  result: string
  conversationTurn: number
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
  toolExecutions?: ToolExecution[]
}

export async function sendChatMessage(
  message: string,
  conversationHistory: AIChatMessage[] = [],
  context?: string,
  onProgress?: (update: { type: string; message: string }) => void,
  progressSessionId?: string
): Promise<AIChatResponse> {
  try {
    const aiChat = httpsCallable<
      { 
        message: string; 
        conversationHistory: AIChatMessage[]; 
        context?: string;
        progressSessionId?: string;
      },
      AIChatResponse
    >(functions, 'aiChatWithTools', {
      timeout: 540000 // 9 minutes to match server timeout
    })
    
    // Analyze the message to predict what tools will be used
    const messageLower = message.toLowerCase()
    if (messageLower.includes('create') && messageLower.includes('study items')) {
      onProgress?.({ type: 'tool_prediction', message: 'Will use: list_study_areas, create_study_item (multiple times)' })
    } else if (messageLower.includes('delete')) {
      if (messageLower.includes('study area')) {
        onProgress?.({ type: 'tool_prediction', message: 'Will use: list_study_areas, delete_study_areas' })
      } else if (messageLower.includes('study item')) {
        onProgress?.({ type: 'tool_prediction', message: 'Will use: list_study_items, delete_study_items' })
      }
    } else if (messageLower.includes('list') || messageLower.includes('show') || messageLower.includes('what')) {
      onProgress?.({ type: 'tool_prediction', message: 'Will use: list_study_areas or list_study_items' })
    }
    
    const result = await aiChat({
      message,
      conversationHistory,
      context,
      progressSessionId
    })
    
    return result.data
  } catch (error: any) {
    console.error('Error calling AI chat:', error)
    
    // Check for timeout specifically
    if (error.code === 'deadline-exceeded' || error.message?.includes('deadline-exceeded')) {
      throw new Error('timeout')
    }
    
    throw new Error(error.message || 'Failed to send message')
  }
}

// Helper function to process documents for context
export async function processDocumentForContext(file: File, storageUrl?: string): Promise<string> {
  // If no storage URL provided, just return basic info
  if (!storageUrl) {
    return `Document: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB) - ERROR: Failed to upload file`
  }
  
  try {
    // Call the processDocument function to extract content
    const processDoc = httpsCallable<
      { fileUrl: string; fileName: string; mimeType: string },
      { success: boolean; content: string; metadata: any }
    >(functions, 'processDocument')
    
    const result = await processDoc({
      fileUrl: storageUrl,
      fileName: file.name,
      mimeType: file.type
    })
    
    if (result.data.success && result.data.content) {
      return `\n=== Document: ${file.name} ===\n${result.data.content}\n=== End of Document ===\n`
    }
  } catch (error: any) {
    console.error('Error processing document:', error)
    return `Document: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB) - ERROR: Failed to process document content: ${error.message || 'Unknown error'}. The AI cannot see the document content.`
  }
  
  // Fallback to error message
  return `Document: ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB) - ERROR: Failed to extract document content. The AI cannot see the document content.`
}