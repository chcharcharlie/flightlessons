import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export const MigrateButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleMigrate = async () => {
    setLoading(true);
    try {
      const migrate = httpsCallable(functions, 'migrateStudyAreas');
      const response = await migrate();
      const data = response.data as any;
      
      setResult(data.message);
      console.log('Migration details:', data.details);
      
      // Refresh the page after successful migration
      if (data.success) {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      setResult(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-2">Migration Tool</h3>
      <p className="text-sm text-gray-600 mb-4">
        If your study areas aren't showing up, they might be missing workspace IDs. 
        Click the button below to fix this.
      </p>
      
      <button
        onClick={handleMigrate}
        disabled={loading}
        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
      >
        {loading ? 'Migrating...' : 'Migrate Study Areas'}
      </button>
      
      {result && (
        <div className="mt-4 p-3 bg-gray-100 rounded text-sm">
          {result}
        </div>
      )}
    </div>
  );
};