import React, { useState, useMemo, useEffect } from 'react';
import { X, Rocket, Tag, GitBranch, Sparkles, FileText, Info, Loader2 } from 'lucide-react';
import { SessionConfig } from '../../types/config';
import { Product, ReleaseType, ReleaseTask } from '../../types/releaseModels';
import { Input, Select } from '../ui/FormControls';
import { compareVersions, incrementVersion } from '../../utils/releaseUtils';
import { createReleaseTask } from '../../services/releaseService';
import { useToast } from '../../contexts/ToastContext';

interface CreateReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SessionConfig;
  existingTasks: ReleaseTask[];
  onSuccess?: () => void;
}

export function CreateReleaseModal({ isOpen, onClose, config, existingTasks, onSuccess }: CreateReleaseModalProps) {
  const { showToast } = useToast();
  const [product, setProduct] = useState<Product>('Learner Wallet');
  const [releaseType, setReleaseType] = useState<ReleaseType>('Sprint Release');
  const [version, setVersion] = useState<string>('');
  const [areaPath, setAreaPath] = useState<string>(config.ado.project);
  const [iterationPath, setIterationPath] = useState<string>(config.iteration.selectedPath);
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [description, setDescription] = useState<string>('Release notes and deployment instructions go here...');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sprintName = useMemo(() => iterationPath.split('\\').pop() || 'Unknown Sprint', [iterationPath]);

  const titlePreview = useMemo(() => {
    const prefixMap: Record<string, string> = {
      'Learner Wallet': 'LW',
      'Edlusion': 'ED',
      'NCSI': 'NCSI',
      'Unknown/Unmapped': 'UNK'
    };
    const typeMap: Record<string, string> = {
      'Sprint Release': 'Production Deployment',
      'Hotfix': 'Hotfix Deployment'
    };

    const prefix = prefixMap[product] || 'UNK';
    const typeStr = typeMap[releaseType] || 'Deployment';
    
    return `${prefix} ${version || '[Version]'} - ${typeStr} - ${sprintName}`;
  }, [product, releaseType, version, sprintName]);

  // Version Assistant Logic
  const versionAssistant = useMemo(() => {
    const productTasks = existingTasks.filter(t => t.product === product && t.version);
    
    const regularVersions = productTasks.filter(t => t.type === 'Sprint Release').map(t => t.version!);
    const hotfixVersions = productTasks.filter(t => t.type === 'Hotfix').map(t => t.version!);
    
    const lastRegular = regularVersions.sort(compareVersions).pop() || 'None';
    const latestHotfix = hotfixVersions.sort(compareVersions).pop() || 'None';
    
    let baseForSuggestion = '1.0.0';
    if (releaseType === 'Sprint Release') {
      if (lastRegular !== 'None') baseForSuggestion = lastRegular;
    } else {
      // For hotfix, we want the absolute latest version (regular or hotfix) to base it off
      const allVersions = [...regularVersions, ...hotfixVersions].sort(compareVersions);
      if (allVersions.length > 0) baseForSuggestion = allVersions.pop()!;
    }
    
    const suggestedNext = lastRegular === 'None' && latestHotfix === 'None' 
      ? (releaseType === 'Sprint Release' ? '1.0.0' : '1.0.0.1')
      : incrementVersion(baseForSuggestion, releaseType);

    return { lastRegular, latestHotfix, suggestedNext };
  }, [existingTasks, product, releaseType]);

  // Auto-update version input when product or type changes, to be helpful
  useEffect(() => {
    if (isOpen) {
      setVersion(versionAssistant.suggestedNext);
    }
  }, [product, releaseType, versionAssistant.suggestedNext, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const tags = ['Release task', product, releaseType];
    if (version) tags.push(`v${version}`);

    try {
      setIsSubmitting(true);
      await createReleaseTask(config, {
        title: titlePreview,
        description,
        iterationPath,
        areaPath,
        assignedTo,
        tags
      });
      
      showToast('Release task created successfully', 'success');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to create release task', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Rocket size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-content-primary leading-tight">Create Release Task</h2>
              <p className="text-xs text-content-secondary">Generate a standardized release work item in Azure DevOps</p>
            </div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 rounded-lg hover:bg-background text-content-secondary transition-colors disabled:opacity-50">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-8">
          
          {/* Form Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              label="Product"
              value={product}
              onChange={(e) => setProduct(e.target.value as Product)}
              disabled={isSubmitting}
              options={[
                { label: 'Learner Wallet', value: 'Learner Wallet' },
                { label: 'Edlusion', value: 'Edlusion' },
                { label: 'NCSI', value: 'NCSI' }
              ]}
            />
            <Select
              label="Release Type"
              value={releaseType}
              onChange={(e) => setReleaseType(e.target.value as ReleaseType)}
              disabled={isSubmitting}
              options={[
                { label: 'Sprint Release', value: 'Sprint Release' },
                { label: 'Hotfix', value: 'Hotfix' }
              ]}
            />

            {/* Version & Assistant */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-medium text-content-primary">Version</label>
              <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="w-full md:w-1/3">
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="e.g. 4.8.9"
                    className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-input-text text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all disabled:opacity-50 disabled:bg-muted"
                  />
                </div>
                <div className="w-full md:w-2/3 bg-info-bg/50 border border-info/20 rounded-lg p-3 flex items-start gap-3">
                  <Sparkles size={16} className="text-info-fg shrink-0 mt-0.5" />
                  <div className="flex flex-col w-full">
                    <span className="text-xs font-bold text-info-fg mb-1">Version Assistant</span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col">
                        <span className="text-content-secondary">Last Regular:</span>
                        <span className={`font-medium ${versionAssistant.lastRegular === 'None' ? 'text-content-muted italic' : 'text-content-primary'}`}>
                          {versionAssistant.lastRegular}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-content-secondary">Latest Hotfix:</span>
                        <span className={`font-medium ${versionAssistant.latestHotfix === 'None' ? 'text-content-muted italic' : 'text-content-primary'}`}>
                          {versionAssistant.latestHotfix}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-info/10 flex items-center justify-between">
                      <span className="text-xs text-content-secondary">Suggested Next: <strong className="text-info-fg">{versionAssistant.suggestedNext}</strong></span>
                      <button 
                        type="button"
                        onClick={() => setVersion(versionAssistant.suggestedNext)}
                        disabled={isSubmitting}
                        className="text-[10px] font-bold uppercase tracking-wider bg-info text-primary-fg px-2 py-1 rounded hover:bg-info/90 transition-colors disabled:opacity-50"
                      >
                        Use Suggested
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Input
              label="Iteration Path (Sprint)"
              value={iterationPath}
              onChange={(e) => setIterationPath(e.target.value)}
              disabled={isSubmitting}
              helperText="Defaults to your globally selected sprint."
            />
            <Input
              label="Area Path"
              value={areaPath}
              onChange={(e) => setAreaPath(e.target.value)}
              disabled={isSubmitting}
            />
            <Input
              label="Assigned To"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Jane Doe"
              helperText="Leave blank to create unassigned."
            />
          </div>

          {/* Preview Section */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold text-content-primary flex items-center gap-2 border-b border-border pb-2">
              <FileText size={16} className="text-content-secondary" />
              Work Item Preview
            </h3>
            
            <div className="bg-background border border-border rounded-xl p-4 shadow-inner flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Generated Title</span>
                <span className="text-lg font-bold text-content-primary">{titlePreview}</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-content-secondary uppercase tracking-wider">Required Tags</span>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
                    <Tag size={12} /> Release task
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border text-xs font-medium text-content-secondary">
                    <Tag size={12} /> {product}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border text-xs font-medium text-content-secondary">
                    <Tag size={12} /> {releaseType}
                  </span>
                  {version && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface border border-border text-xs font-medium text-content-secondary">
                      <Tag size={12} /> v{version}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-content-secondary uppercase tracking-wider flex items-center justify-between">
                  Description
                  <span className="text-[10px] normal-case font-normal italic text-content-muted flex items-center gap-1"><Info size={10}/> HTML supported in ADO</span>
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-input-border bg-input-bg text-input-text text-sm focus-visible:ring-2 focus-visible:ring-primary outline-none transition-all resize-y disabled:opacity-50 disabled:bg-muted"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-content-secondary hover:text-content-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-sm bg-primary text-primary-fg hover:bg-primary-hover disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
            Create Release Task
          </button>
        </div>

      </div>
    </div>
  );
}
