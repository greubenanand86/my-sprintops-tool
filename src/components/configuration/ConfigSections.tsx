import React, { useState } from 'react';
import { AccordionCard } from '../ui/AccordionCard';
import { Input, Select, Toggle, SearchableSelect } from '../ui/FormControls';
import { ConnectionConfig } from '../../types/config';
import { Activity, RefreshCw, AlertCircle, ShieldCheck, Loader2, Info } from 'lucide-react';

interface SectionProps<T> {
  data: T;
  onChange?: (data: T) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}

interface AdoConnectionSectionProps extends SectionProps<ConnectionConfig> {
  status: 'idle' | 'testing' | 'success' | 'failure';
  errorMessage: string | null;
  onTest: () => void;
  onChange: (data: ConnectionConfig) => void;
}

export function AdoConnectionSection({ data, onChange, errors = {}, status, errorMessage, onTest }: AdoConnectionSectionProps) {
  const errorCount = Object.keys(errors).length;

  return (
    <AccordionCard title="Azure DevOps Connection" errorCount={errorCount}>
      <div className="flex flex-col gap-6">
        <div className="bg-background border border-border rounded-xl p-6 flex flex-col items-center text-center shadow-sm">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border-2 ${status === 'success' ? 'bg-success-bg text-success border-success/20' : 'bg-muted text-content-secondary border-border'}`}>
            {status === 'testing' ? <Loader2 size={32} className="animate-spin" /> : <ShieldCheck size={32} />}
          </div>
          <h3 className="text-base font-bold text-content-primary">
            {status === 'success' ? 'ADO Connection Active' : 'Azure DevOps Configuration'}
          </h3>
          <p className="text-sm text-content-secondary mt-1 mb-6 max-w-sm">
            SprintOps Console uses a server-side Personal Access Token (PAT) for all operations.
          </p>
          <button
            onClick={onTest}
            disabled={status === 'testing'}
            className="px-6 py-2 rounded-lg bg-primary text-primary-fg hover:bg-primary-hover transition-colors font-medium text-sm flex items-center gap-2 shadow-sm"
          >
            {status === 'testing' ? <Activity size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Test Server Connection
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Organization URL" placeholder="https://dev.azure.com/org" value={data.orgUrl} onChange={e => onChange({...data, orgUrl: e.target.value})} error={errors.orgUrl} helperText="The base URL of your Azure DevOps organization." />
          <Input label="Project Name" placeholder="MyProject" value={data.project} onChange={e => onChange({...data, project: e.target.value})} error={errors.project} helperText="The specific project within the organization." />
          <Input label="Team Name" placeholder="MyTeam" value={data.team} onChange={e => onChange({...data, team: e.target.value})} error={errors.team} helperText="The team context for iterations and boards." />
        </div>
      </div>
      
      {status === 'failure' && errorMessage && (
        <div className="mt-6 flex flex-col gap-2">
          <div className="text-sm text-danger-fg bg-danger-bg p-3 rounded-lg border border-danger/20 flex items-start gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        </div>
      )}
    </AccordionCard>
  );
}

export function IterationSettingsSection({ data, onChange, disabled, iterations, currentIteration, isLoading, error, onRetry }: any) {
  return (
    <AccordionCard title="Iteration Settings" disabled={disabled}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Toggle 
            label="Default to Current Sprint" 
            helperText="Automatically load the active sprint for the selected team." 
            checked={data.defaultCurrent} 
            onChange={e => onChange({...data, defaultCurrent: e.target.checked})} 
          />
          <Toggle 
            label="Allow Manual Sprint Selection" 
            helperText="Enable the sprint switcher in the top navigation bar." 
            checked={data.allowManual} 
            onChange={e => onChange({...data, allowManual: e.target.checked})} 
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-content-primary">Selected Sprint Path</label>
          <div className="relative">
            <select 
              value={data.selectedPath} 
              onChange={e => onChange({...data, selectedPath: e.target.value})}
              className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-input-text text-sm focus:ring-2 focus:ring-primary outline-none disabled:opacity-50"
              disabled={isLoading || iterations.length === 0}
            >
              <option value="">Select a sprint...</option>
              {iterations.map((iter: any) => (
                <option key={iter.path} value={iter.path}>{iter.name} ({iter.attributes.timeFrame})</option>
              ))}
            </select>
            {isLoading && <Loader2 size={16} className="absolute right-8 top-2.5 animate-spin text-content-secondary" />}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-danger font-medium mt-1">
              <AlertCircle size={14} />
              <span>{error}</span>
              <button onClick={onRetry} className="text-primary hover:underline ml-1">Retry</button>
            </div>
          )}
          {!error && currentIteration && data.defaultCurrent && (
            <p className="text-xs text-success font-medium mt-1 flex items-center gap-1">
              <ShieldCheck size={14} />
              Currently using: {currentIteration.name}
            </p>
          )}
        </div>
      </div>
    </AccordionCard>
  );
}

export function FieldMappingSection({ data, onChange, disabled, fields, isLoading, onRefresh, errors = {} }: any) {
  const fieldOptions = fields.map((f: any) => ({ label: f.name, value: f.referenceName, description: f.referenceName }));

  return (
    <AccordionCard title="Field Mappings" disabled={disabled} errorCount={Object.keys(errors).length}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-content-secondary max-w-md">Map Azure DevOps reference names to application fields. Use the search to find fields by name.</p>
          <button onClick={onRefresh} disabled={isLoading} className="text-xs font-bold text-primary flex items-center gap-1.5 hover:underline disabled:opacity-50">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh Fields
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableSelect label="Tags Field" value={data.tags} onChange={val => onChange({...data, tags: val})} options={fieldOptions} error={errors.tags} disabled={isLoading} />
          <SearchableSelect label="State Field" value={data.state} onChange={val => onChange({...data, state: val})} options={fieldOptions} error={errors.state} disabled={isLoading} />
          <SearchableSelect label="Original Estimate" value={data.originalEstimate} onChange={val => onChange({...data, originalEstimate: val})} options={fieldOptions} error={errors.originalEstimate} disabled={isLoading} />
          <SearchableSelect label="Remaining Work" value={data.remaining} onChange={val => onChange({...data, remaining: val})} options={fieldOptions} error={errors.remaining} disabled={isLoading} />
          <SearchableSelect label="Completed Work" value={data.completed} onChange={val => onChange({...data, completed: val})} options={fieldOptions} error={errors.completed} disabled={isLoading} />
          <SearchableSelect label="Iteration Path" value={data.iterationPath} onChange={val => onChange({...data, iterationPath: val})} options={fieldOptions} error={errors.iterationPath} disabled={isLoading} />
          <SearchableSelect label="Area Path" value={data.areaPath} onChange={val => onChange({...data, areaPath: val})} options={fieldOptions} error={errors.areaPath} disabled={isLoading} />
        </div>
      </div>
    </AccordionCard>
  );
}

export function AssigneeSettingsSection({ data, onChange, disabled, users, isLoading, errors = {} }: any) {
  const userOptions = users.map((u: any) => ({ label: u.displayName, value: u.uniqueName, description: u.uniqueName }));

  return (
    <AccordionCard title="Assignee Rules" disabled={disabled} errorCount={Object.keys(errors).length}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select 
            label="Dev Task Assignment" 
            value={data.devBehavior} 
            onChange={e => onChange({...data, devBehavior: e.target.value})}
            options={[{ label: 'Inherit from Parent', value: 'parent' }]} 
          />
          <SearchableSelect 
            label="QA/UAT/Post Default Assignee" 
            value={data.qaAssignee?.uniqueName || ''} 
            onChange={val => {
              const user = users.find((u: any) => u.uniqueName === val);
              onChange({...data, qaAssignee: user || null});
            }} 
            options={userOptions} 
            error={errors.qaAssignee}
            disabled={isLoading}
            placeholder="Search team members..."
          />
        </div>
      </div>
    </AccordionCard>
  );
}

export function TaskRulesSection({ data, onChange, disabled, errors = {} }: any) {
  return (
    <AccordionCard title="Task Creation Rules" disabled={disabled} errorCount={Object.keys(errors).length}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Dev Task Pattern" value={data.devPattern} onChange={e => onChange({...data, devPattern: e.target.value})} error={errors.devPattern} />
          <Input label="QA Task Pattern" value={data.qaPattern} onChange={e => onChange({...data, qaPattern: e.target.value})} error={errors.qaPattern} />
          <Input label="UAT Task Pattern" value={data.uatPattern} onChange={e => onChange({...data, uatPattern: e.target.value})} error={errors.uatPattern} />
          <Input label="Post-Deployment Pattern" value={data.postPattern} onChange={e => onChange({...data, postPattern: e.target.value})} error={errors.postPattern} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <Toggle label="Inherit Iteration" checked={data.inheritIteration} onChange={e => onChange({...data, inheritIteration: e.target.checked})} />
          <Toggle label="Inherit Area Path" checked={data.inheritArea} onChange={e => onChange({...data, inheritArea: e.target.checked})} />
          <Toggle label="Inherit Tags" checked={data.inheritTags} onChange={e => onChange({...data, inheritTags: e.target.checked})} />
          <Toggle label="Prevent Duplicates" checked={data.preventDuplicates} onChange={e => onChange({...data, preventDuplicates: e.target.checked})} />
        </div>
      </div>
    </AccordionCard>
  );
}

export function ReadinessRulesSection({ data }: any) {
  return (
    <AccordionCard title="Readiness Logic">
      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Target Parent State</span>
          <div className="px-3 py-2 bg-muted rounded-lg text-sm text-content-secondary border border-border">{data.parentState}</div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Required Gates</span>
          <div className="flex flex-wrap gap-2">
            {data.requiredClosedTasks.map((t: string) => (
              <span key={t} className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-bold uppercase">{t} Closed</span>
            ))}
            {data.deploymentLinkRequired && <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-bold uppercase">Linked</span>}
            <span className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-bold uppercase">Approved</span>
          </div>
        </div>
      </div>
    </AccordionCard>
  );
}

export function EstimationRulesSection({ data }: any) {
  return (
    <AccordionCard title="Estimation Rules">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-secondary">QA % of Dev</span>
            <span className="text-sm font-bold text-content-primary">{data.qaPercentOfDev}%</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-content-secondary">UAT % of Dev</span>
            <span className="text-sm font-bold text-content-primary">{data.uatPercentOfDev}%</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-content-secondary">Rounding Precision</span>
          <span className="text-sm font-bold text-content-primary">Nearest {data.roundToNearest}h</span>
        </div>
      </div>
    </AccordionCard>
  );
}

export function GroupingRulesSection({ data }: any) {
  return (
    <AccordionCard title="Grouping & Tabs">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-content-primary">Product Segments</span>
          <div className="flex flex-wrap gap-2">
            {data.productTabs.map((t: string) => (
              <span key={t} className="px-2.5 py-1 rounded-full bg-surface border border-border text-xs font-medium text-content-primary">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </AccordionCard>
  );
}

export function AiEstimationSection({ data, onChange, openAiKey, geminiKey, onSaveOpenAiKey, onSaveGeminiKey, fields, disabled }: any) {
  const [showKey, setShowKey] = useState(false);
  const fieldOptions = (fields || []).map((f: any) => ({ label: f.name, value: f.referenceName }));

  return (
    <AccordionCard title="AI Estimation (Optional)" disabled={disabled}>
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select 
            label="AI Provider" 
            value={data.provider} 
            onChange={e => onChange({...data, provider: e.target.value})}
            options={[
              { label: 'OpenAI (GPT-4o)', value: 'openai' },
              { label: 'Google Gemini (Pro)', value: 'gemini' }
            ]} 
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-content-primary">API Key</label>
            <div className="relative">
              <input 
                type={showKey ? 'text' : 'password'}
                value={data.provider === 'openai' ? openAiKey : geminiKey}
                onChange={e => data.provider === 'openai' ? onSaveOpenAiKey(e.target.value) : onSaveGeminiKey(e.target.value)}
                placeholder={`Enter ${data.provider === 'openai' ? 'OpenAI' : 'Gemini'} Key`}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-input-border bg-input-bg text-input-text text-sm focus:ring-2 focus:ring-primary outline-none"
              />
              <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-2.5 text-content-secondary hover:text-content-primary">
                {showKey ? <Activity size={16} /> : <Activity size={16} />}
              </button>
            </div>
            <p className="text-[10px] text-content-secondary italic">Stored in session memory only. Never saved to disk.</p>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold text-content-primary uppercase tracking-wider">Context Mapping</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SearchableSelect label="Acceptance Criteria Field" value={data.fieldMappings.acceptanceCriteria?.referenceName || ''} onChange={val => onChange({...data, fieldMappings: {...data.fieldMappings, acceptanceCriteria: { referenceName: val, displayName: fields.find((f: any) => f.referenceName === val)?.name || '' }}})} options={fieldOptions} placeholder="Select field..." />
            <SearchableSelect label="Repro Steps Field" value={data.fieldMappings.reproSteps?.referenceName || ''} onChange={val => onChange({...data, fieldMappings: {...data.fieldMappings, reproSteps: { referenceName: val, displayName: fields.find((f: any) => f.referenceName === val)?.name || '' }}})} options={fieldOptions} placeholder="Select field..." />
          </div>
          <Toggle label="Include Attachments" helperText="Send attachment metadata to AI for better context." checked={data.includeAttachments} onChange={e => onChange({...data, includeAttachments: e.target.checked})} />
        </div>
      </div>
    </AccordionCard>
  );
}
