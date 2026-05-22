import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Bug, FileText, Tag, AlertCircle, Loader2, GitMerge, Info, CheckCircle2, HelpCircle, Check, Activity, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { ParentWorkItem, TaskType, ChildWorkItem, RelatedWorkItem } from '../../types/adoModels';
import { SessionConfig } from '../../types/config';
import { TaskCell } from './TaskCell';
import { ReadinessMeter } from './ReadinessMeter';
import { LinkTaskModal } from './LinkTaskModal';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { WorkItemLink } from '../ui/WorkItemLink';
import { toArray } from '../../utils/arrayUtils';
import { getStateColorClass } from '../../utils/stateColors';
import { generateTaskTitle } from '../../utils/taskUtils';
import { isActionableMismatch, isLoadFailedChild, isTerminalState } from '../../utils/actionabilityUtils';
import { resolveReadinessDisplayStatus } from '../../utils/readinessUtils';
import { updateWorkItem, createTask, createLink, addComment } from '../../services/workItemsService';

interface ReadinessRowProps {
  item: ParentWorkItem;
  config: SessionConfig;
  onUpdate: (item: ParentWorkItem) => void;
  onRefresh?: () => void;
  deploymentTaskId?: string;
  isMismatchTab?: boolean;
}

export function ReadinessRow({ item, config, onUpdate, onRefresh, deploymentTaskId, isMismatchTab }: ReadinessRowProps) {
  const { showToast } = useToast();
  const { iterations } = useConfig();
  
  const [expanded, setExpanded] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [linkModalSlot, setLinkModalSlot] = useState<TaskType | null>(null);
  const [showAlignPrompt, setShowAlignPrompt] = useState(false);
  const [isAligning, setIsAligning] = useState(false);

  const stateClass = getStateColorClass(item.state);
  const parentSprintName = item.iterationPath.split('\\').pop() || 'Unknown';
  const status = resolveReadinessDisplayStatus(item);

  const { mismatchedChildren, eligibleChildren } = useMemo(() => {
    const mismatched = toArray(item.allChildren).filter(c => c.iterationPath !== item.iterationPath && !isLoadFailedChild(c));
    return {
      mismatchedChildren: mismatched,
      eligibleChildren: mismatched.filter(c => isActionableMismatch(c, item.iterationPath))
    };
  }, [item.allChildren, item.iterationPath]);

  const handleCreateTask = async (taskType: TaskType) => {
    const task = item.tasks[taskType];
    if (task.actionState === 'creating' || task.actionState === 'created') return;
    const patterns = { Dev: config.tasks.devPattern, QA: config.tasks.qaPattern, UAT: config.tasks.uatPattern, Post: config.tasks.postPattern };
    let title: string;
    try {
      title = generateTaskTitle(patterns[taskType], item.id, item.title);
    } catch (err: any) {
      setRowError(`Title generation failed: ${err.message}`);
      setExpanded(true);
      return;
    }
    onUpdate({ ...item, tasks: { ...item.tasks, [taskType]: { ...task, actionState: 'creating' } } });
    try {
      await createTask(config, {
        taskType, title, parentId: item.id,
        iterationPath: config.tasks.inheritIteration ? item.iterationPath : undefined,
        areaPath: config.tasks.inheritArea ? item.areaPath : undefined,
      });
      showToast(`${taskType} task created successfully`, 'success');
      onRefresh?.();
    } catch (err: any) {
      onUpdate({ ...item, tasks: { ...item.tasks, [taskType]: { ...task, actionState: 'failed' } } });
      setRowError(err.message || 'Failed to create task');
    }
  };

  const handleCreateLink = async () => {
    if (item.link.actionState === 'creating' || item.link.actionState === 'created') return;
    if (!deploymentTaskId) {
      showToast('Missing Deployment Task ID', 'warning');
      return;
    }
    onUpdate({ ...item, link: { ...item.link, actionState: 'creating' } });
    try {
      await createLink(config, item.id, parseInt(deploymentTaskId, 10));
      showToast('Deployment link created', 'success');
      onRefresh?.();
    } catch (err: any) {
      onUpdate({ ...item, link: { ...item.link, actionState: 'failed' } });
      setRowError(err.message || 'Failed to create link');
    }
  };

  const handleApprove = async () => {
    if (isApproving || item.approvalStatus === 'approved') return;
    setIsApproving(true);
    try {
      await addComment(config, item.id, 'Approved');
      showToast('Work item approved successfully', 'success');
      onRefresh?.();
    } catch (err: any) {
      setRowError(err.message || 'Failed to approve');
    } finally { setIsApproving(false); }
  };

  const handleBulkAlign = async () => {
    if (eligibleChildren.length === 0) return;
    setIsAligning(true);
    try {
      await Promise.all(eligibleChildren.map(child => 
        updateWorkItem(config, child.id, [{ op: 'add', path: `/fields/${config.mapping.iterationPath}`, value: item.iterationPath }])
      ));
      showToast(`Successfully aligned ${eligibleChildren.length} tasks.`, 'success');
      onRefresh?.();
    } catch (err: any) {
      setRowError(`Bulk alignment failed: ${err.message}`);
    } finally {
      setIsAligning(false);
      setShowAlignPrompt(false);
    }
  };

  const apprDisplay = useMemo(() => {
    if (isApproving) return { icon: <Loader2 size={16} className="animate-spin" />, className: 'bg-info-bg text-info-fg border-info/30', isActionable: false };
    if (item.approvalStatus === 'approved') return { icon: <CheckCircle2 size={16} />, className: 'bg-success-bg text-success-fg border-success/30', isActionable: false };
    if (item.approvalStatus === 'unknown') return { icon: <HelpCircle size={16} />, className: 'bg-warning-bg text-warning-fg border-warning/30', isActionable: false };
    return { icon: <Check size={16} />, className: 'bg-surface border border-dashed border-border text-content-secondary hover:bg-border/50 hover:text-content-primary cursor-pointer', isActionable: true };
  }, [isApproving, item.approvalStatus]);

  return (
    <>
      <div className="bg-surface border border-border rounded-xl shadow-sm overflow-hidden transition-all hover:border-primary/30">
        <div className="p-4 md:p-0">
          <div className="flex flex-col md:grid md:grid-cols-[40px_80px_minmax(200px,1fr)_100px_140px_50px_50px_50px_50px_50px_50px_220px] md:items-center gap-4 md:gap-2 md:px-4 md:py-3">
            <button onClick={() => setExpanded(!expanded)} className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-background text-content-secondary transition-colors">{expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</button>
            <div className="flex md:hidden justify-between items-start w-full">
              <div className="flex items-center gap-2">
                {item.type === 'Bug' ? <Bug size={16} className="text-danger" /> : <FileText size={16} className="text-primary" />}
                <WorkItemLink id={item.id} orgUrl={config.ado.orgUrl} project={config.ado.project} className="text-xs font-semibold text-content-secondary" />
              </div>
              <button onClick={() => setExpanded(!expanded)} className="p-1 rounded-md hover:bg-background text-content-secondary">{expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</button>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-sm font-medium text-content-secondary"><WorkItemLink id={item.id} orgUrl={config.ado.orgUrl} project={config.ado.project} showIcon /></div>
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="text-sm font-semibold text-content-primary truncate" title={item.title}>{item.title}</span>
              <div className="flex flex-wrap gap-1">{toArray(item.tags).map(tag => <span key={tag} className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-background border border-border text-content-secondary">{tag}</span>)}</div>
            </div>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-medium text-content-secondary">{item.type === 'Bug' ? <Bug size={14} className="text-danger" /> : <FileText size={14} className="text-primary" />}</div>
            <div className="flex items-center"><span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${stateClass} whitespace-nowrap`}>{item.state}</span></div>
            <div className="hidden md:flex justify-center"><button onClick={handleApprove} disabled={!apprDisplay.isActionable || isApproving} className={`w-8 h-8 rounded-md flex items-center justify-center ${apprDisplay.className}`}>{apprDisplay.icon}</button></div>
            <div className="hidden md:flex justify-center opacity-80"><TaskCell actionState={item.tasks.Dev.actionState} adoState={item.tasks.Dev.adoState} onClick={() => handleCreateTask('Dev')} onLinkExisting={() => setLinkModalSlot('Dev')} /></div>
            <div className="hidden md:flex justify-center opacity-80"><TaskCell actionState={item.tasks.QA.actionState} adoState={item.tasks.QA.adoState} onClick={() => handleCreateTask('QA')} onLinkExisting={() => setLinkModalSlot('QA')} /></div>
            <div className="hidden md:flex justify-center"><TaskCell actionState={item.tasks.UAT.actionState} adoState={item.tasks.UAT.adoState} onClick={() => handleCreateTask('UAT')} onLinkExisting={() => setLinkModalSlot('UAT')} /></div>
            <div className="hidden md:flex justify-center opacity-80"><TaskCell actionState={item.tasks.Post.actionState} adoState={item.tasks.Post.adoState} onClick={() => handleCreateTask('Post')} onLinkExisting={() => setLinkModalSlot('Post')} /></div>
            <div className="hidden md:flex justify-center"><TaskCell actionState={item.link.actionState} isLink onClick={handleCreateLink} /></div>
            <div className="mt-4 md:mt-0 md:ml-auto flex items-center justify-end gap-3 w-full md:w-auto"><div className="w-[130px] shrink-0"><ReadinessMeter item={item} /></div></div>
          </div>
        </div>
        {rowError && (
          <div className="bg-danger-bg border-t border-danger/20 p-3 text-xs text-danger-fg flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={14} className="shrink-0" /><span className="font-medium">{rowError}</span><button onClick={() => setRowError(null)} className="ml-auto hover:underline font-semibold">Dismiss</button>
          </div>
        )}
        {expanded && (
          <div className="bg-muted/30 border-t border-border p-4 md:px-14 md:py-4 text-sm animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-content-primary flex items-center gap-2 uppercase tracking-wider text-[10px]">Core Tracking & Links</h4>
              <div className="flex items-center gap-3">
                {mismatchedChildren.length > 0 && !showAlignPrompt && (
                  <button onClick={() => setShowAlignPrompt(true)} disabled={eligibleChildren.length === 0} className="flex items-center gap-1.5 text-xs font-medium text-info-fg bg-info-bg border border-info/20 hover:bg-info/20 px-2.5 py-1 rounded-md transition-colors">
                    <GitMerge size={14} /> Align Tasks to Parent Sprint
                  </button>
                )}
                <span className="text-xs text-content-secondary bg-surface border border-border px-2.5 py-1 rounded-md">Parent Sprint: <strong className="text-content-primary ml-1">{parentSprintName}</strong></span>
              </div>
            </div>
            {showAlignPrompt && (
              <div className="mb-6 p-4 bg-info-bg border border-info/30 rounded-xl animate-in fade-in">
                <h5 className="text-sm font-bold text-info-fg mb-2">Align Child Tasks</h5>
                <p className="text-sm text-info-fg mb-4">Update iteration path of {eligibleChildren.length} actionable tasks to match parent.</p>
                <div className="flex items-center gap-3">
                  <button onClick={handleBulkAlign} disabled={isAligning} className="px-4 py-2 bg-primary text-primary-fg text-sm font-medium rounded-lg hover:bg-primary-hover flex items-center gap-2">{isAligning && <Loader2 size={16} className="animate-spin" />} Confirm</button>
                  <button onClick={() => setShowAlignPrompt(false)} disabled={isAligning} className="px-4 py-2 bg-surface text-info-fg border border-info/30 text-sm font-medium rounded-lg">Cancel</button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mb-2 block">Parent Item</span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0"><FileText size={18} /></div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-content-primary">#{item.id}</p>
                    <p className="text-xs text-content-secondary truncate">{item.assignedTo || 'Unassigned'}</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mb-2 block">Child Work Items</span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-info-bg flex items-center justify-center text-info-fg shrink-0"><CheckCircle2 size={18} /></div>
                  <div>
                    <p className="text-sm font-bold text-content-primary">{item.allChildren.length} Total</p>
                    <p className="text-xs text-content-secondary">{item.allChildren.filter(c => c.state === 'Closed').length} Closed</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mb-2 block">Related Items</span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-secondary-fg shrink-0"><Tag size={18} /></div>
                  <div>
                    <p className="text-sm font-bold text-content-primary">{item.relatedItems.length} Links</p>
                    <p className="text-xs text-content-secondary">{item.relatedItems.filter(r => r.isUnavailableRelation).length} Unavailable</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-xl p-4 shadow-sm">
                <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider mb-2 block">Deployment Link</span>
                {item.link.actionState === 'created' ? (
                  <a href={item.link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                    <LinkIcon size={16} />
                    <span className="text-sm font-bold truncate">Open Task</span>
                    <ExternalLink size={12} className="shrink-0" />
                  </a>
                ) : (
                  <div className="flex items-center gap-2 text-content-muted italic text-sm">
                    <AlertCircle size={16} />
                    <span>Not linked</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {linkModalSlot && <LinkTaskModal isOpen={true} onClose={() => setLinkModalSlot(null)} config={config} parentItem={item} slot={linkModalSlot} onSuccess={() => onRefresh?.()} />}
    </>
  );
}
