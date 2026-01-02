import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

/**
 * Hook to get the workspace ID for the current user.
 * For CFIs, it queries the workspaces collection by cfiUid.
 * For students, it uses the cfiWorkspaceId from their user object.
 */
export const useWorkspace = () => {
  const { user } = useAuth();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadWorkspaceId = async () => {
      try {
        setError(null);
        
        if (user.role === 'CFI') {
          // For CFIs, find their workspace
          const workspacesQuery = query(
            collection(db, 'workspaces'),
            where('cfiUid', '==', user.uid)
          );
          const workspacesSnapshot = await getDocs(workspacesQuery);
          
          if (!workspacesSnapshot.empty) {
            const workspace = workspacesSnapshot.docs[0];
            setWorkspaceId(workspace.id);
          } else {
            setError('No workspace found for CFI');
          }
        } else {
          // For students, use cfiWorkspaceId
          const studentWorkspaceId = (user as any).cfiWorkspaceId;
          if (studentWorkspaceId) {
            setWorkspaceId(studentWorkspaceId);
          } else {
            setError('No workspace assigned to student');
          }
        }
      } catch (err: any) {
        console.error('Error loading workspace:', err);
        setError(err.message || 'Failed to load workspace');
      } finally {
        setLoading(false);
      }
    };

    loadWorkspaceId();
  }, [user]);

  return { workspaceId, loading, error };
};