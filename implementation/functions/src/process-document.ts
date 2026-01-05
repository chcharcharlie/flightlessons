import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const storage = admin.storage();

export const processDocument = onCall(
  {
    timeoutSeconds: 60,
    memory: '512MiB',
    cors: true
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { fileUrl, fileName, mimeType } = request.data;

    if (!fileUrl || !fileName) {
      throw new HttpsError('invalid-argument', 'File URL and name are required');
    }

    try {
      // If it's a PDF, extract the text
      if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
        // Download the file from Firebase Storage
        const bucket = storage.bucket();
        
        // Extract bucket and path from the URL
        // URL format: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/PATH?token=...
        const urlParts = fileUrl.match(/\/b\/([^\/]+)\/o\/([^?]+)/);
        if (!urlParts) {
          throw new HttpsError('invalid-argument', 'Invalid storage URL format');
        }
        
        const filePath = decodeURIComponent(urlParts[2]);
        const file = bucket.file(filePath);
        
        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
          throw new HttpsError('not-found', 'File not found in storage');
        }
        
        // Download the file content
        const [buffer] = await file.download();
        
        // Parse PDF - Use dynamic require to avoid TypeScript issues
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(Buffer.from(buffer));
        
        // Return extracted text and metadata
        return {
          success: true,
          content: data.text,
          metadata: {
            fileName,
            mimeType,
            numPages: data.numpages,
            info: data.info
          }
        };
      } else {
        // For non-PDF files, just return basic info for now
        return {
          success: true,
          content: `File: ${fileName} (${mimeType})`,
          metadata: {
            fileName,
            mimeType
          }
        };
      }
    } catch (error: any) {
      console.error('Error processing document:', error);
      
      if (error instanceof HttpsError) {
        throw error;
      }
      
      throw new HttpsError('internal', `Failed to process document: ${error.message}`);
    }
  }
);