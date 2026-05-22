import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { SecondaryTabBar, TABS } from '../components/layout/SecondaryTabBar';
import { ReadinessRow } from '../components/readiness/ReadinessRow';
import { ParentWorkItem, ChildWorkItem } from '../types/adoModels';
import { SessionConfig } from '../types/config';
import { fetchAndNormalizeWorkItems, fetchRawWorkItems } from '../services/workItemsService';
import { useToast } from '../contexts/ToastContext';
import { useConfig } from '../contexts/ConfigContext';
import { fetchWithRetry } from '../utils/api';
import { getApiUrl, safeParseApiResponse } from '../utils/apiUtils';
import { Filter, Loader2, AlertCircle, RefreshCw, Link as LinkIcon, ShieldAlert, GitMerge, ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toArray } from '../utils/arrayUtils';
import { isActionableMismatch, isLoadFailedChild, isTerminalState } from '../utils/actionabilityUtils';
import { isClosureState } from '../utils/readinessUtils';

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
  }, [isOpen]);

  const summary = selected.length === 0 
    ? `All ${title}s` 
    : selected.length === 1 
      ? selected[0] 
      : `${selected.length} ${title}s`;

  return (
    <>
      <button 
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 text-sm border rounded-md text-content-primary cursor-pointer outline-none py-1.5 px-2.5 transition-all focus-visible:ring-2 focus-visible:ring-primary ${isOpen || selected.length > 0 ? 'bg-primary/5 border-primary/30 text-primary' : 'bg-transparent border-transparent hover:bg-muted/50'}`}
      >
        <span className="truncate max-w-[120px] font-medium">{summary}</span>
        <ChevronDown size={14} className={`text-content-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          style={{ top: coords.top, left: coords.left, minWidth: Math.max(coords.width, 220) }}
          className="absolute bg-surface border border-border rounded-xl shadow-lg z-[9999] py-1 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-2 py-1.5 border-b border-border mb-1 flex justify-between items-center">
            <span className="text-xs font-semibold text-content-secondary uppercase tracking-wider px-1">{title}</span>
            <button 
              onClick={onClear}
              disabled={selected.length === 0}
              className="text-xs font-medium text-primary hover:text-primary-hover disabled:opacity-50 px-1"
            >
              Clear
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map(opt => {
              const isSelected = selected.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => onChange(opt, !isSelected)}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary border-primary text-primary-fg' : 'border-input-border bg-input-bg'}`}>
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className={`text-sm truncate ${isSelected ? 'text-content-primary font-medium' : 'text-content-secondary'}`}>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
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

  const loadData = useCallback(async (cfg: SessionConfig, isBackground = false) => {
    if (!isBackground) setLoading(true);
    if (!isBackground) setError(null);
    try {
      const { items, currentUser: user, diagnostics } = await fetchRawWorkItems(cfg);
      const { parents, unparentedTasks: unparented } = await fetchAndNormalizeWorkItems(cfg);
      
      setData(parents);
      setUnparentedTasks(unparented);
      setCurrentUser(user || null);

      if (diagnostics?.relation_hydration) {
        console.log('[SprintOps] Relation Hydration Trace:', diagnostics.relation_hydration);
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
    // PAT is now server-side only, so we only check for the iteration path
    if (!committedConfig.iteration.selectedPath) {
      setError('NO_SPRINT_SELECTED');
      setLoading(false);
      return;
    }
    loadData(committedConfig);
  }, [committedConfig, loadData]);

  const handleRefresh = () => {
    if (committedConfig?.iteration.selectedPath) {
      loadData(committedConfig, false);
    }
  };

  const handleBackgroundRefresh = () => {
    if (committedConfig?.iteration.selectedPath) {
      loadData(committedConfig, true);
    }
  };

  const handleUpdateItem = (updatedItem: ParentWorkItem) => {
    setData(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const isAssignedToMe = useCallback((item: ParentWorkItem) => {
    if (!currentUser) return false;
    const itemUnique = item.assignedToUniqueName?.toLowerCase().trim();
    const currUnique = currentUser.uniqueName?.toLowerCase().trim();
    return itemUnique === currUnique;
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

  const allTypes = useMemo(() => Array.from(new Set(data.map(d => d.type))).sort(), [data]);
  const allStates = useMemo(() => Array.from(new Set(data.map(d => d.state))).sort(), [data]);

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
        }
      }
      return true;
    });
  }, [data, activeTab, filterStates, filterTypes, isAssignedToMe, hideClosed, filterClosedVerification]);

  if (error === 'CONFIG_NOT_SAVED' || error === 'NO_SPRINT_SELECTED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Readiness Tracker" description="Monitor sprint readiness and unblock work items." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-warning" />
          </div>
          <h3 className="text-xl font-bold mb-2 text-content-primary">
            {error === 'CONFIG_NOT_SAVED' ? 'Configuration Required' : 'No Sprint Selected'}
          </h3>
          <p className="text-sm max-w-md text-content-secondary mb-6">
            {error === 'CONFIG_NOT_SAVED' 
              ? 'Complete and save your Azure DevOps configuration before loading work items.' 
              : 'Please select an iteration in the Configuration page.'}
          </p>
          <Link to="/config" className="px-5 py-2.5 bg-primary text-primary-fg rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm">
            Go to Configuration
          </Link>
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
          <button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary bg-surface border border-border rounded-lg hover:bg-background hover:text-content-primary transition-colors">
            <RefreshCw size={16} /> Refresh Data
          </button>
        }
      />
      
      <SecondaryTabBar activeTab={activeTab} onTabChange={setActiveTab} tabs={dynamicTabs} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1.5 bg-surface p-1.5 rounded-xl border border-border shadow-sm w-full sm:w-auto overflow-x-auto">
          <div className="flex items-center pl-2 pr-1 shrink-0">
            <Filter size={16} className="text-content-secondary" />
          </div>
          <MultiSelectDropdown
            title="State"
            options={allStates}
            selected={filterStates}
            onChange={(val, checked) => {
              if (checked) setFilterStates(prev => [...prev, val]);
              else setFilterStates(prev => prev.filter(s => s !== val));
            }}
            onClear={() => setFilterStates([])}
          />
          <div className="w-px h-4 bg-border mx-1 shrink-0"></div>
          <MultiSelectDropdown
            title="Type"
            options={allTypes}
            selected={filterTypes}
            onChange={(val, checked) => {
              if (checked) setFilterTypes(prev => [...prev, val]);
              else setFilterTypes(prev => prev.filter(t => t !== val));
            }}
            onClear={() => setFilterTypes([])}
          />
          <div className="w-px h-4 bg-border mx-1 shrink-0"></div>
          <button
            onClick={() => setHideClosed(!hideClosed)}
            className={`flex items-center gap-1.5 text-sm border rounded-md py-1.5 px-2.5 transition-all ${hideClosed ? 'bg-primary/5 border-primary/30 text-primary font-medium' : 'bg-transparent border-transparent text-content-primary hover:bg-muted/50'}`}
          >
            Hide Closed
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-surface border border-border rounded-2xl shadow-sm">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <h3 className="text-lg font-semibold text-content-primary">Fetching Sprint Data</h3>
            <p className="text-sm text-content-secondary mt-1">Communicating with Azure DevOps via server-side PAT...</p>
          </div>
        ) : (
          <>
            <div className="text-sm font-medium text-content-secondary px-1">
              Showing {activeTab === 'Unparented Tasks' ? unparentedTasks.length : filteredData.length} items
            </div>
            {filteredData.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="hidden md:grid grid-cols-[40px_80px_minmax(200px,1fr)_100px_140px_50px_50px_50px_50px_50px_50px_220px] gap-2 px-4 py-2 bg-surface border border-border rounded-xl shadow-sm text-xs font-semibold text-content-secondary uppercase tracking-wider sticky top-[120px] z-10">
                  <div></div><div>ID</div><div>Title & Tags</div><div>Type</div><div>Parent State</div><div className="text-center text-primary">Appr*</div><div className="text-center font-normal opacity-70">Dev</div><div className="text-center font-normal opacity-70">QA</div><div className="text-center text-primary">UAT*</div><div className="text-center font-normal opacity-70">Post</div><div className="text-center text-primary">Link*</div><div className="text-right">Readiness</div>
                </div>
                {filteredData.map(item => (
                  <ReadinessRow 
                    key={item.id} 
                    item={item} 
                    config={committedConfig!} 
                    onUpdate={handleUpdateItem} 
                    onRefresh={handleBackgroundRefresh}
                    deploymentTaskId={deploymentIds[activeTab]} 
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
