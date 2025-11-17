# Required Firestore Indexes

The AI assistant queries require composite indexes to work properly. Please create the following indexes:

## 1. Study Areas Index

**Collection**: `studyAreas`
**Fields**:
- `certificate` (Ascending)
- `cfiWorkspaceId` (Ascending) 
- `orderNumber` (Ascending)

**Direct Link to Create**:
```
https://console.firebase.google.com/v1/r/project/flightlessons-8b9bd/firestore/indexes?create_composite=ClZwcm9qZWN0cy9mbGlnaHRsZXNzb25zLThiOWJkL2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9zdHVkeUFyZWFzL2luZGV4ZXMvXxABGg8KC2NlcnRpZmljYXRlEAEaEgoOY2ZpV29ya3NwYWNlSWQQARoPCgtvcmRlck51bWJlchABGgwKCF9fbmFtZV9fEAE
```

## 2. Lesson Plans Index

**Collection**: `lessonPlans`
**Fields**:
- `certificate` (Ascending)
- `cfiWorkspaceId` (Ascending)
- `orderNumber` (Ascending)

## 3. Study Items Index

**Collection**: `studyItems`
**Fields**:
- `cfiWorkspaceId` (Ascending)
- `studyAreaId` (Ascending)
- `orderNumber` (Ascending)

## How to Create Indexes

1. Click the direct link above for the Study Areas index
2. In the Firebase Console, it will auto-populate the index configuration
3. Click "Create Index"
4. Wait for the index to build (usually takes a few minutes)
5. For the other indexes, go to Firebase Console > Firestore > Indexes > Create Index manually

## Alternative: Use firestore.indexes.json

Add this to your `firestore.indexes.json` file and deploy:

```json
{
  "indexes": [
    {
      "collectionGroup": "studyAreas",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "cfiWorkspaceId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "certificate",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "orderNumber",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "lessonPlans",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "cfiWorkspaceId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "certificate",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "orderNumber",
          "order": "ASCENDING"
        }
      ]
    },
    {
      "collectionGroup": "studyItems",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "cfiWorkspaceId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "studyAreaId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "orderNumber",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Then deploy with:
```bash
firebase deploy --only firestore:indexes
```