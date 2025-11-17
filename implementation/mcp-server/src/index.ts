#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import * as admin from 'firebase-admin'

// Initialize Firebase Admin with service account
// You'll need to set GOOGLE_APPLICATION_CREDENTIALS env var
admin.initializeApp()

const db = admin.firestore()

// Create MCP server
const server = new Server(
  {
    name: 'flightlessons-curriculum',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Helper function to validate workspace access
async function validateWorkspaceAccess(workspaceId: string, userEmail?: string): Promise<boolean> {
  // In a real implementation, you'd verify the user has access to this workspace
  // For now, we'll just check if the workspace exists
  const workspace = await db.collection('workspaces').doc(workspaceId).get()
  return workspace.exists
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_study_area',
        description: 'Create a new study area for a certificate',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            certificate: { 
              type: 'string', 
              enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
              description: 'The certificate type' 
            },
            name: { type: 'string', description: 'The name of the study area' },
            orderNumber: { type: 'number', description: 'The order number for display' },
          },
          required: ['workspaceId', 'certificate', 'name', 'orderNumber'],
        },
      },
      {
        name: 'list_study_areas',
        description: 'List all study areas for a certificate',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            certificate: { 
              type: 'string', 
              enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
              description: 'The certificate type' 
            },
          },
          required: ['workspaceId', 'certificate'],
        },
      },
      {
        name: 'create_study_item',
        description: 'Create a new study item within a study area',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            areaId: { type: 'string', description: 'The study area ID' },
            name: { type: 'string', description: 'The name of the study item' },
            type: { 
              type: 'string', 
              enum: ['GROUND', 'FLIGHT', 'BOTH'],
              description: 'The type of study item' 
            },
            description: { type: 'string', description: 'Detailed description' },
            evaluationCriteria: { type: 'string', description: 'How to evaluate mastery' },
            orderNumber: { type: 'number', description: 'The order number for display' },
          },
          required: ['workspaceId', 'areaId', 'name', 'type', 'orderNumber'],
        },
      },
      {
        name: 'list_study_items',
        description: 'List all study items in a study area',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            areaId: { type: 'string', description: 'The study area ID' },
          },
          required: ['workspaceId', 'areaId'],
        },
      },
      {
        name: 'create_lesson_plan',
        description: 'Create a new lesson plan for a certificate',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            certificate: { 
              type: 'string', 
              enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
              description: 'The certificate type' 
            },
            title: { type: 'string', description: 'The lesson plan title' },
            motivation: { type: 'string', description: 'Why this lesson is important' },
            objectives: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Learning objectives' 
            },
            itemIds: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Study item IDs to cover' 
            },
            planDescription: { type: 'string', description: 'Detailed lesson plan' },
            preStudyHomework: { type: 'string', description: 'Homework before lesson' },
            estimatedDuration: {
              type: 'object',
              properties: {
                ground: { type: 'number', description: 'Ground time in minutes' },
                flight: { type: 'number', description: 'Flight time in hours' },
              },
              required: ['ground', 'flight'],
            },
            orderNumber: { type: 'number', description: 'The order number for display' },
          },
          required: ['workspaceId', 'certificate', 'title', 'orderNumber'],
        },
      },
      {
        name: 'list_lesson_plans',
        description: 'List all lesson plans for a certificate',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            certificate: { 
              type: 'string', 
              enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
              description: 'The certificate type' 
            },
          },
          required: ['workspaceId', 'certificate'],
        },
      },
      {
        name: 'import_lesson_document',
        description: 'Process and import a lesson plan document',
        inputSchema: {
          type: 'object',
          properties: {
            workspaceId: { type: 'string', description: 'The workspace ID' },
            documentContent: { type: 'string', description: 'The document content as text' },
            documentType: { 
              type: 'string', 
              enum: ['syllabus', 'lesson_plan', 'acs_mapping'],
              description: 'Type of document being imported' 
            },
            certificate: { 
              type: 'string', 
              enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
              description: 'The certificate this document relates to' 
            },
          },
          required: ['workspaceId', 'documentContent', 'documentType', 'certificate'],
        },
      },
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'create_study_area': {
        const { workspaceId, certificate, name, orderNumber } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        const areaRef = await db.collection('studyAreas').add({
          cfiWorkspaceId: workspaceId,
          certificate,
          name,
          orderNumber,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        return {
          content: [
            {
              type: 'text',
              text: `Created study area "${name}" with ID: ${areaRef.id}`,
            },
          ],
        }
      }

      case 'list_study_areas': {
        const { workspaceId, certificate } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        const areasSnapshot = await db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', certificate)
          .orderBy('orderNumber')
          .get()

        const areas = areasSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(areas, null, 2),
            },
          ],
        }
      }

      case 'create_study_item': {
        const { workspaceId, areaId, name, type, description, evaluationCriteria, orderNumber } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        const itemRef = await db.collection('studyItems').add({
          cfiWorkspaceId: workspaceId,
          studyAreaId: areaId,
          name,
          type,
          description: description || '',
          evaluationCriteria: evaluationCriteria || '',
          orderNumber,
          referenceMaterials: [],
          acsCodeMappings: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        return {
          content: [
            {
              type: 'text',
              text: `Created study item "${name}" with ID: ${itemRef.id}`,
            },
          ],
        }
      }

      case 'list_study_items': {
        const { workspaceId, areaId } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        const itemsSnapshot = await db
          .collection('studyItems')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('studyAreaId', '==', areaId)
          .orderBy('orderNumber')
          .get()

        const items = itemsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(items, null, 2),
            },
          ],
        }
      }

      case 'create_lesson_plan': {
        const { 
          workspaceId, 
          certificate, 
          title, 
          motivation, 
          objectives, 
          itemIds, 
          planDescription, 
          preStudyHomework,
          estimatedDuration,
          orderNumber 
        } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        const planRef = await db.collection('lessonPlans').add({
          cfiWorkspaceId: workspaceId,
          certificate,
          title,
          motivation: motivation || '',
          objectives: objectives || [],
          itemIds: itemIds || [],
          planDescription: planDescription || '',
          preStudyHomework: preStudyHomework || '',
          estimatedDuration: estimatedDuration || { ground: 60, flight: 0 },
          referenceMaterials: [],
          orderNumber,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        return {
          content: [
            {
              type: 'text',
              text: `Created lesson plan "${title}" with ID: ${planRef.id}`,
            },
          ],
        }
      }

      case 'list_lesson_plans': {
        const { workspaceId, certificate } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        const plansSnapshot = await db
          .collection('lessonPlans')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', certificate)
          .orderBy('orderNumber')
          .get()

        const plans = plansSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(plans, null, 2),
            },
          ],
        }
      }

      case 'import_lesson_document': {
        const { workspaceId, documentContent, documentType, certificate } = args as any
        
        if (!await validateWorkspaceAccess(workspaceId)) {
          throw new McpError(ErrorCode.InvalidRequest, 'Invalid workspace')
        }

        // This is a placeholder - in a real implementation, you would:
        // 1. Parse the document content based on documentType
        // 2. Extract relevant information
        // 3. Create appropriate study areas, items, or lesson plans
        
        return {
          content: [
            {
              type: 'text',
              text: `Document import functionality would process the ${documentType} for ${certificate} certificate. Content length: ${documentContent.length} characters.`,
            },
          ],
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (error: any) {
    if (error instanceof McpError) {
      throw error
    }
    throw new McpError(ErrorCode.InternalError, error.message)
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  
  console.error('MCP server started for FlightLessons curriculum management')
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})