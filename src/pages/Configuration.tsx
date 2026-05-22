import React, { useState, useEffect } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../contexts/ToastContext';
import { useConfig } from '../contexts/ConfigContext';
import { fetchWithRetry } from '../utils/api';
import { safeParseApiResponse, getApiUrl } from '../utils/apiUtils';
import { AdoIteration } from '../types/config';
import { RefreshCw, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import {
  AdoConnectionSection,
  IterationSettingsSection,
  FieldMappingSection,
  AssigneeSettingsSection,
  TaskRulesSection,
  ReadinessRulesSection,
  EstimationRulesSection,
  GroupingRulesSection,
  AiEstimationSection
} from '../components/configuration/ConfigSections';
import { SessionReviewPanel } from '../components/configuration/SessionReviewPanel';

export function Configuration() {
  const { showToast } = useToast();
  const { 
    committedConfig, draftConfig, updateDraft, commitDraft, resetDraft, updateCommittedConfig,
    isDirty, isValid, completeness, errors,
    adoFields, setAdoFields,
    adoUsers, setAdoUsers,
    iterations, setIterations,
    connectionStatus, setConnectionStatus,
    openAiKey, saveOpenAiKey,
    geminiKey, saveGeminiKey
  } = useConfig();
  
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionErrorDetails, setConnectionErrorDetails] = useState<any>(null);
  const [currentIteration, setCurrentIteration] = useState<AdoIteration | null>(null);
  const [iterationsLoading, setIterationsLoading] = useState(false);
  const [iterationsError, setIterationsError] = useState<string | null>(null);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');

  const downstreamDisabled = connectionStatus !== 'success';

  useEffect(() => {
    if (iterations.length > 0) {
      const current = iterations.find(i => i.attributes?.timeFrame === 'current') || null;
      setCurrentIteration(current);
    }
  }, [iterations]);

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);
    setConnectionErrorDetails(null);
    
    try {
      const res = await fetchWithRetry(getApiUrl('test-connection'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig.ado)
      });
      
      const parsed = await safeParseApiResponse(res);
      
      if (parsed.ok) {
        setConnectionStatus('success');
        showToast('Connected to Azure DevOps successfully', 'success');
        fetchIterations();
        fetchFields();
        fetchUsers();
      } else {
        setConnectionStatus('failure');
        setConnectionError(parsed.error?.message || 'Connection failed.');
        setConnectionErrorDetails(parsed);
        showToast('Connection failed', 'error');
      }
    } catch (err: any) {
      setConnectionStatus('failure');
      setConnectionError('Network error occurred while testing the connection.');
      showToast('Network error', 'error');
    }
  };

  const fetchIterations = async () => {
    setIterationsLoading(true);
    setIterationsError(null);
    try {
      const res = await fetchWithRetry(getApiUrl('iterations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig.ado)
      });
      const parsed = await safeParseApiResponse(res);
      
      if (parsed.ok && parsed.data?.success) {
        const fetchedIterations: AdoIteration[] = parsed.data.value || [];
        setIterations(fetchedIterations);
        const current = fetchedIterations.find(i => i.attributes?.timeFrame === 'current') || null;
        setCurrentIteration(current);
        
        if (!current) {
          setIterationsError('No active sprint found for this team. Please select manually.');
        } else if (draftConfig.iteration.defaultCurrent) {
          const newIteration = { ...draftConfig.iteration, selectedPath: current.path };
          updateDraft('iteration', newIteration);
          if (committedConfig) {
            updateCommittedConfig('iteration', { ...committedConfig.iteration, selectedPath: current.path });
          }
        }
      } else {
        setIterationsError(parsed.error?.message || 'Failed to fetch iterations.');
      }
    } catch (err) {
      setIterationsError('Network error while fetching iterations.');
    } finally {
      setIterationsLoading(false);
    }
  };

  const fetchFields = async () => {
    setFieldsLoading(true);
    try {
      const res = await fetchWithRetry(getApiUrl('fields'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig.ado)
      });
      const parsed = await safeParseApiResponse(res);
      if (parsed.ok && parsed.data?.success) {
        setAdoFields(parsed.data.value || []);
      }
    } catch (err) {
      showToast('Network error fetching fields', 'error');
    } finally {
      setFieldsLoading(false);
    }
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetchWithRetry(getApiUrl('users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftConfig.ado)
      });
      const parsed = await safeParseApiResponse(res);
      if (parsed.ok && parsed.data?.success) {
        setAdoUsers(parsed.data.value || []);
      }
    } catch (err) {
      showToast('Network error fetching users', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSave = () => {
    if (!isValid) return;
    commitDraft();
    setSaveStatus('success');
    showToast('Configuration saved to session', 'success');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleReset = () => {
    resetDraft();
    setConnectionError(null);
    setConnectionErrorDetails(null);
    showToast('Configuration reset to defaults', 'info');
  };

  return (
    <div className="animate-in fade-in duration-300 pb-24 md:pb-8 relative h-full">
      <PageHeader title="Configuration" description="Manage Azure DevOps connections and application settings." />
      
      {connectionStatus === 'success' ? (
        <div className="mb-6 bg-success-bg/30 border border-success/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-success shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Backend Connected</h3>
              <p className="text-sm text-content-secondary mt-1">Azure DevOps communication is active via server-side PAT.</p>
            </div>
          </div>
          <button 
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="px-4 py-2 bg-success text-primary-fg rounded-lg text-sm font-bold hover:bg-success/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {connectionStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Test Connection
          </button>
        </div>
      ) : (
        <div className="mb-6 bg-warning-bg/30 border border-warning/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-warning-fg shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-content-primary">Connection Required</h3>
              <p className="text-sm text-content-secondary mt-1">Please verify your Organization, Project, and Team settings below.</p>
            </div>
          </div>
          <button 
            onClick={handleTestConnection}
            disabled={connectionStatus === 'testing'}
            className="px-4 py-2 bg-primary text-primary-fg rounded-lg text-sm font-bold hover:bg-primary-hover transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {connectionStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Test Connection
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row gap-8 items-start">
        <div className="flex-1 w-full max-w-4xl space-y-6">
          <AdoConnectionSection 
            data={draftConfig.ado} 
            onChange={d => updateDraft('ado', d)} 
            status={connectionStatus} 
            errorMessage={connectionError} 
            onTest={handleTestConnection} 
          />
          <IterationSettingsSection data={draftConfig.iteration} onChange={d => updateDraft('iteration', d)} disabled={downstreamDisabled} iterations={iterations} currentIteration={currentIteration} isLoading={iterationsLoading} error={iterationsError} onRetry={fetchIterations} />
          <FieldMappingSection data={draftConfig.mapping} errors={errors.mapping} onChange={d => updateDraft('mapping', d)} disabled={downstreamDisabled} fields={adoFields} isLoading={fieldsLoading} onRefresh={fetchFields} />
          <AssigneeSettingsSection data={draftConfig.assignee} errors={errors.assignee} onChange={d => updateDraft('assignee', d)} disabled={downstreamDisabled} users={adoUsers} isLoading={usersLoading} />
          <TaskRulesSection data={draftConfig.tasks} errors={errors.tasks} onChange={d => updateDraft('tasks', d)} disabled={downstreamDisabled} />
          
          <AiEstimationSection 
            data={draftConfig.aiRecommendation}
            onChange={d => updateDraft('aiRecommendation', d)}
            openAiKey={openAiKey} 
            geminiKey={geminiKey}
            onSaveOpenAiKey={saveOpenAiKey} 
            onSaveGeminiKey={saveGeminiKey} 
            fields={adoFields}
            disabled={downstreamDisabled}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="md:col-span-1"><ReadinessRulesSection data={draftConfig.readiness} /></div>
            <div className="md:col-span-1"><EstimationRulesSection data={draftConfig.estimation} /></div>
            <div className="md:col-span-2"><GroupingRulesSection data={draftConfig.grouping} /></div>
          </div>
        </div>
        <div className="w-full xl:w-80 shrink-0">
          <SessionReviewPanel config={draftConfig} completeness={completeness} isDirty={isDirty} isValid={isValid} onSave={handleSave} onReset={handleReset} onTest={handleTestConnection} testStatus={connectionStatus} saveStatus={saveStatus} openAiKey={openAiKey} geminiKey={geminiKey} />
        </div>
      </div>
    </div>
  );
}
