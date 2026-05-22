import React, { useState } from 'react';
import { X, Loader2, Search, AlertCircle, FileText, CheckCircle2, Lock, Info } from 'lucide-react';
import { SessionConfig } from '../../types/config';
import { validateExistingTask, linkExistingTask } from '../../services/workItemsService';
import { ParentWorkItem, TaskType } from '../../types/adoModels';
import { useToast } from '../../contexts/ToastContext';
import { getStateColorClass } from '../../utils/stateColors';

interface LinkTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SessionConfig;
  parentItem: ParentWorkItem;
  slot: TaskType;
  onSuccess: (taskDetails: any) => void;
}

export function LinkTaskModal({ isOpen, onClose, config, parentItem, slot, onSuccess }: LinkTaskModalProps) {
  const { showToast } = useToast();
  const [taskId, setTaskId] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isReparentBlocked = preview?.parentId && preview.parentId !== parentItem.id;
  const isAlreadyChild = preview?.parentId === parentItem.id;
  const targetTag = `SprintOps:${slot === 'Post' ? 'POST_DEPLOYMENT' : slot.toUpperCase()}`;
  const currentTags = preview?.tags ? preview.tags.split(';').map((t: string) => t.trim()) : [];
  const isAlreadyClassified = currentTags.includes(targetTag);
  const isFullyConfigured = isAlreadyChild && isAlreadyClassified;

  const handleValidate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!taskId.trim()) return;
    setIsValidating(true);
    setError(null);
    try {
      const data = await validateExistingTask(config, parseInt(taskId.trim(), 10));
      setPreview(data);
    } catch (err: any) {
      setError(err.message || 'Failed to validate task');
    } finally {setIsValidating(false);}
  };

  const handleLink = async () => {
    if (!preview || isReparentBlocked || isFullyConfigured) return;
    setIsLinking(true);
    setError(null);
    try {
      await linkExistingTask(config, parentItem.id, preview.id, slot === 'Post' ? 'post_deployment' : slot.toLowerCase());
      showToast(`${slot} task linked successfully`, 'success');
      onSuccess(preview);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to link task');
      showToast('Failed to link task', 'error');
    } finally {setIsLinking(false);}
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div><h2 className="text-lg font-bold text-content-primary">Link Existing Task</h2><p className="text-xs text-content-secondary mt-0.5">Target Slot: <strong className="text-primary">{slot}</strong></p></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-background text-content-secondary transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-6">
          <form onSubmit={handleValidate} className="flex flex-col gap-2">
            <label className="text-sm font-medium text-content-primary">Task Work Item ID</label>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input type="text" placeholder="e.g. 12345" value={taskId} onChange={(e) => setTaskId(e.target.value.replace(/\D/g, ''))} className="w-full pl-10 pr-4 py-2.5 text-sm border border-input-border rounded-lg bg-input-bg text-input-text focus:ring-2 focus:ring-primary outline-none" autoFocus />
                <Search size={16} className="absolute left-3 top-3 text-content-secondary" />
              </div>
              <button type="submit" disabled={!taskId || isValidating} className="px-4 py-2.5 bg-secondary text-secondary-fg text-sm font-medium rounded-lg hover:bg-secondary-hover disabled:opacity-50 transition-colors flex items-center gap-2 min-w-[100px] justify-center">{isValidating ? <Loader2 size={16} className="animate-spin" /> : 'Preview'}</button>
            </div>
          </form>
          {error && <div className="bg-danger-bg border border-danger/20 text-danger-fg px-4 py-3 rounded-lg flex items-start gap-3 text-sm"><AlertCircle size={16} className="shrink-0 mt-0.5" /><span className="font-medium">{error}</span></div>}
          {preview && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-2 duration-300">
              <div className="bg-background border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2"><FileText size={16} className="text-primary" /><span className="text-sm font-bold text-content-primary">#{preview.id}</span></div><span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getStateColorClass(preview.state)}`}>{preview.state}</span></div>
                <h3 className="text-sm font-medium text-content-primary mb-3 leading-snug">{preview.title}</h3>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs"><div className="flex flex-col gap-0.5"><span className="text-content-secondary font-medium">Iteration</span><span className="text-content-primary truncate">{preview.iterationPath?.split('\\').pop() || 'Unassigned'}</span></div><div className="flex flex-col gap-0.5"><span className="text-content-secondary font-medium">Assigned To</span><span className="text-content-primary truncate">{preview.assignedTo}</span></div><div className="flex flex-col gap-0.5 col-span-2"><span className="text-content-secondary font-medium">Current Parent</span><span className="text-content-primary">{preview.parentId ? `#${preview.parentId}` : <span className="italic text-content-muted">None</span>}</span></div></div>
              </div>
              {isReparentBlocked && <div className="bg-danger-bg border border-danger/30 p-4 rounded-xl flex flex-col gap-2"><div className="flex items-center gap-2 text-danger-fg font-bold text-sm"><Lock size={16} /> Reparenting Blocked</div><p className="text-sm text-danger-fg">This task is already parented to work item #{preview.parentId}.</p></div>}
              {isFullyConfigured && <div className="bg-success-bg border border-success/30 p-4 rounded-xl flex flex-col gap-2"><div className="flex items-center gap-2 text-success-fg font-bold text-sm"><CheckCircle2 size={16} /> Already Configured</div><p className="text-sm text-success-fg">This task is already correctly linked and classified.</p></div>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={isLinking} className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors">Cancel</button>
          <button onClick={handleLink} disabled={!preview || isLinking || isReparentBlocked || isFullyConfigured} className="px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 bg-primary text-primary-fg hover:bg-primary-hover">{isLinking ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{isFullyConfigured ? 'Already Linked' : 'Confirm Link'}</button>
        </div>
      </div>
    </div>
  );
}
