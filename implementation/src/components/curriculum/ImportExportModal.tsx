import React, { useState, useRef } from 'react';
import { Certificate } from '@/types';
import { CurriculumFile } from '@/types/curriculum-format';
import { 
  validateCurriculumFile, 
  importCurriculum, 
  exportCurriculum 
} from '@/utils/curriculum-import-export';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/hooks/useWorkspace';
import {
  XMarkIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificate: Certificate;
  onImportSuccess?: () => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  certificate,
  onImportSuccess
}) => {
  const { user } = useAuth();
  const { workspaceId, loading: loadingWorkspace } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'import' | 'export'>('import');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [importFile, setImportFile] = useState<CurriculumFile | null>(null);

  if (!isOpen) return null;
  if (loadingWorkspace) return null;
  if (!workspaceId) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
          <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
            <div className="text-red-600">No workspace found. Please contact support.</div>
          </div>
        </div>
      </div>
    );
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      const validation = validateCurriculumFile(data);
      setValidationResult(validation);
      
      if (validation.valid) {
        setImportFile(data);
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        errors: ['Invalid JSON file'],
        warnings: [],
        summary: { studyAreas: 0, studyItems: 0, lessonPlans: 0 }
      });
    }
  };

  const handleImport = async () => {
    if (!importFile || !validationResult?.valid) return;

    setImporting(true);
    try {
      const result = await importCurriculum(workspaceId, importFile, {
        clearExisting: false, // Could make this an option
        mergeStrategy: 'append'
      });

      if (result.success) {
        alert(`Successfully imported:\n- ${result.imported.areas} study areas\n- ${result.imported.items} study items\n- ${result.imported.plans} lesson plans`);
        onImportSuccess?.();
        onClose();
      } else {
        alert(`Import failed: ${result.error}`);
      }
    } catch (error: any) {
      alert(`Import error: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const curriculumData = await exportCurriculum(workspaceId, certificate, {
        author: user?.displayName || user?.email || 'Unknown',
        description: `Exported curriculum for ${certificate} certificate`
      });

      // Create and download file
      const blob = new Blob([JSON.stringify(curriculumData, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${certificate.toLowerCase()}_curriculum_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      alert('Curriculum exported successfully!');
      onClose();
    } catch (error: any) {
      alert(`Export error: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setValidationResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-sky-100 sm:mx-0 sm:h-10 sm:w-10">
              <DocumentTextIcon className="h-6 w-6 text-sky-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Import/Export {certificate} Curriculum
              </h3>
              
              <div className="mt-4">
                <div className="flex rounded-md shadow-sm" role="group">
                  <button
                    type="button"
                    onClick={() => { setMode('import'); resetImport(); }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-lg border ${
                      mode === 'import'
                        ? 'bg-sky-50 text-sky-700 border-sky-200 z-10'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 inline-block mr-2" />
                    Import
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode('export'); resetImport(); }}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-lg border-l-0 border ${
                      mode === 'export'
                        ? 'bg-sky-50 text-sky-700 border-sky-200 z-10'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowUpTrayIcon className="h-4 w-4 inline-block mr-2" />
                    Export
                  </button>
                </div>
              </div>

              {mode === 'import' && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">
                    Select curriculum file
                  </label>
                  <div className="mt-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                    />
                  </div>

                  {validationResult && (
                    <div className="mt-4">
                      {validationResult.valid ? (
                        <div className="rounded-md bg-green-50 p-4">
                          <div className="flex">
                            <CheckCircleIcon className="h-5 w-5 text-green-400" />
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-green-800">
                                Valid curriculum file
                              </h3>
                              <div className="mt-2 text-sm text-green-700">
                                <ul className="list-disc pl-5 space-y-1">
                                  <li>{validationResult.summary.studyAreas} study areas</li>
                                  <li>{validationResult.summary.studyItems} study items</li>
                                  <li>{validationResult.summary.lessonPlans} lesson plans</li>
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-md bg-red-50 p-4">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-red-800">
                                Invalid curriculum file
                              </h3>
                              <div className="mt-2 text-sm text-red-700">
                                <ul className="list-disc pl-5 space-y-1">
                                  {validationResult.errors.map((error: string, i: number) => (
                                    <li key={i}>{error}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {validationResult.warnings.length > 0 && (
                        <div className="mt-2 rounded-md bg-yellow-50 p-4">
                          <div className="flex">
                            <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400" />
                            <div className="ml-3">
                              <h3 className="text-sm font-medium text-yellow-800">
                                Warnings
                              </h3>
                              <div className="mt-2 text-sm text-yellow-700">
                                <ul className="list-disc pl-5 space-y-1">
                                  {validationResult.warnings.map((warning: string, i: number) => (
                                    <li key={i}>{warning}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {mode === 'export' && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500">
                    Export your {certificate} certificate curriculum to a JSON file that can be:
                  </p>
                  <ul className="mt-2 text-sm text-gray-500 list-disc pl-5 space-y-1">
                    <li>Shared with other CFIs</li>
                    <li>Used as a backup</li>
                    <li>Modified with AI assistance</li>
                    <li>Version controlled in Git</li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            {mode === 'import' && (
              <button
                type="button"
                onClick={handleImport}
                disabled={!validationResult?.valid || importing}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-sky-600 text-base font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Importing...' : 'Import Curriculum'}
              </button>
            )}
            
            {mode === 'export' && (
              <button
                type="button"
                onClick={handleExport}
                disabled={exporting}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-sky-600 text-base font-medium text-white hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? 'Exporting...' : 'Export Curriculum'}
              </button>
            )}
            
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};