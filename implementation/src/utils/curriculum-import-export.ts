import { 
  CurriculumFile, 
  CurriculumValidationResult,
  StudyAreaExport,
  StudyItemExport,
  LessonPlanExport
} from '@/types/curriculum-format';
import { 
  StudyArea, 
  StudyItem, 
  LessonPlan,
  Certificate
} from '@/types';
import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  query, 
  where,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Validate a curriculum file before import
 */
export function validateCurriculumFile(data: any): CurriculumValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check version
  if (!data.version) {
    errors.push('Missing version field');
  } else if (data.version !== '1.0') {
    warnings.push(`Unknown version ${data.version}, attempting to import anyway`);
  }
  
  // Check metadata
  if (!data.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!data.metadata.title) errors.push('Missing metadata.title');
    if (!data.metadata.certificate) {
      errors.push('Missing metadata.certificate');
    } else if (!['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'].includes(data.metadata.certificate)) {
      errors.push(`Invalid certificate: ${data.metadata.certificate}`);
    }
  }
  
  // Check study areas
  if (!Array.isArray(data.studyAreas)) {
    errors.push('studyAreas must be an array');
  } else {
    const areaIds = new Set<string>();
    data.studyAreas.forEach((area: any, index: number) => {
      if (!area.id) errors.push(`Study area at index ${index} missing id`);
      if (!area.name) errors.push(`Study area at index ${index} missing name`);
      if (typeof area.orderNumber !== 'number') {
        errors.push(`Study area at index ${index} missing or invalid orderNumber`);
      }
      if (area.id && areaIds.has(area.id)) {
        errors.push(`Duplicate study area id: ${area.id}`);
      }
      areaIds.add(area.id);
    });
  }
  
  // Check study items
  if (!Array.isArray(data.studyItems)) {
    errors.push('studyItems must be an array');
  } else {
    const itemIds = new Set<string>();
    data.studyItems.forEach((item: any, index: number) => {
      if (!item.id) errors.push(`Study item at index ${index} missing id`);
      if (!item.studyAreaId) errors.push(`Study item at index ${index} missing studyAreaId`);
      if (!item.name) errors.push(`Study item at index ${index} missing name`);
      if (!['GROUND', 'FLIGHT', 'BOTH'].includes(item.type)) {
        errors.push(`Study item at index ${index} invalid type: ${item.type}`);
      }
      if (typeof item.orderNumber !== 'number') {
        errors.push(`Study item at index ${index} missing or invalid orderNumber`);
      }
      if (item.id && itemIds.has(item.id)) {
        errors.push(`Duplicate study item id: ${item.id}`);
      }
      itemIds.add(item.id);
      
      // Check if area exists
      if (data.studyAreas && !data.studyAreas.some((a: any) => a.id === item.studyAreaId)) {
        errors.push(`Study item ${item.id} references non-existent area: ${item.studyAreaId}`);
      }
    });
  }
  
  // Check lesson plans
  if (!Array.isArray(data.lessonPlans)) {
    errors.push('lessonPlans must be an array');
  } else {
    data.lessonPlans.forEach((plan: any, index: number) => {
      if (!plan.title) errors.push(`Lesson plan at index ${index} missing title`);
      if (typeof plan.orderNumber !== 'number') {
        errors.push(`Lesson plan at index ${index} missing or invalid orderNumber`);
      }
      if (!Array.isArray(plan.objectives)) {
        errors.push(`Lesson plan at index ${index} objectives must be an array`);
      }
      if (!Array.isArray(plan.itemIds)) {
        errors.push(`Lesson plan at index ${index} itemIds must be an array`);
      } else {
        // Check if all referenced items exist
        plan.itemIds.forEach((itemId: string) => {
          if (data.studyItems && !data.studyItems.some((i: any) => i.id === itemId)) {
            warnings.push(`Lesson plan ${plan.title} references non-existent item: ${itemId}`);
          }
        });
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      studyAreas: Array.isArray(data.studyAreas) ? data.studyAreas.length : 0,
      studyItems: Array.isArray(data.studyItems) ? data.studyItems.length : 0,
      lessonPlans: Array.isArray(data.lessonPlans) ? data.lessonPlans.length : 0
    }
  };
}

/**
 * Import a curriculum file into a workspace
 */
export async function importCurriculum(
  workspaceId: string,
  curriculumFile: CurriculumFile,
  options: {
    clearExisting?: boolean;
    mergeStrategy?: 'replace' | 'append';
  } = {}
): Promise<{
  success: boolean;
  imported: {
    areas: number;
    items: number;
    plans: number;
  };
  error?: string;
}> {
  try {
    const batch = writeBatch(db);
    const workspaceRef = doc(db, 'workspaces', workspaceId);
    const certificate = curriculumFile.metadata.certificate;
    
    // Map old IDs to new Firebase IDs
    const areaIdMap = new Map<string, string>();
    const itemIdMap = new Map<string, string>();
    
    // Clear existing if requested
    if (options.clearExisting) {
      // Delete existing areas
      const existingAreas = await getDocs(
        query(
          collection(workspaceRef, 'studyAreas'),
          where('certificate', '==', certificate)
        )
      );
      existingAreas.forEach(doc => batch.delete(doc.ref));
      
      // Delete existing items for this certificate
      const allItems = await getDocs(collection(workspaceRef, 'studyItems'));
      const areaIds = existingAreas.docs.map(d => d.id);
      allItems.forEach(doc => {
        if (areaIds.includes(doc.data().studyAreaId)) {
          batch.delete(doc.ref);
        }
      });
      
      // Delete existing lesson plans
      const existingPlans = await getDocs(
        query(
          collection(db, 'lessonPlans'),
          where('cfiWorkspaceId', '==', workspaceId),
          where('certificate', '==', certificate)
        )
      );
      existingPlans.forEach(doc => batch.delete(doc.ref));
    }
    
    // Import study areas
    for (const area of curriculumFile.studyAreas) {
      const newAreaRef = doc(collection(workspaceRef, 'studyAreas'));
      areaIdMap.set(area.id, newAreaRef.id);
      
      batch.set(newAreaRef, {
        name: area.name,
        certificate,
        orderNumber: area.orderNumber,
        cfiWorkspaceId: workspaceId,
        createdAt: Timestamp.now()
      });
    }
    
    // Import study items
    for (const item of curriculumFile.studyItems) {
      const newItemRef = doc(collection(workspaceRef, 'studyItems'));
      itemIdMap.set(item.id, newItemRef.id);
      
      const newAreaId = areaIdMap.get(item.studyAreaId);
      if (!newAreaId) continue; // Skip if area not found
      
      batch.set(newItemRef, {
        studyAreaId: newAreaId,
        name: item.name,
        type: item.type,
        description: item.description || '',
        evaluationCriteria: item.evaluationCriteria || '',
        orderNumber: item.orderNumber,
        acsCodeMappings: item.acsCodeMappings || [],
        referenceMaterials: item.referenceMaterials || [],
        cfiWorkspaceId: workspaceId,
        createdAt: Timestamp.now()
      });
    }
    
    // Import lesson plans
    for (const plan of curriculumFile.lessonPlans) {
      const newPlanRef = doc(collection(db, 'lessonPlans'));
      
      // Map item IDs
      const mappedItemIds = plan.itemIds
        .map(id => itemIdMap.get(id))
        .filter(id => id !== undefined) as string[];
      
      batch.set(newPlanRef, {
        title: plan.title,
        certificate,
        orderNumber: plan.orderNumber,
        motivation: plan.motivation || '',
        objectives: plan.objectives || [],
        itemIds: mappedItemIds,
        planDescription: plan.planDescription || '',
        preStudyHomework: plan.preStudyHomework || '',
        estimatedDuration: plan.estimatedDuration || { ground: 60, flight: 0 },
        referenceMaterials: plan.referenceMaterials || [],
        cfiWorkspaceId: workspaceId,
        createdAt: Timestamp.now()
      });
    }
    
    await batch.commit();
    
    return {
      success: true,
      imported: {
        areas: curriculumFile.studyAreas.length,
        items: curriculumFile.studyItems.length,
        plans: curriculumFile.lessonPlans.length
      }
    };
  } catch (error: any) {
    console.error('Import error:', error);
    return {
      success: false,
      imported: { areas: 0, items: 0, plans: 0 },
      error: error.message
    };
  }
}

/**
 * Export curriculum from a workspace
 */
export async function exportCurriculum(
  workspaceId: string,
  certificate: Certificate,
  metadata?: Partial<CurriculumFile['metadata']>
): Promise<CurriculumFile> {
  // First, let's verify the workspaceId is valid
  if (!workspaceId) {
    throw new Error('Workspace ID is required');
  }
  
  const workspaceRef = doc(db, 'workspaces', workspaceId);
  
  try {
    // Get study areas
    const areasSnapshot = await getDocs(
      query(
        collection(workspaceRef, 'studyAreas'),
        where('certificate', '==', certificate)
      )
    );
  
  const areas: StudyAreaExport[] = [];
  const areaIdMap = new Map<string, string>(); // Firebase ID -> Export ID
  
  areasSnapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    const exportId = `area_${index + 1}`;
    areaIdMap.set(doc.id, exportId);
    
    areas.push({
      id: exportId,
      name: data.name,
      description: data.description,
      orderNumber: data.orderNumber || index
    });
  });
  
  // Sort areas by order
  areas.sort((a, b) => a.orderNumber - b.orderNumber);
  
  // Get all study items and filter by area
  const itemsSnapshot = await getDocs(collection(workspaceRef, 'studyItems'));
  const items: StudyItemExport[] = [];
  const itemIdMap = new Map<string, string>(); // Firebase ID -> Export ID
  let itemIndex = 0;
  
  itemsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const exportAreaId = areaIdMap.get(data.studyAreaId);
    
    if (exportAreaId) { // Only include items for exported areas
      const exportId = `item_${++itemIndex}`;
      itemIdMap.set(doc.id, exportId);
      
      items.push({
        id: exportId,
        studyAreaId: exportAreaId,
        name: data.name,
        type: data.type,
        description: data.description || '',
        evaluationCriteria: data.evaluationCriteria || '',
        orderNumber: data.orderNumber || 0,
        acsCodeMappings: data.acsCodeMappings || [],
        referenceMaterials: data.referenceMaterials || []
      });
    }
  });
  
  // Sort items by area and order
  items.sort((a, b) => {
    if (a.studyAreaId !== b.studyAreaId) {
      return a.studyAreaId.localeCompare(b.studyAreaId);
    }
    return a.orderNumber - b.orderNumber;
  });
  
  // Get lesson plans
  const plansSnapshot = await getDocs(
    query(
      collection(db, 'lessonPlans'),
      where('cfiWorkspaceId', '==', workspaceId),
      where('certificate', '==', certificate)
    )
  );
  
  const plans: LessonPlanExport[] = [];
  
  plansSnapshot.docs.forEach((doc, index) => {
    const data = doc.data();
    const exportId = `plan_${index + 1}`;
    
    // Map item IDs
    const mappedItemIds = (data.itemIds || [])
      .map((id: string) => itemIdMap.get(id))
      .filter((id: string | undefined) => id !== undefined) as string[];
    
    plans.push({
      id: exportId,
      title: data.title,
      orderNumber: data.orderNumber || index,
      motivation: data.motivation || '',
      objectives: data.objectives || [],
      itemIds: mappedItemIds,
      planDescription: data.planDescription || '',
      preStudyHomework: data.preStudyHomework || '',
      estimatedDuration: data.estimatedDuration || { ground: 60, flight: 0 },
      referenceMaterials: data.referenceMaterials || []
    });
  });
  
  // Sort plans by order
  plans.sort((a, b) => a.orderNumber - b.orderNumber);
  
  return {
    version: '1.0',
    metadata: {
      title: metadata?.title || `${certificate} Certificate Curriculum`,
      certificate,
      createdAt: new Date().toISOString(),
      ...metadata
    },
    studyAreas: areas,
    studyItems: items,
    lessonPlans: plans
  };
  } catch (error: any) {
    console.error('Error in exportCurriculum:', error);
    throw error;
  }
}