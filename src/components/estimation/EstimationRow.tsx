import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Bug, FileText, RotateCcw, Calculator, Save, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { EstimationItem, TaskEstimate, EstimationTaskType } from '../../types/estimation';
import { SessionConfig } from '../../types/config';
import { updateWorkItem } from '../../services/workItemsService';
import { WorkItemLink } from '../ui/WorkItemLink';
import { useToast } from '../../contexts/ToastContext';
import { toArray } from '../../utils/arrayUtils';
import { getStateColorClass } from '../../utils/stateColors';

interface EstimationRowProps {
  item: EstimationItem;
  config: SessionConfig;
  onUpdate: (item: EstimationItem) => void;
}

export function EstimationRow({ item, config, onUpdate }: EstimationRowProps) {
  const { showToast } = useToast();

  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const estimationConfig = config.estimation;
  const stateClass = getStateColorClass(item.state);

  const calculateEstimate = (devOriginal: number | '', percentage: number) => {
    if (devOriginal === '' || isNaN(devOriginal)) return '';
    const raw = devOriginal * (percentage / 100);
    const invRounding = 1 / estimationConfig.roundToNearest;
    return Math.round(raw * invRounding) / invRounding;
  };

  const handleTaskChange = (taskType: EstimationTaskType, field: keyof TaskEstimate, val: number | '') => {
    const newTasks = { ...item.tasks };
    const updatedTask = { ...newTasks[taskType], [field]: val };
    if (field === 'original' && taskType !== 'Dev') updatedTask.isOverridden = true;
    
    if (taskType === 'Dev' && field === 'original') {
      if (!newTasks.QA.isOverridden) newTasks.QA.original = calculateEstimate(val, estimationConfig.qaPercentOfDev);
      if (!newTasks.UAT.isOverridden) newTasks.UAT.original = calculateEstimate(val, estimationConfig.uatPercentOfDev);
    }

    newTasks[taskType] = updatedTask;
    onUpdate({ ...item, tasks: newTasks });
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      const tasksToUpdate = (['Dev', 'QA', 'UAT'] as const)
        .map(type => ({ type, task: item.tasks[type] }))
        .filter(t => t.task && t.task.id);

      if (tasksToUpdate.length === 0) {
        throw new Error("No tasks found to save estimates.");
      }

      await Promise.all(tasksToUpdate.map(async ({ task }) => {
        const patchDocument = [
          { op: 'add', path: `/fields/${config.mapping.originalEstimate}`, value: task.original === '' ? '' : task.original },
          { op: 'add', path: `/fields/${config.mapping.remaining}`, value: task.remaining === '' ? '' : task.remaining },
          { op: 'add', path: `/fields/${config.mapping.completed}`, value: task.completed === '' ? '' : task.completed }
        ];
        return updateWorkItem(config, task.id!, patchDocument);
      }));

      setSaveStatus('success');
      showToast('Estimates saved successfully', 'success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err.message || 'Failed to save estimates.');
      showToast('Failed to save estimates', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all hover:border-primary/30">
      <div className="p-4 md:p-0 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex flex-col md:grid md:grid-cols-[40px_80px_minmax(200px,1fr)_100px_120px_100px_100px] md:items-center gap-4 md:gap-2 md:px-4 md:py-3">
          <div className="hidden md:flex items-center justify-center w-8 h-8 text-content-secondary">{expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
          <div className="flex md:hidden justify-between items-start w-full">
            <div className="flex items-center gap-2">
              {item.type === 'Bug' ? <Bug size={16} className="text-danger" /> : <FileText size={16} className="text-primary" />}
              <WorkItemLink id={item.id} orgUrl={config.ado.orgUrl} project={config.ado.project} className="text-xs font-semibold text-content-secondary" />
            </div>
            <div className="text-content-secondary">{expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-sm font-medium text-content-secondary"><WorkItemLink id={item.id} orgUrl={config.ado.orgUrl} project={config.ado.project} showIcon /></div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-content-primary truncate" title={item.title}>{item.title}</span>
            <div className="flex flex-wrap gap-1">{toArray(item.tags).map(tag => <span key={tag} className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-background border border-border text-content-secondary">{tag}</span>)}</div>
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-content-secondary">{item.type === 'Bug' ? <Bug size={14} className="text-danger" /> : <FileText size={14} className="text-primary" />}</div>
          <div className="flex items-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${stateClass} whitespace-nowrap`}>{item.state}</span></div>
          <div className="hidden md:flex flex-col items-end"><span className="text-[10px] text-content-secondary font-medium uppercase tracking-wider">Total Orig</span><span className="text-sm font-bold text-content-primary">{Object.values(item.tasks).reduce((s, t) => s + (Number(t.original) || 0), 0)}</span></div>
          <div className="hidden md:flex flex-col items-end"><span className="text-[10px] text-content-secondary font-medium uppercase tracking-wider">Total Rem</span><span className="text-sm font-bold text-primary">{Object.values(item.tasks).reduce((s, t) => s + (Number(t.remaining) || 0), 0)}</span></div>
        </div>
      </div>
      {expanded && (
        <div className="bg-muted/30 border-t border-border p-4 md:px-14 md:py-4 animate-in slide-in-from-top-2 duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="text-xs text-content-secondary font-semibold uppercase tracking-wider border-b border-border">
                <tr><th className="pb-3 pl-2">Task Type</th><th className="pb-3 w-32">Original Est.</th><th className="pb-3 w-32">Remaining</th><th className="pb-3 w-32">Completed</th><th className="pb-3 w-32 text-center">Auto-Calc</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(['Dev', 'QA', 'UAT'] as const).map(taskType => {
                  const task = item.tasks[taskType];
                  const disabled = !task.id || isSaving;
                  return (
                    <tr key={taskType} className="hover:bg-muted/50 transition-colors">
                      <td className="py-3 pl-2 font-medium text-content-primary">{taskType} Task {task.id && <WorkItemLink id={task.id} orgUrl={config.ado.orgUrl} project={config.ado.project} className="text-content-secondary text-xs font-normal" />}</td>
                      <td className="py-3 pr-4"><input type="number" step={estimationConfig.roundToNearest} min="0" disabled={disabled} value={task.original} onChange={(e) => handleTaskChange(taskType, 'original', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-24 px-2.5 py-1.5 text-sm border rounded-lg bg-input-bg text-input-text focus:ring-2 focus:ring-primary outline-none" /></td>
                      <td className="py-3 pr-4"><input type="number" step={estimationConfig.roundToNearest} min="0" disabled={disabled} value={task.remaining} onChange={(e) => handleTaskChange(taskType, 'remaining', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-24 px-2.5 py-1.5 text-sm border border-input-border rounded-lg bg-input-bg text-input-text focus:ring-2 focus:ring-primary outline-none" /></td>
                      <td className="py-3 pr-4"><input type="number" step={estimationConfig.roundToNearest} min="0" disabled={disabled} value={task.completed} onChange={(e) => handleTaskChange(taskType, 'completed', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-24 px-2.5 py-1.5 text-sm border border-input-border rounded-lg bg-input-bg text-input-text focus:ring-2 focus:ring-primary outline-none" /></td>
                      <td className="py-3 text-center">{taskType === 'Dev' ? <span className="text-xs italic">Source</span> : task.isOverridden ? <button onClick={() => handleTaskChange(taskType, 'original', '')} className="text-xs text-warning-fg bg-warning-bg px-2 py-1 rounded">Reset</button> : <span className="text-xs text-success-fg bg-success-bg px-2 py-1 rounded">Auto</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-end gap-4 border-t border-border pt-4">
            {saveStatus === 'success' && <div className="text-xs text-success-fg font-medium bg-success-bg px-3 py-1.5 rounded-lg border border-success/20"><CheckCircle2 size={14} className="inline mr-1" /> Saved to ADO</div>}
            <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-primary text-primary-fg text-sm font-medium rounded-lg hover:bg-primary-hover flex items-center gap-2">{isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Estimates</button>
          </div>
        </div>
      )}
    </div>
  );
}
