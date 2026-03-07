/**
 * FirstSolo Curriculum Exchange Format
 * Version 1.0
 * 
 * This format allows CFIs to share and import/export complete curriculum structures
 * including study areas, study items, and lesson plans.
 */

export interface CurriculumFile {
  version: string; // Format version (e.g., "1.0")
  metadata: {
    title: string;
    description?: string;
    author?: string;
    createdAt?: string; // ISO 8601 date
    lastModified?: string; // ISO 8601 date
    certificate: 'PRIVATE' | 'INSTRUMENT' | 'COMMERCIAL';
    tags?: string[]; // e.g., ["Part 61", "Part 141", "Accelerated"]
  };
  
  studyAreas: StudyAreaExport[];
  studyItems: StudyItemExport[];
  lessonPlans: LessonPlanExport[];
}

export interface StudyAreaExport {
  id: string; // Local ID for referencing within the file
  name: string;
  description?: string;
  orderNumber: number;
}

export interface StudyItemExport {
  id: string; // Local ID for referencing within the file
  studyAreaId: string; // References StudyAreaExport.id
  name: string;
  type: 'GROUND' | 'FLIGHT' | 'BOTH';
  description: string;
  evaluationCriteria: string;
  orderNumber: number;
  acsCodeMappings?: string[]; // ACS codes like "PA.I.A.K1"
  referenceMaterials?: ReferenceMaterialExport[];
}

export interface ReferenceMaterialExport {
  type: 'link' | 'file';
  name: string;
  url: string;
  description?: string;
}

export interface LessonPlanExport {
  id: string; // Local ID
  title: string;
  orderNumber: number;
  motivation: string;
  objectives: string[];
  itemIds: string[]; // References StudyItemExport.id
  planDescription: string;
  preStudyHomework: string;
  estimatedDuration: {
    ground: number; // minutes
    flight: number; // hours (decimal)
  };
  referenceMaterials?: ReferenceMaterialExport[];
}

/**
 * Validation result for curriculum import
 */
export interface CurriculumValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    studyAreas: number;
    studyItems: number;
    lessonPlans: number;
  };
}