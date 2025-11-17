import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

const db = admin.firestore();

// Define tools that Claude can use
const curriculumTools: Anthropic.Tool[] = [
  {
    name: 'list_study_areas',
    description: 'List all study areas for a specific certificate',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type to list study areas for'
        }
      },
      required: ['certificate']
    }
  },
  {
    name: 'create_study_area',
    description: 'Create a new study area for a certificate',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type'
        },
        name: {
          type: 'string',
          description: 'The name of the study area'
        },
        orderNumber: {
          type: 'number',
          description: 'The display order (default: 0)'
        }
      },
      required: ['certificate', 'name']
    }
  },
  {
    name: 'delete_study_areas',
    description: 'Delete study areas based on filters',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type'
        },
        filter: {
          type: 'string',
          description: 'Optional: delete only areas containing this text in their name'
        },
        deleteAll: {
          type: 'boolean',
          description: 'Set to true to delete all areas for the certificate'
        }
      },
      required: ['certificate']
    }
  },
  {
    name: 'list_study_items',
    description: 'List all study items, optionally filtered by study area',
    input_schema: {
      type: 'object',
      properties: {
        areaId: {
          type: 'string',
          description: 'Optional: filter by specific study area ID'
        }
      }
    }
  },
  {
    name: 'create_study_item',
    description: 'Create a new study item within a study area',
    input_schema: {
      type: 'object',
      properties: {
        areaId: {
          type: 'string',
          description: 'The ID of the study area this item belongs to'
        },
        name: {
          type: 'string',
          description: 'The name of the study item'
        },
        type: {
          type: 'string',
          enum: ['GROUND', 'FLIGHT', 'BOTH'],
          description: 'The type of study item'
        },
        description: {
          type: 'string',
          description: 'Detailed description of what students will learn'
        },
        evaluationCriteria: {
          type: 'string',
          description: 'How to evaluate student mastery of this item'
        },
        orderNumber: {
          type: 'number',
          description: 'The display order (default: 0)'
        }
      },
      required: ['areaId', 'name', 'type']
    }
  },
  {
    name: 'delete_study_items',
    description: 'Delete study items based on filters',
    input_schema: {
      type: 'object',
      properties: {
        areaId: {
          type: 'string',
          description: 'Optional: delete only items in this study area'
        },
        filter: {
          type: 'string',
          description: 'Optional: delete only items containing this text in their name'
        },
        deleteAll: {
          type: 'boolean',
          description: 'Set to true to delete all items'
        }
      }
    }
  },
  {
    name: 'list_lesson_plans',
    description: 'List all lesson plans for a specific certificate',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type to list lesson plans for'
        }
      },
      required: ['certificate']
    }
  },
  {
    name: 'create_lesson_plan',
    description: 'Create a new lesson plan',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type'
        },
        title: {
          type: 'string',
          description: 'The lesson plan title'
        },
        motivation: {
          type: 'string',
          description: 'Why this lesson is important'
        },
        objectives: {
          type: 'array',
          items: { type: 'string' },
          description: 'Learning objectives for the lesson'
        },
        itemIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs of study items covered in this lesson'
        },
        planDescription: {
          type: 'string',
          description: 'Detailed description of the lesson plan'
        },
        preStudyHomework: {
          type: 'string',
          description: 'What students should do before the lesson'
        },
        estimatedDuration: {
          type: 'object',
          properties: {
            ground: { type: 'number', description: 'Ground instruction time in minutes' },
            flight: { type: 'number', description: 'Flight time in hours' }
          },
          description: 'Estimated duration for the lesson'
        },
        orderNumber: {
          type: 'number',
          description: 'The display order (default: 0)'
        }
      },
      required: ['certificate', 'title']
    }
  },
  {
    name: 'delete_lesson_plans',
    description: 'Delete lesson plans based on filters',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type'
        },
        filter: {
          type: 'string',
          description: 'Optional: delete only plans containing this text in their title'
        },
        deleteAll: {
          type: 'boolean',
          description: 'Set to true to delete all plans for the certificate'
        }
      },
      required: ['certificate']
    }
  },
  {
    name: 'delete_all_curriculum',
    description: 'Delete all curriculum content (study areas, items, and lesson plans) for a certificate',
    input_schema: {
      type: 'object',
      properties: {
        certificate: {
          type: 'string',
          enum: ['PRIVATE', 'INSTRUMENT', 'COMMERCIAL'],
          description: 'The certificate type'
        }
      },
      required: ['certificate']
    }
  }
];

// Tool execution function
async function executeTool(
  toolName: string,
  args: any,
  workspaceId: string
): Promise<string> {
  console.log(`Executing tool: ${toolName}`, args);

  try {
    switch (toolName) {
      case 'list_study_areas': {
        const areas = await db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', args.certificate)
          .orderBy('orderNumber')
          .get();

        if (areas.empty) {
          return `No study areas found for ${args.certificate} certificate.`;
        }

        const areaList = areas.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          orderNumber: doc.data().orderNumber
        }));

        return `Found ${areaList.length} study areas for ${args.certificate}:\n${
          areaList.map(a => `- ${a.name} (ID: ${a.id})`).join('\n')
        }`;
      }

      case 'create_study_area': {
        const newArea = {
          cfiWorkspaceId: workspaceId,
          certificate: args.certificate,
          name: args.name,
          orderNumber: args.orderNumber || 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const areaRef = await db.collection('studyAreas').add(newArea);
        return `✅ Created study area "${args.name}" (ID: ${areaRef.id})`;
      }

      case 'delete_study_areas': {
        const batch = db.batch();
        let deletedCount = 0;
        let deletedNames: string[] = [];

        const query = db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', args.certificate);

        const areas = await query.get();

        for (const doc of areas.docs) {
          const data = doc.data();
          const shouldDelete = args.deleteAll || 
            (args.filter && data.name.toLowerCase().includes(args.filter.toLowerCase()));

          if (shouldDelete) {
            // Delete associated study items first
            const items = await db
              .collection('studyItems')
              .where('studyAreaId', '==', doc.id)
              .get();

            items.docs.forEach(itemDoc => batch.delete(itemDoc.ref));
            
            batch.delete(doc.ref);
            deletedNames.push(data.name);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          await batch.commit();
          return `✅ Deleted ${deletedCount} study areas: ${deletedNames.join(', ')}`;
        } else {
          return `ℹ️ No study areas found to delete${args.filter ? ` containing "${args.filter}"` : ''}`;
        }
      }

      case 'list_study_items': {
        let query = db
          .collection('studyItems')
          .where('cfiWorkspaceId', '==', workspaceId);

        if (args.areaId) {
          query = query.where('studyAreaId', '==', args.areaId);
        }

        const items = await query.get();

        if (items.empty) {
          return 'No study items found.';
        }

        // Get area names for context
        const areas = await db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .get();

        const areaMap = new Map(areas.docs.map(doc => [doc.id, doc.data().name]));

        const itemList = items.docs.map(doc => {
          const data = doc.data();
          const areaName = areaMap.get(data.studyAreaId) || 'Unknown Area';
          return `- ${data.name} (${data.type}) - ${areaName}`;
        });

        return `Found ${itemList.length} study items:\n${itemList.join('\n')}`;
      }

      case 'create_study_item': {
        const newItem = {
          cfiWorkspaceId: workspaceId,
          studyAreaId: args.areaId,
          name: args.name,
          type: args.type,
          description: args.description || '',
          evaluationCriteria: args.evaluationCriteria || '',
          orderNumber: args.orderNumber || 0,
          acsCodeMappings: [],
          referenceMaterials: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const itemRef = await db.collection('studyItems').add(newItem);
        return `✅ Created study item "${args.name}" (ID: ${itemRef.id})`;
      }

      case 'delete_study_items': {
        const batch = db.batch();
        let deletedCount = 0;

        let query = db
          .collection('studyItems')
          .where('cfiWorkspaceId', '==', workspaceId);

        if (args.areaId) {
          query = query.where('studyAreaId', '==', args.areaId);
        }

        const items = await query.get();

        for (const doc of items.docs) {
          const data = doc.data();
          const shouldDelete = args.deleteAll || 
            (args.filter && data.name.toLowerCase().includes(args.filter.toLowerCase()));

          if (shouldDelete) {
            batch.delete(doc.ref);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          await batch.commit();
          return `✅ Deleted ${deletedCount} study items`;
        } else {
          return `ℹ️ No study items found to delete`;
        }
      }

      case 'list_lesson_plans': {
        const plans = await db
          .collection('lessonPlans')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', args.certificate)
          .orderBy('orderNumber')
          .get();

        if (plans.empty) {
          return `No lesson plans found for ${args.certificate} certificate.`;
        }

        const planList = plans.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          orderNumber: doc.data().orderNumber
        }));

        return `Found ${planList.length} lesson plans for ${args.certificate}:\n${
          planList.map(p => `- ${p.title} (Order: ${p.orderNumber})`).join('\n')
        }`;
      }

      case 'create_lesson_plan': {
        const newPlan = {
          cfiWorkspaceId: workspaceId,
          certificate: args.certificate,
          title: args.title,
          motivation: args.motivation || '',
          objectives: args.objectives || [],
          itemIds: args.itemIds || [],
          planDescription: args.planDescription || '',
          referenceMaterials: [],
          preStudyHomework: args.preStudyHomework || '',
          estimatedDuration: args.estimatedDuration || { ground: 60, flight: 0 },
          orderNumber: args.orderNumber || 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const planRef = await db.collection('lessonPlans').add(newPlan);
        return `✅ Created lesson plan "${args.title}" (ID: ${planRef.id})`;
      }

      case 'delete_lesson_plans': {
        const batch = db.batch();
        let deletedCount = 0;
        let deletedTitles: string[] = [];

        const query = db
          .collection('lessonPlans')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', args.certificate);

        const plans = await query.get();

        for (const doc of plans.docs) {
          const data = doc.data();
          const shouldDelete = args.deleteAll || 
            (args.filter && data.title.toLowerCase().includes(args.filter.toLowerCase()));

          if (shouldDelete) {
            batch.delete(doc.ref);
            deletedTitles.push(data.title);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          await batch.commit();
          return `✅ Deleted ${deletedCount} lesson plans: ${deletedTitles.join(', ')}`;
        } else {
          return `ℹ️ No lesson plans found to delete${args.filter ? ` containing "${args.filter}"` : ''}`;
        }
      }

      case 'delete_all_curriculum': {
        const batch = db.batch();
        let totalDeleted = 0;

        // Delete lesson plans
        const plans = await db
          .collection('lessonPlans')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', args.certificate)
          .get();
        
        plans.docs.forEach(doc => {
          batch.delete(doc.ref);
          totalDeleted++;
        });

        // Delete study areas and their items
        const areas = await db
          .collection('studyAreas')
          .where('cfiWorkspaceId', '==', workspaceId)
          .where('certificate', '==', args.certificate)
          .get();

        for (const areaDoc of areas.docs) {
          // Delete associated items
          const items = await db
            .collection('studyItems')
            .where('studyAreaId', '==', areaDoc.id)
            .get();
          
          items.docs.forEach(itemDoc => {
            batch.delete(itemDoc.ref);
            totalDeleted++;
          });

          batch.delete(areaDoc.ref);
          totalDeleted++;
        }

        if (totalDeleted > 0) {
          await batch.commit();
          return `✅ Deleted all curriculum content for ${args.certificate} certificate (${totalDeleted} items total)`;
        } else {
          return `ℹ️ No curriculum content found for ${args.certificate} certificate`;
        }
      }

      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (error: any) {
    console.error(`Error executing tool ${toolName}:`, error);
    return `Error: ${error.message}`;
  }
}

export const aiChatWithTools = onCall(
  { 
    timeoutSeconds: 540,
    memory: '1GiB'
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { message, context, conversationHistory } = request.data;

    if (!message) {
      throw new HttpsError('invalid-argument', 'Message is required');
    }

    // Get user and workspace
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'CFI') {
      throw new HttpsError('permission-denied', 'Only CFIs can use the AI assistant');
    }

    const workspaceId = userDoc.data()?.cfiWorkspaceId;
    if (!workspaceId) {
      throw new HttpsError('failed-precondition', 'No workspace found for user');
    }

    try {
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) {
        throw new HttpsError('failed-precondition', 'API key not configured');
      }

      const anthropic = new Anthropic({ apiKey });

      // Build conversation history
      const messages: Anthropic.MessageParam[] = [];
      
      if (conversationHistory && Array.isArray(conversationHistory)) {
        conversationHistory.forEach((msg: any) => {
          if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({
              role: msg.role,
              content: msg.content
            });
          }
        });
      }

      // Add current message
      messages.push({
        role: 'user',
        content: message
      });

      // Create system prompt
      const systemPrompt = `You are an experienced Certified Flight Instructor (CFI) assistant helping with curriculum management.

${context ? `Current context: ${context}\n` : ''}

You have access to tools for managing the flight training curriculum. When users ask about their curriculum or want to make changes, use the appropriate tools.

Important guidelines:
- When asked to list or view content, use the appropriate list tool
- When asked to create content, use the create tool
- When asked to delete content, use the delete tool with appropriate filters
- For deleting items with specific text, use the filter parameter
- For deleting all items, use the deleteAll parameter
- Always use the certificate from the context (PRIVATE, INSTRUMENT, or COMMERCIAL)

Be helpful and conversational. After using a tool, explain the results in a friendly way.`;

      // Call Anthropic with tools
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.7,
        system: systemPrompt,
        messages: messages,
        tools: curriculumTools,
      });

      // Process the response
      let responseText = '';
      let requiresRefresh = false;

      for (const block of response.content) {
        if (block.type === 'text') {
          responseText += block.text;
        } else if (block.type === 'tool_use') {
          // Execute the tool
          const toolResult = await executeTool(block.name, block.input, workspaceId);
          
          // Tools that modify data require refresh
          if (block.name.includes('create') || block.name.includes('delete')) {
            requiresRefresh = true;
          }

          // Get Claude's response after tool use
          const toolResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [
              ...messages,
              {
                role: 'assistant',
                content: response.content
              },
              {
                role: 'user',
                content: [{
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: toolResult
                }]
              }
            ],
          });

          // Extract the final response
          for (const respBlock of toolResponse.content) {
            if (respBlock.type === 'text') {
              responseText = respBlock.text; // Use the tool response as the final response
            }
          }
        }
      }

      return {
        success: true,
        response: responseText,
        usage: response.usage,
        requiresRefresh
      };

    } catch (error: any) {
      console.error('AI chat error:', error);
      
      if (error.status === 401) {
        throw new HttpsError('failed-precondition', 'AI service configuration error');
      } else if (error.status === 429) {
        throw new HttpsError('resource-exhausted', 'Too many requests. Please try again later.');
      } else if (error.status >= 500) {
        throw new HttpsError('unavailable', 'AI service temporarily unavailable');
      }
      
      throw new HttpsError('internal', 'Failed to process AI request');
    }
  }
);