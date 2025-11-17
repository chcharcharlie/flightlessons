import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'

interface BulkDeleteResponse {
  success: boolean
  deletedCount: number
  message: string
}

export async function bulkDeleteCurriculum(
  workspaceId: string,
  certificate: 'PRIVATE' | 'INSTRUMENT' | 'COMMERCIAL',
  deleteType: 'all' | 'studyAreas' | 'studyItems' | 'lessonPlans'
): Promise<BulkDeleteResponse> {
  try {
    const bulkDelete = httpsCallable<
      { workspaceId: string; certificate: string; deleteType: string },
      BulkDeleteResponse
    >(functions, 'bulkDeleteCurriculum')
    
    const result = await bulkDelete({
      workspaceId,
      certificate,
      deleteType
    })
    
    return result.data
  } catch (error: any) {
    console.error('Error calling bulk delete:', error)
    throw new Error(error.message || 'Failed to delete curriculum items')
  }
}