import React, { useState } from 'react';
import { X, Link as LinkIcon, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { SessionConfig } from '../../types/config';
import { ReleaseTask } from '../../types/releaseModels';
import { linkWorkItemsToRelease } from '../../services/releaseService';
import { useToast } from '../../contexts/ToastContext';

interface LinkWorkItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SessionConfig;
  releaseTask: ReleaseTask;
  onSuccess?: () => void;
}

export function LinkWorkItemsModal({ isOpen, onClose, config, releaseTask, onSuccess }: LinkWorkItemsModalProps) {
  const { showToast } = useToast();
  const [inputIds, setInputIds] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [results, setResults] = useState<{succeeded: number[], failed: string[]} | null>(null);

  if (!isOpen) return null;

  const handleLink = async () => {
    const ids = inputIds.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    const uniqueIds = Array.from(new Set(ids));
    if (uniqueIds.length === 0) {
      showToast('Please enter valid work item IDs', 'warning');
      return;
    }

    setIsLinking(true);
    setResults(null);
    try {
      const res = await linkWorkItemsToRelease(config, releaseTask.id, uniqueIds);
      setResults(res);
      if (res.succeeded.length > 0) onSuccess?.();
    } catch (err: any) {
      showToast(err.message || 'Failed to link items', 'error');
    } finally {setIsLinking(false);}
  };

  const handleClose = () => {
    setInputIds('');
    setResults(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-info-bg text-info-fg flex items-center justify-center"><LinkIcon size={18} /></div><div><h2 className="text-lg font-bold text-content-primary leading-tight">Link Work Items</h2><p className="text-xs text-content-secondary">Add items to Release #{releaseTask.id}</p></div></div>
          <button onClick={handleClose} disabled={isLinking} className="p-2 rounded-lg hover:bg-background text-content-secondary transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 flex flex-col gap-4">
          {!results ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-content-primary">Work Item IDs</label>
              <textarea value={inputIds} onChange={(e) => setInputIds(e.target.value)} disabled={isLinking} placeholder="e.g. 12345, 12346" rows={4} className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-input-text text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all resize-y disabled:opacity-50 disabled:bg-muted" />
              <span className="text-xs text-content-secondary">Enter multiple IDs separated by commas or spaces.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-content-primary">Results</h3>
              {results.succeeded.length > 0 && <div className="bg-success-bg border border-success/20 p-3 rounded-lg flex flex-col gap-1"><div className="flex items-center gap-2 text-success-fg font-bold text-sm"><CheckCircle2 size={16} /> Successfully Linked ({results.succeeded.length})</div><span className="text-xs text-success-fg">{results.succeeded.join(', ')}</span></div>}
              {results.failed.length > 0 && <div className="bg-danger-bg border border-danger/20 p-3 rounded-lg flex flex-col gap-2"><div className="flex items-center gap-2 text-danger-fg font-bold text-sm"><AlertCircle size={16} /> Failed to Link ({results.failed.length})</div><ul className="text-xs text-danger-fg list-disc pl-4 space-y-1">{results.failed.map((err, i) => <li key={i}>{err}</li>)}</ul></div>}
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3 shrink-0">
          {results ? <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-medium rounded-lg transition-colors bg-surface border border-border text-content-primary hover:bg-background shadow-sm">Close</button> : <><button type="button" onClick={handleClose} disabled={isLinking} className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors">Cancel</button><button type="button" onClick={handleLink} disabled={isLinking || !inputIds.trim()} className="px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50">{isLinking ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />} Link Items</button></>}
        </div>
      </div>
    </div>
  );
}
