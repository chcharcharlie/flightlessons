import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Anthropic from '@anthropic-ai/sdk';

const db = admin.firestore();

// Helper function to write progress updates
async function writeProgress(
  sessionId: string | undefined,
  update: {
    type: 'conversation_turn' | 'tool_execution' | 'tool_result' | 'completion';
    conversationTurn?: number;
    toolName?: string;
    toolParameters?: any;
    toolResult?: string;
    toolCallId?: string;
    message?: string;
    error?: string;
  },
  userId?: string
) {
  if (!sessionId) {
;
    return;
  }


  const progressRef = db.collection('aiProgress').doc(sessionId);
  const progressUpdate = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(), // Use ISO string instead of serverTimestamp in array
    ...update
  };

  try {
    // Try to update existing document
    await progressRef.update({
      updates: admin.firestore.FieldValue.arrayUnion(progressUpdate),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error: any) {
    if (error.code === 5) { // NOT_FOUND error
      try {
        await progressRef.set({
          id: sessionId,
          userId: userId || '',
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
          updates: [progressUpdate]
        });
      } catch (createError: any) {
        console.error('[Progress] Failed to create progress document:', createError.message);
      }
    } else {
      console.error('[Progress] Failed to update progress:', error.message);
    }
  }
}

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

  try {
    switch (toolName) {
      case 'list_study_areas': {

        // Query from workspace subcollection (where they actually are!)
        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        const areas = await workspaceRef
          .collection('studyAreas')
          .where('certificate', '==', args.certificate)
          .orderBy('order')
          .get();


        if (areas.empty) {
          return `No study areas found for ${args.certificate} certificate.`;
        }

        const areaList = areas.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          order: doc.data().order || 0
        }));

        return `Found ${areaList.length} study areas for ${args.certificate}:\n${areaList.map(a => `- ${a.name} (ID: ${a.id})`).join('\n')
          }`;
      }

      case 'create_study_area': {
        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        const newArea = {
          cfiWorkspaceId: workspaceId,
          certificate: args.certificate,
          name: args.name,
          order: args.orderNumber || 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const areaRef = await workspaceRef.collection('studyAreas').add(newArea);
        return `✅ Created study area "${args.name}" (ID: ${areaRef.id})`;
      }

      case 'delete_study_areas': {
        const batch = db.batch();
        let deletedCount = 0;
        let deletedNames: string[] = [];

        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        const areas = await workspaceRef
          .collection('studyAreas')
          .where('certificate', '==', args.certificate)
          .get();

        for (const doc of areas.docs) {
          const data = doc.data();
          const shouldDelete = args.deleteAll ||
            (args.filter && data.name.toLowerCase().includes(args.filter.toLowerCase()));

          if (shouldDelete) {
            // Delete associated study items first
            const items = await workspaceRef
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
        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        let query = workspaceRef.collection('studyItems') as any;

        if (args.areaId) {
          query = query.where('studyAreaId', '==', args.areaId);
        }

        const items = await query.get();

        if (items.empty) {
          return 'No study items found.';
        }

        // Get area names for context
        const areas = await workspaceRef
          .collection('studyAreas')
          .get();

        const areaMap = new Map(areas.docs.map((doc: any) => [doc.id, doc.data().name]));

        const itemList = items.docs.map((doc: any) => {
          const data = doc.data();
          const areaName = areaMap.get(data.studyAreaId) || 'Unknown Area';
          return `- ${data.name} (${data.type}) - ${areaName}`;
        });

        return `Found ${itemList.length} study items:\n${itemList.join('\n')}`;
      }

      case 'create_study_item': {
        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        const newItem = {
          cfiWorkspaceId: workspaceId,
          studyAreaId: args.areaId,
          name: args.name,
          type: args.type,
          description: args.description || '',
          evaluationCriteria: args.evaluationCriteria || '',
          order: args.orderNumber || 0,
          acsCodeMappings: [],
          referenceMaterials: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const itemRef = await workspaceRef.collection('studyItems').add(newItem);
        return `✅ Created study item "${args.name}" (ID: ${itemRef.id})`;
      }

      case 'delete_study_items': {
        const batch = db.batch();
        let deletedCount = 0;

        const workspaceRef = db.collection('workspaces').doc(workspaceId);
        let query = workspaceRef.collection('studyItems') as any;

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
          .orderBy('order')
          .get();

        if (plans.empty) {
          return `No lesson plans found for ${args.certificate} certificate.`;
        }

        const planList = plans.docs.map(doc => ({
          id: doc.id,
          title: doc.data().title,
          order: doc.data().order || 0
        }));

        return `Found ${planList.length} lesson plans for ${args.certificate}:\n${planList.map(p => `- ${p.title} (Order: ${p.order})`).join('\n')
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
          order: args.orderNumber || 0,
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

    const { message, context, conversationHistory, progressSessionId } = request.data;


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
      // Initialize progress session if provided
      if (progressSessionId) {

        // Check if document already exists (frontend might have created it)
        const progressRef = db.collection('aiProgress').doc(progressSessionId);
        const progressDoc = await progressRef.get();

        if (!progressDoc.exists) {
          await progressRef.set({
            id: progressSessionId,
            userId: request.auth.uid,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            updates: []
          });
        } else {
          await progressRef.update({
            userId: request.auth.uid
          });
        }

        // Write initial progress update
        await writeProgress(progressSessionId, {
          type: 'conversation_turn',
          conversationTurn: 0,
          message: 'Starting AI assistant...'
        }, request.auth.uid);
      }

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
- When asked to list or view content, use the appropriate list tool(s)
- When asked to create content, use the create tool
- When asked to delete content, use the delete tool with appropriate filters
- Always use the certificate from the context (PRIVATE, INSTRUMENT, or COMMERCIAL)

CRITICAL RULE: When creating study items, you MUST use ALL tools in ONE response:

If user says "create study items for [area name]":
1. Use list_study_areas 
2. WITHOUT STOPPING, immediately use create_study_item 5-10 times
3. Do NOT wait for user response between tools
4. Do NOT announce what you're going to do - just do it!

WRONG approach (do NOT do this):
- List areas
- Say "Now I'll create items..." 
- Stop and wait

CORRECT approach (DO this):
- list_study_areas
- create_study_item 
- create_study_item
- create_study_item
- create_study_item
- create_study_item
(all in ONE response without pausing)

Remember: The system supports multiple tool calls in parallel. Use them!`;

      // Initialize conversation loop
      let conversationMessages = [...messages];
      let finalResponse = '';
      let requiresRefresh = false;
      let iteration = 0;
      const maxIterations = 3;
      const toolExecutions: Array<{
        toolName: string;
        parameters: any;
        result: string;
        conversationTurn: number;
      }> = [];

      // Keep processing until no more tools are used
      while (iteration < maxIterations) {
        iteration++;

        // Write progress for new conversation turn
        await writeProgress(progressSessionId, {
          type: 'conversation_turn',
          conversationTurn: iteration,
          message: `Starting conversation turn ${iteration}`
        }, request.auth.uid);

        // Call Anthropic
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 4000,
          temperature: 0.7,
          system: systemPrompt,
          messages: conversationMessages,
          tools: curriculumTools,
        });

        // Process the response
        let responseText = '';
        const toolUses = [];
        const toolResults = [];

        // Extract text and tools
        for (const block of response.content) {
          if (block.type === 'text') {
            responseText += block.text;
          } else if (block.type === 'tool_use') {
            toolUses.push(block);
          }
        }

        // Add any text to final response
        if (responseText) {
          finalResponse += (finalResponse && responseText ? '\n\n' : '') + responseText;
        }

        // If no tools used, we're done
        if (toolUses.length === 0) {
          break;
        }


        // Execute all tools
        for (const toolUse of toolUses) {

          // Write progress for tool execution start
          await writeProgress(progressSessionId, {
            type: 'tool_execution',
            conversationTurn: iteration,
            toolName: toolUse.name,
            toolParameters: toolUse.input,
            toolCallId: toolUse.id,
            message: `Executing ${toolUse.name}`
          }, request.auth.uid);

          const toolResult = await executeTool(toolUse.name, toolUse.input, workspaceId);

          // Write progress for tool result
          await writeProgress(progressSessionId, {
            type: 'tool_result',
            conversationTurn: iteration,
            toolName: toolUse.name,
            toolResult: toolResult,
            toolCallId: toolUse.id,
            message: `Completed ${toolUse.name}`
          }, request.auth.uid);

          if (toolUse.name.includes('create') || toolUse.name.includes('delete')) {
            requiresRefresh = true;
          }

          // Track tool execution
          toolExecutions.push({
            toolName: toolUse.name,
            parameters: toolUse.input,
            result: toolResult,
            conversationTurn: iteration
          });

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: toolResult
          });
        }


        // Add assistant's message with tools to conversation
        conversationMessages.push({
          role: 'assistant',
          content: response.content
        });

        // Add tool results as user message to continue conversation
        conversationMessages.push({
          role: 'user',
          content: toolResults
        });

        // If this was just list_study_areas, encourage continuation
        if (toolUses.length === 1 && toolUses[0].name === 'list_study_areas') {
        }
      }

      // Ensure we have a final response
      if (!finalResponse) {
        if (requiresRefresh) {
          finalResponse = 'I\'ve completed the requested operations. Please check your curriculum.';
        } else {
          finalResponse = 'I\'ve processed your request.';
        }
      }

      // Write completion progress
      await writeProgress(progressSessionId, {
        type: 'completion',
        message: 'Request completed successfully'
      }, request.auth.uid);

      // Mark session as completed
      if (progressSessionId) {
        await db.collection('aiProgress').doc(progressSessionId).update({
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return {
        success: true,
        response: finalResponse,
        requiresRefresh,
        toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined
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