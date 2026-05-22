import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { PageHeader } from '../ui/PageHeader';
import { SecondaryTabBar, TABS } from '../layout/SecondaryTabBar';
import { ReadinessRow } from './ReadinessRow';
import { ParentWorkItem, ChildWorkItem } from '../../types/adoModels';
import { SessionConfig } from '../../types/config';
import { fetchAndNormalizeWorkItems, fetchRawWorkItems } from '../../services/workItemsService';
import { useToast } from '../../contexts/ToastContext';
import { useConfig } from '../../contexts/ConfigContext';
import { fetchWithRetry } from '../../utils/api';
import { getApiUrl, safeParseApiResponse } from '../../utils/apiUtils';
import { Filter, Loader2, AlertCircle, RefreshCw, Link as LinkIcon, ShieldAlert, GitMerge, Wrench, ChevronDown, Check } from 'lucide-react';
import { WorkItemLink } from '../ui/WorkItemLink';
import { toArray } from '../../utils/arrayUtils';
import { getStateColorClass } from '../../utils/stateColors';
import { isActionableMismatch, isLoadFailedChild, isTerminalState } from '../../utils/actionabilityUtils';
import { isClosureState } from '../../utils/readinessUtils';

const CLOSED_VERIFICATION_OPTIONS = [
  'All',
  'Closed + Post Deployment Closed',
  'Closed + Post Deployment Open',
  'Closed + Post Deployment Missing',
  'Closed + Deployment Link Missing',
  'Closed Without Ready-for-Production Transition',
  'Closed + Transition Unknown'
];

interface MultiSelectDropdownProps {
  title: string;
  options: string[];
  selected: string[];
  onChange: (val: string, checked: boolean) => void;
  onClear: () => void;
}

function MultiSelectDropdown({ title, options, selected, onChange, onClear }: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(dropdownRef.current?.querySelectorAll('[role="option"]') || []) as HTMLElement[];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const firstOption = dropdownRef.current.querySelector('[role="option"]') as HTMLElement;
      if (document.activeElement === triggerRef.current) {
         firstOption?.focus();
      }
    }
  }, [isOpen]);

  const summary = selected.length === 0 
    ? `All ${title}s` 
    : selected.length === 1 
      ? selected[0] 
      : `${selected.length} ${title}s`;

  const dropdownContent = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(coords.width, 220) }}
      className="absolute bg-surface border border-border rounded-xl shadow-lg z-[9999] py-1 animate-in fade-in zoom-in-95 duration-200 focus:outline-none"
      role="listbox"
      aria-multiselectable="true"
      onKeyDown={handleDropdownKeyDown}
      tabIndex={-1}
    >
      <div className="px-2 py-1.5 border-b border-border mb-1 flex justify-between items-center">
        <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider px-1">{title}</span>
        <button 
          type="button"
          onClick={() => {
            onClear();
            triggerRef.current?.focus();
          }}
          disabled={selected.length === 0}
          className="text-xs font-medium text-primary hover:text-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-1 py-0.5 rounded focus-visible:ring-2 focus-visible:ring-primary outline-none"
        >
          Clear all
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {options.map(opt => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(opt, !isSelected);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(opt, !isSelected);
                }
              }}
              tabIndex={-1}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors text-left outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary text-primary-fg' : 'border-input-border bg-input-bg'}`}>
                {isSelected && <Check size={12} strokeWidth={3} />}
              </div>
              <span className={`text-sm truncate ${isSelected ? 'text-content-primary font-medium' : 'text-content-secondary'}`}>{opt}</span>
            </button>
          );
        })}
        {options.length === 0 && (
          <div className="px-3 py-2 text-sm text-content-secondary italic">No options available</div>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button 
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by ${title}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center gap-1.5 text-sm border rounded-md text-content-primary cursor-pointer outline-none py-1.5 px-2.5 transition-all focus-visible:ring-2 focus-visible:ring-primary ${isOpen || selected.length > 0 ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-transparent border-transparent hover:bg-muted/50'}`}
      >
        <span className="truncate max-w-[120px] font-medium">
          {summary}
        </span>
        <ChevronDown size={14} className={`text-content-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {dropdownContent}
    </>
  );
}

interface SingleSelectDropdownProps {
  title: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
}

function SingleSelectDropdown({ title, options, value, onChange }: SingleSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [isOpen, updateCoords]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    const items = Array.from(dropdownRef.current?.querySelectorAll('[role="option"]') || []) as HTMLElement[];
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  };

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const firstOption = dropdownRef.current.querySelector('[role="option"]') as HTMLElement;
      if (document.activeElement === triggerRef.current) {
         firstOption?.focus();
      }
    }
  }, [isOpen]);

  const summary = value === 'All' ? title : value;

  const dropdownContent = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      style={{ top: coords.top, left: coords.left, minWidth: Math.max(coords.width, 280) }}
      className="absolute bg-surface border border-border rounded-xl shadow-lg z-[9999] py-1 animate-in fade-in zoom-in-95 duration-200 focus:outline-none"
      role="listbox"
      onKeyDown={handleDropdownKeyDown}
      tabIndex={-1}
    >
      <div className="px-2 py-1.5 border-b border-border mb-1 flex justify-between items-center">
        <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider px-1">{title}</span>
      </div>
      <div className="max-h-60 overflow-y-auto py-1">
        {options.map(opt => {
          const isSelected = value === opt;
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(opt);
                setIsOpen(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange(opt);
                  setIsOpen(false);
                }
              }}
              tabIndex={-1}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors text-left outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-input-border bg-input-bg'}`}>
                {isSelected && <div className="w-2 h-2 rounded-full bg-primary-fg" />}
              </div>
              <span className={`text-sm truncate ${isSelected ? 'text-content-primary font-medium' : 'text-content-secondary'}`}>{opt}</span>
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button 
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filter by ${title}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleTriggerKeyDown}
        className={`flex items-center gap-1.5 text-sm border rounded-md text-content-primary cursor-pointer outline-none py-1.5 px-2.5 transition-all focus-visible:ring-2 focus-visible:ring-primary ${value !== 'All' ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-transparent border-transparent hover:bg-muted/50'}`}
      >
        <span className="truncate max-w-[200px] font-medium">
          {summary}
        </span>
        <ChevronDown size={14} className={`text-content-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {dropdownContent}
    </>
  );
}

export function ReadinessTracker() {
  const { showToast } = useToast();
  const { committedConfig } = useConfig();
  
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [data, setData] = useState<ParentWorkItem[]>([]);
  const [unparentedTasks, setUnparentedTasks] = useState<ChildWorkItem[]>([]);
  const [currentUser, setCurrentUser] = useState<{ displayName: string, uniqueName: string } | null>(null);
  
  const [filterStates, setFilterStates] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [hideClosed, setHideClosed] = useState(false);
  const [filterClosedVerification, setFilterClosedVerification] = useState<string>('All');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deploymentIds, setDeploymentIds] = useState<Record<string, string>>({});
  const [isBulkLinking, setIsBulkLinking] = useState(false);
  const [showBulkLinkPrompt, setShowBulkLinkPrompt] = useState(false);

  const [isGlobalAligning, setIsGlobalAligning] = useState(false);
  const [showGlobalAlignPrompt, setShowGlobalAlignPrompt] = useState(false);

  const loadData = useCallback(async (cfg: SessionConfig, isBackground = false) => {
    if (!isBackground) setLoading(true);
    if (!isBackground) setError(null);
    try {
      const { items, currentUser: user, diagnostics } = await fetchRawWorkItems(cfg);
      const { parents, unparentedTasks: unparented } = await fetchAndNormalizeWorkItems(cfg);
      
      setData(parents);
      setUnparentedTasks(unparented);
      setCurrentUser(user || null);

      // --- [DEEP HYDRATION DIAGNOSTIC LOGGING] ---
      if (diagnostics?.relation_hydration) {
        const rh = diagnostics.relation_hydration;
        console.log('\n--- [BACKEND EVIDENCE] Relation Hydration Analysis ---');
        
        const targetIds = [52257, 52353, 52499, 52105, 52508, 50964, 51094, 51095];
        const reportData = targetIds.map(id => {
          const inBatch = rh.batchReturnedIds.includes(id);
          const direct = rh.directFetchAttempts.find((a: any) => a.id === id);
          const finalItem = parents.find(p => p.id === id) || 
                            parents.flatMap(p => p.allChildren).find(c => c.id === id) ||
                            parents.flatMap(p => p.relatedItems).find(r => r.id === id) ||
                            parents.find(p => p.link.id === id)?.link;

          return {
            ID: id,
            'Batch Success': inBatch ? 'YES' : 'NO (Omitted)',
            'Direct URL Attempt': direct ? 'YES' : 'NO',
            'Direct URL Status': direct ? direct.status : 'N/A',
            'Final State': finalItem ? (finalItem.isUnavailableRelation ? 'Unavailable' : 'Loaded') : 'Not Found',
            'Failure Reason': finalItem?.loadFailureReason || 'N/A'
          };
        });
        console.table(reportData);
        console.log('------------------------------------------------------\n');
      }

    } catch (err: any) {
      if (!isBackground) setError(err.message || 'Network error while fetching work items.');
      showToast(err.message || 'Failed to load sprint data', 'error');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!committedConfig) {
      setError('CONFIG_NOT_SAVED');
      setLoading(false);
      return;
    }
    if (!committedConfig.ado.pat) {
      setError('PAT_REQUIRED');
      setLoading(false);
      return;
    }
    if (!committedConfig.iteration.selectedPath) {
      setError('NO_SPRINT_SELECTED');
      setLoading(false);
      return;
    }
    loadData(committedConfig);
  }, [committedConfig, loadData]);

  useEffect(() => {
    setFilterStates([]);
    setFilterTypes([]);
    setFilterClosedVerification('All');
    setShowGlobalAlignPrompt(false);
    setShowBulkLinkPrompt(false);
  }, [activeTab]);

  const handleRefresh = () => {
    if (committedConfig && committedConfig.ado.pat && committedConfig.iteration.selectedPath) {
      loadData(committedConfig, false);
    }
  };

  const handleBackgroundRefresh = () => {
    if (committedConfig && committedConfig.ado.pat && committedConfig.iteration.selectedPath) {
      loadData(committedConfig, true);
    }
  };

  const handleUpdateItem = (updatedItem: ParentWorkItem) => {
    setData(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const handleClosedVerificationChange = (val: string) => {
    setFilterClosedVerification(val);
    if (val !== 'All') {
      setHideClosed(false);
    }
  };

  const isAssignedToMe = useCallback((item: ParentWorkItem) => {
    if (!currentUser) return false;
    
    const itemUnique = item.assignedToUniqueName?.toLowerCase().trim();
    const currUnique = currentUser.uniqueName?.toLowerCase().trim();
    if (itemUnique && currUnique && itemUnique === currUnique) return true;
    
    const itemDisplay = item.assignedTo?.toLowerCase().trim();
    const currDisplay = currentUser.displayName?.toLowerCase().trim();
    if (itemDisplay && currDisplay && itemDisplay === currDisplay) return true;
    
    return false;
  }, [currentUser]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    TABS.forEach(tab => {
      if (tab === 'Approval Pending') {
        counts[tab] = data.filter(item => item.state === 'Approval Request' && isAssignedToMe(item)).length;
      } else if (tab === 'Iteration Mismatch') {
        counts[tab] = data.filter(item => item.allChildren.some(child => child.iterationPath !== item.iterationPath && !isLoadFailedChild(child))).length;
      } else {
        counts[tab] = data.filter(item => tab === 'All' || toArray(item.visibleTabs).includes(tab)).length;
      }
    });
    counts['Unparented Tasks'] = unparentedTasks.length;
    return counts;
  }, [data, unparentedTasks, isAssignedToMe]);

  const dynamicTabs = [
    ...TABS.map(t => ({ id: t, label: t, count: tabCounts[t] })),
    { id: 'Unparented Tasks', label: 'Unparented Tasks', count: tabCounts['Unparented Tasks'] }
  ];

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    data.forEach(d => types.add(d.type));
    unparentedTasks.forEach(d => types.add(d.type));
    return Array.from(types).sort();
  }, [data, unparentedTasks]);

  const allStates = useMemo(() => {
    const states = new Set<string>();
    data.forEach(d => states.add(d.state));
    unparentedTasks.forEach(d => states.add(d.state));
    return Array.from(states).sort();
  }, [data, unparentedTasks]);

  useEffect(() => {
    setFilterStates(prev => prev.filter(s => allStates.includes(s)));
    setFilterTypes(prev => prev.filter(t => allTypes.includes(t)));
  }, [allStates, allTypes]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      if (activeTab === 'Approval Pending') {
        if (item.state !== 'Approval Request' || !isAssignedToMe(item)) return false;
      } else if (activeTab === 'Iteration Mismatch') {
        if (!item.allChildren.some(child => child.iterationPath !== item.iterationPath && !isLoadFailedChild(child))) return false;
      } else if (activeTab !== 'All' && !toArray(item.visibleTabs).includes(activeTab)) {
        return false;
      }
      
      if (filterStates.length > 0 && !filterStates.includes(item.state)) return false;
      if (filterTypes.length > 0 && !filterTypes.includes(item.type)) return false;
      
      if (hideClosed && isClosureState(item.state)) return false;
      
      if (filterClosedVerification !== 'All') {
        if (!isClosureState(item.state)) return false;
        
        switch (filterClosedVerification) {
          case 'Closed + Post Deployment Closed':
            if (!(item.tasks.Post.actionState === 'created' && item.tasks.Post.adoState === 'Closed')) return false;
            break;
          case 'Closed + Post Deployment Open':
            if (!(item.tasks.Post.actionState === 'created' && item.tasks.Post.adoState !== 'Closed')) return false;
            break;
          case 'Closed + Post Deployment Missing':
            if (item.tasks.Post.actionState === 'created') return false;
            break;
          case 'Closed + Deployment Link Missing':
            if (item.link.actionState === 'created') return false;
            break;
          case 'Closed Without Ready-for-Production Transition':
            if (item.readyForProdTransition !== 'not_found') return false;
            break;
          case 'Closed + Transition Unknown':
            if (item.readyForProdTransition !== 'unknown') return false;
            break;
        }
      }
      
      return true;
    });
  }, [data, activeTab, filterStates, filterTypes, isAssignedToMe, hideClosed, filterClosedVerification]);

  const filteredUnparented = useMemo(() => {
    return unparentedTasks.filter(item => {
      if (filterStates.length > 0 && !filterStates.includes(item.state)) return false;
      if (filterTypes.length > 0 && !filterTypes.includes(item.type)) return false;
      return true;
    });
  }, [unparentedTasks, filterStates, filterTypes]);

  const mismatchStats = useMemo(() => {
    let parentsAffected = 0;
    let actionableCount = 0;
    let skippedCount = 0;
    let loadFailedCount = 0;
    const updates: { childId: number, newIterationPath: string, parentId: number }[] = [];

    if (activeTab !== 'Iteration Mismatch') return { parentsAffected, actionableCount, skippedCount, loadFailedCount, updates };

    filteredData.forEach(parent => {
      const loadFailed = parent.allChildren.filter(c => isLoadFailedChild(c));
      loadFailedCount += loadFailed.length;

      const mismatched = parent.allChildren.filter(c => c.iterationPath !== parent.iterationPath && !isLoadFailedChild(c));
      const actionable = mismatched.filter(c => isActionableMismatch(c, parent.iterationPath));
      const skipped = mismatched.filter(c => isTerminalState(c.state));

      if (actionable.length > 0) {
        parentsAffected++;
        actionableCount += actionable.length;
        actionable.forEach(c => {
          updates.push({ childId: c.id, newIterationPath: parent.iterationPath, parentId: parent.id });
        });
      }
      skippedCount += skipped.length;
    });

    return { parentsAffected, actionableCount, skippedCount, loadFailedCount, updates };
  }, [filteredData, activeTab]);

  const handleGlobalBulkAlign = async () => {
    setIsGlobalAligning(true);
    setShowGlobalAlignPrompt(false);

    const { updates } = mismatchStats;
    if (updates.length === 0) {
      setIsGlobalAligning(false);
      return;
    }

    showToast(`Starting bulk alignment for ${updates.length} tasks...`, 'info');

    const results = await Promise.allSettled(updates.map(async (update) => {
      const res = await fetchWithRetry(getApiUrl('update-workitem'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ado: committedConfig!.ado,
          id: update.childId,
          patchDocument: [{
            op: 'add',
            path: `/fields/${committedConfig!.mapping.iterationPath || 'System.IterationPath'}`,
            value: update.newIterationPath
          }]
        })
      });
      const parsed = await safeParseApiResponse(res);
      if (!parsed.ok || !parsed.data?.success) {
        throw new Error(parsed.error?.message || `Failed to update task #${update.childId}`);
      }
      return update;
    }));

    const succeeded = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<typeof updates[0]>).value);
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    if (succeeded.length > 0) {
      setData(prev => prev.map(parent => {
        const parentUpdates = succeeded.filter(u => u.parentId === parent.id);
        if (parentUpdates.length === 0) return parent;

        const updatedChildren = parent.allChildren.map(c => {
          const update = parentUpdates.find(u => u.childId === c.id);
          return update ? { ...c, iterationPath: update.newIterationPath } : c;
        });

        const updatedTasks = { ...parent.tasks };
        (['Dev', 'QA', 'UAT', 'Post'] as const).forEach(t => {
          const childId = updatedTasks[t].id;
          if (childId) {
            const update = parentUpdates.find(u => u.childId === childId);
            if (update) {
              updatedTasks[t] = { ...updatedTasks[t], iterationPath: update.newIterationPath };
            }
          }
        });

        return { ...parent, allChildren: updatedChildren, tasks: updatedTasks };
      }));
    }

    if (failed.length > 0) {
      showToast(`Aligned ${succeeded.length} tasks. ${failed.length} failed.`, 'warning');
    } else {
      showToast(`Successfully aligned all ${succeeded.length} actionable tasks!`, 'success');
    }

    setIsGlobalAligning(false);
    handleBackgroundRefresh();
  };

  const bulkLinkStats = useMemo(() => {
    const eligible = filteredData.filter(i => i.link.actionState === 'absent' || i.link.actionState === 'failed');
    const alreadyLinked = filteredData.filter(i => i.link.actionState === 'created');
    return { eligible, alreadyLinked };
  }, [filteredData]);

  const executeBulkLink = async () => {
    const targetId = deploymentIds[activeTab];
    if (!targetId || !committedConfig) return;

    const eligibleItems = bulkLinkStats.eligible;
    if (eligibleItems.length === 0) return;

    setIsBulkLinking(true);
    setShowBulkLinkPrompt(false);
    showToast(`Starting bulk link for ${eligibleItems.length} items...`, 'info');

    setData(prev => prev.map(item => {
      if (eligibleItems.find(e => e.id === item.id)) {
        return { ...item, link: { ...item.link, actionState: 'creating' } };
      }
      return item;
    }));

    const results = await Promise.allSettled(eligibleItems.map(async (item) => {
      const res = await fetchWithRetry(getApiUrl('create-link'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ado: committedConfig.ado, sourceId: item.id, targetId })
      });
      const parsed = await safeParseApiResponse(res);
      
      if (parsed.ok && parsed.data?.success) {
        const baseUrl = committedConfig.ado.orgUrl.replace(/\/$/, '');
        const url = `${baseUrl}/${encodeURIComponent(committedConfig.ado.project)}/_workitems/edit/${targetId}`;
        const title = `Deployment Task #${targetId}`;
        
        setData(prev => prev.map(p => p.id === item.id ? { ...p, link: { actionState: 'created', url, title, id: parseInt(targetId, 10), isLoadFailed: false } } : p));
        return true;
      } else {
        setData(prev => prev.map(p => p.id === item.id ? { ...p, link: { ...p.link, actionState: 'failed' } } : p));
        throw new Error(parsed.error?.message || 'Failed to create link');
      }
    }));

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    if (failed.length === 0) {
      showToast(`Successfully linked all ${succeeded} items!`, 'success');
    } else {
      const firstError = failed[0].reason?.message || 'Unknown error';
      showToast(`Bulk link complete: ${succeeded} succeeded, ${failed.length} failed. (${firstError})`, 'warning');
    }

    setIsBulkLinking(false);
    handleBackgroundRefresh();
  };

  if (error === 'CONFIG_NOT_SAVED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Readiness Tracker" description="Monitor sprint readiness and unblock work items across all streams." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-warning" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-content-primary">Configuration Required</h3>
          <p className="text-sm max-w-md text-content-secondary mb-6">
            Complete and save your Azure DevOps configuration before loading work items.
          </p>
          <Link to="/config" className="px-5 py-2.5 bg-primary text-primary-fg rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm">
            Go to Configuration
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'PAT_REQUIRED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Readiness Tracker" description="Monitor sprint readiness and unblock work items across all streams." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-info-bg rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-info" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-content-primary">Connection Required</h3>
          <p className="text-sm max-w-md text-content-secondary mb-6">
            Your configuration is saved, but your session has expired. Please enter your Personal Access Token (PAT) to reconnect.
          </p>
          <Link to="/config" className="px-5 py-2.5 bg-primary text-primary-fg rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm">
            Go to Configuration
          </Link>
        </div>
      </div>
    );
  }

  if (error === 'NO_SPRINT_SELECTED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Readiness Tracker" description="Monitor sprint readiness and unblock work items across all streams." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-warning" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-content-primary">No Sprint Selected</h3>
          <p className="text-sm max-w-md text-content-secondary mb-6">
            We couldn't determine your current sprint. Please select an iteration in the Configuration page.
          </p>
          <Link to="/config" className="px-5 py-2.5 bg-primary text-primary-fg rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm">
            Go to Configuration
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Readiness Tracker" description="Monitor sprint readiness and unblock work items across all streams." />
        <div className="bg-danger-bg border border-danger/20 text-danger-fg p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4">
            <AlertCircle size={32} className="text-danger" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-danger-fg">Unable to load data</h3>
          <p className="text-sm max-w-md text-danger mb-6">{error}</p>
          <button onClick={handleRefresh} className="px-5 py-2.5 bg-danger text-primary-fg rounded-xl text-sm font-medium hover:bg-danger/90 transition-colors shadow-sm flex items-center gap-2"><RefreshCw size={16} /> Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
      <PageHeader 
        title="Readiness Tracker" 
        description={`Showing live data for iteration: ${committedConfig?.iteration.selectedPath.split('\\').pop() || 'Unknown'}`}
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary bg-surface border border-border rounded-lg hover:bg-background hover:text-content-primary transition-colors">
              <RefreshCw size={16} /> Refresh Data
            </button>
          </div>
        }
      />
      
      <SecondaryTabBar activeTab={activeTab} onTabChange={setActiveTab} tabs={dynamicTabs} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1.5 bg-surface p-1.5 rounded-xl border border-border shadow-sm w-full sm:w-auto overflow-x-auto">
          <div className="flex items-center pl-2 pr-1 shrink-0">
            <Filter size={16} className="text-content-secondary" />
          </div>
          {activeTab !== 'Approval Pending' && (
            <>
              <MultiSelectDropdown
                title="State"
                options={allStates}
                selected={filterStates}
                onChange={(val, checked) => {
                  if (checked) setFilterStates(prev => [...prev, val]);
                  else setFilterStates(prev => prev.filter(state => state !== val));
                }}
                onClear={() => setFilterStates([])}
              />
              <div className="w-px h-4 bg-border mx-1 shrink-0"></div>
            </>
          )}
          <MultiSelectDropdown
            title="Type"
            options={allTypes}
            selected={filterTypes}
            onChange={(val, checked) => {
              if (checked) setFilterTypes(prev => [...prev, val]);
              else setFilterTypes(prev => prev.filter(type => type !== val));
            }}
            onClear={() => setFilterTypes([])}
          />
          <div className="w-px h-4 bg-border mx-1 shrink-0"></div>
          <button
            onClick={() => setHideClosed(!hideClosed)}
            className={`flex items-center gap-1.5 text-sm border rounded-md cursor-pointer outline-none py-1.5 px-2.5 transition-all focus-visible:ring-2 focus-visible:ring-primary ${
              hideClosed ? 'bg-primary/5 border-primary/30 text-primary font-medium' : 'bg-transparent border-transparent text-content-primary hover:bg-muted/50'
            }`}
          >
            <span className="whitespace-nowrap">Hide Closed</span>
          </button>
          <div className="w-px h-4 bg-border mx-1 shrink-0"></div>
          <SingleSelectDropdown
            title="Closed Verification"
            options={CLOSED_VERIFICATION_OPTIONS}
            value={filterClosedVerification}
            onChange={handleClosedVerificationChange}
          />
        </div>

        {activeTab !== 'Unparented Tasks' && activeTab !== 'Approval Pending' && activeTab !== 'Iteration Mismatch' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface p-2 rounded-xl border border-border shadow-sm w-full sm:w-auto">
            <div className="flex items-center gap-3 w-full sm:w-auto px-2">
              <div className="w-8 h-8 rounded-lg bg-info-bg flex items-center justify-center text-info-fg shrink-0"><LinkIcon size={18} /></div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-content-primary">Deployment Task Linking</span>
                <span className="text-xs text-content-secondary">Configure target ID for the <strong>{activeTab}</strong> tab</span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input type="text" placeholder="Task ID (e.g. 12345)" value={deploymentIds[activeTab] || ''} onChange={(e) => setDeploymentIds(prev => ({ ...prev, [activeTab]: e.target.value.replace(/\D/g, '') }))} className="px-3 py-2 text-sm border border-input-border rounded-lg bg-input-bg text-input-text placeholder:text-content-muted focus:ring-2 focus:ring-primary outline-none w-40 transition-all" />
              <button onClick={() => setShowBulkLinkPrompt(true)} disabled={!deploymentIds[activeTab] || bulkLinkStats.eligible.length === 0 || isBulkLinking} className="px-4 py-2 bg-primary text-primary-fg text-sm font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap">
                {isBulkLinking ? <Loader2 size={16} className="animate-spin" /> : <LinkIcon size={16} />} Bulk Link ({bulkLinkStats.eligible.length})
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Iteration Mismatch' && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-surface p-2 rounded-xl border border-border shadow-sm w-full sm:w-auto">
            <div className="flex items-center gap-3 w-full sm:w-auto px-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${mismatchStats.actionableCount > 0 ? 'bg-warning-bg text-warning-fg' : 'bg-muted text-content-muted'}`}>
                <GitMerge size={18} />
              </div>
              <div className="flex flex-col">
                <span className={`text-sm font-semibold ${mismatchStats.actionableCount > 0 ? 'text-content-primary' : 'text-content-secondary'}`}>Bulk Align Mismatches</span>
                <span className="text-xs text-content-secondary">Align actionable child tasks to their parent's sprint</span>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => setShowGlobalAlignPrompt(true)}
                disabled={mismatchStats.actionableCount === 0 || isGlobalAligning}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
                  mismatchStats.actionableCount > 0 
                    ? 'bg-warning text-primary-fg hover:bg-warning/90' 
                    : 'bg-muted text-content-muted cursor-not-allowed'
                }`}
              >
                {isGlobalAligning ? <Loader2 size={16} className="animate-spin" /> : <GitMerge size={16} />}
                Review & Align ({mismatchStats.actionableCount})
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-surface border border-border rounded-2xl shadow-sm">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <h3 className="text-lg font-semibold text-content-primary">Fetching Sprint Data</h3>
            <p className="text-sm text-content-secondary mt-1">Pulling work items from Azure DevOps...</p>
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-content-secondary px-1">
              Showing {activeTab === 'Unparented Tasks' ? filteredUnparented.length : filteredData.length} items
            </div>
            {filteredData.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="hidden md:grid grid-cols-[40px_80px_minmax(200px,1fr)_100px_140px_50px_50px_50px_50px_50px_50px_220px] gap-2 px-4 py-2 bg-surface border border-border rounded-xl shadow-sm text-xs font-semibold text-content-secondary uppercase tracking-wider sticky top-[120px] z-10">
                  <div></div>
                  <div>ID</div>
                  <div>Title & Tags</div>
                  <div>Type</div>
                  <div>Parent State</div>
                  <div className="text-center text-primary">Appr*</div>
                  <div className="text-center font-normal opacity-70">Dev</div>
                  <div className="text-center font-normal opacity-70">QA</div>
                  <div className="text-center text-primary">UAT*</div>
                  <div className="text-center font-normal opacity-70">Post</div>
                  <div className="text-center text-primary">Link*</div>
                  <div className="text-right">Readiness</div>
                </div>
                {filteredData.map(item => (
                  <ReadinessRow 
                    key={item.id} 
                    item={item} 
                    config={committedConfig!} 
                    onUpdate={handleUpdateItem} 
                    onRefresh={handleBackgroundRefresh}
                    deploymentTaskId={deploymentIds[activeTab]} 
                    isMismatchTab={activeTab === 'Iteration Mismatch'}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface border border-dashed border-border rounded-2xl text-center">
                <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mb-4"><Filter size={24} className="text-content-secondary" /></div>
                <h3 className="text-lg font-semibold text-content-primary mb-1">No items found</h3>
                <p className="text-sm text-content-secondary max-w-md">No items found matching current filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
