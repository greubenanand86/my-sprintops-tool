import React from 'react';
import { SessionConfig } from '../../types/config';
import { CheckCircle2, AlertCircle, Save, RotateCcw, ShieldCheck, Loader2 } from 'lucide-react';
import { SectionCard } from '../ui/SectionCard';

interface SessionReviewPanelProps {
  config: SessionConfig;
  completeness: number;
  isDirty: boolean;
  isValid: boolean;
  onSave: () => void;
  onReset: () => void;
  onTest: () => void;
  testStatus: 'idle' | 'testing' | 'success' | 'failure';
  saveStatus: 'idle' | 'success';
  openAiKey: string;
  geminiKey: string;
}

function SummaryItem({ label, value, valid }: { label: string; value: React.ReactNode; valid?: boolean }) {
  return (
    <div className="flex flex-col py-2.5 border-b border-border last:border-0">
      <span className="text-xs font-medium text-content-secondary">{label}</span>
      <div className="flex items-center gap-2 mt-1">
        {valid === true && <CheckCircle2 size={14} className="text-success shrink-0" />}
        {valid === false && <AlertCircle size={14} className="text-danger shrink-0" />}
        {valid === undefined && <div className="w-3.5 h-3.5 rounded-full border-2 border-border shrink-0" />}
        <span className="text-sm text-content-primary truncate font-medium">{value}</span>
      </div>
    </div>
  );
}

export function SessionReviewPanel({
  config,
  completeness,
  isDirty,
  isValid,
  onSave,
  onReset,
  onTest,
  testStatus,
  saveStatus,
  openAiKey,
  geminiKey
}: SessionReviewPanelProps) {
  const mappedCount = Object.values(config.mapping).filter(Boolean).length;
  const totalMappingFields = 7;

  const activeKey = config.aiRecommendation.provider === 'openai' ? openAiKey : geminiKey;
  const providerName = config.aiRecommendation.provider === 'openai' ? 'OpenAI' : 'Gemini';

  return (
    <SectionCard className="sticky top-24 flex flex-col h-[calc(100vh-8rem)] overflow-y-auto scrollbar-hide">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-content-primary tracking-tight">Session Review</h2>
        {isDirty ? (
          <span className="flex items-center gap-1.5 text-xs font-medium text-warning-fg bg-warning-bg px-2 py-1 rounded-md border border-warning/20">
            <AlertCircle size={14} /> Unsaved
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-medium text-content-secondary bg-background px-2 py-1 rounded-md border border-border">
            Up to date
          </span>
        )}
      </div>

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-content-primary">Completeness</span>
          <span className="text-sm font-bold text-content-primary">{completeness}%</span>
        </div>
        <div className="h-2.5 w-full bg-background rounded-full overflow-hidden border border-border/50">
          <div 
            className={`h-full transition-all duration-500 ${completeness === 100 ? 'bg-success' : 'bg-primary'}`} 
            style={{ width: `${completeness}%` }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-1 mb-6">
        <SummaryItem 
          label="ADO Connection" 
          value={`${config.ado.project} / ${config.ado.team}`} 
          valid={testStatus === 'success'} 
        />
        <SummaryItem 
          label="Iteration Mode" 
          value={config.iteration.defaultCurrent ? 'Auto (Current Sprint)' : `Manual (${config.iteration.selectedPath || 'None'})`} 
          valid={config.iteration.defaultCurrent || !!config.iteration.selectedPath} 
        />
        <SummaryItem 
          label="Field Mappings" 
          value={`${mappedCount} of ${totalMappingFields} Mapped`} 
          valid={mappedCount === totalMappingFields} 
        />
        <SummaryItem 
          label="QA / UAT / Post Assignee" 
          value={config.assignee.qaAssignee?.displayName || 'Unassigned'} 
          valid={!!config.assignee.qaAssignee} 
        />
        <SummaryItem 
          label="Task Creation Rules" 
          value="4 Patterns Configured" 
          valid={!!(config.tasks.devPattern && config.tasks.qaPattern && config.tasks.uatPattern && config.tasks.postPattern)} 
        />
        <SummaryItem 
          label={`AI Estimation (${providerName})`} 
          value={activeKey ? 'Configured (Session Only)' : 'Not Configured (Optional)'} 
          valid={activeKey ? true : undefined} 
        />
      </div>

      <div className="space-y-3 pt-4 border-t border-border mt-auto">
        {testStatus === 'success' && (
          <div className="text-xs font-medium text-success-fg bg-success-bg p-2.5 rounded-lg flex items-center gap-2 border border-success/20 animate-in fade-in">
            <CheckCircle2 size={16} /> Server connection active!
          </div>
        )}
        {testStatus === 'failure' && (
          <div className="text-xs font-medium text-danger-fg bg-danger-bg p-2.5 rounded-lg flex items-center gap-2 border border-danger/20 animate-in fade-in">
            <AlertCircle size={16} /> Server connection failed.
          </div>
        )}
        {saveStatus === 'success' && (
          <div className="text-xs font-medium text-success-fg bg-success-bg p-2.5 rounded-lg flex items-center gap-2 border border-success/20 animate-in fade-in">
            <CheckCircle2 size={16} /> Session configuration saved!
          </div>
        )}

        <button
          onClick={onTest}
          disabled={testStatus === 'testing'}
          className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border text-content-primary hover:bg-background transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          Test Server Readiness
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2.5 rounded-xl bg-surface border border-border text-content-secondary hover:text-danger-fg hover:bg-danger-bg hover:border-danger/30 transition-colors font-medium text-sm flex items-center justify-center gap-2"
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={!isValid || !isDirty}
            className="px-4 py-2.5 rounded-xl bg-primary text-primary-fg hover:bg-primary-hover transition-colors font-medium text-sm disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>
    </SectionCard>
  );
}
