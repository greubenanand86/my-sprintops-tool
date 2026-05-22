import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { SecondaryTabBar, TABS } from '../components/layout/SecondaryTabBar';
import { EstimationRow } from '../components/estimation/EstimationRow';
import { EstimationItem, EstimationFilter, TaskEstimate } from '../types/estimation';
import { SessionConfig } from '../types/config';
import { fetchAndNormalizeWorkItems } from '../services/workItemsService';
import { useToast } from '../contexts/ToastContext';
import { useConfig } from '../contexts/ConfigContext';
import { Filter, SlidersHorizontal, Loader2, AlertCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { toArray } from '../utils/arrayUtils';

const FILTERS: EstimationFilter[] = ['None', 'Missing Original', 'Missing Remaining', 'Missing Completed', 'Missing Any', 'Overridden Only'];

export function EstimationPlanner() {
  const { showToast } = useToast();
  const { committedConfig } = useConfig();

  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeFilter, setActiveFilter] = useState<EstimationFilter>('None');
  const [items, setItems] = useState<EstimationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseNumber = (val: any): number | '' => {
    if (val === '' || val === undefined || val === null) return '';
    const num = Number(val);
    return isNaN(num) ? '' : num;
  };

  const loadData = useCallback(async (cfg: SessionConfig) => {
    setLoading(true);
    setError(null);
    try {
      const { parents } = await fetchAndNormalizeWorkItems(cfg);
      const estimationItems: EstimationItem[] = toArray(parents).map(parent => {
        const mapTask = (task: any): TaskEstimate => ({ 
          id: task?.id, 
          type: task?.type || 'Dev', 
          original: parseNumber(task?.original), 
          remaining: parseNumber(task?.remaining), 
          completed: parseNumber(task?.completed), 
          isOverridden: false 
        });
        return { 
          id: parent.id, 
          title: parent.title, 
          type: parent.type as any, 
          state: parent.state, 
          tags: toArray(parent.tags), 
          visibleTabs: toArray(parent.visibleTabs), 
          tasks: { 
            Dev: mapTask(parent.tasks?.Dev), 
            QA: mapTask(parent.tasks?.QA), 
            UAT: mapTask(parent.tasks?.UAT)
          } 
        };
      });
      setItems(estimationItems);
    } catch (err: any) {
      setError(err.message || 'Network error while fetching work items.');
      showToast(err.message || 'Failed to load estimation data', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!committedConfig) {
      setError('CONFIG_NOT_SAVED');
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

  const handleRefresh = () => { 
    if (committedConfig && committedConfig.iteration.selectedPath) {
      loadData(committedConfig); 
    }
  };
  
  const handleUpdateItem = (updatedItem: EstimationItem) => { 
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i)); 
  };

  const filteredData = useMemo(() => {
    return toArray(items).filter(item => {
      if (activeTab !== 'All' && !toArray(item.visibleTabs).includes(activeTab)) return false;
      if (activeFilter === 'None') return true;
      const tasks = Object.values(item.tasks || {});
      switch (activeFilter) {
        case 'Missing Original': return tasks.some(t => t.original === '');
        case 'Missing Remaining': return tasks.some(t => t.remaining === '');
        case 'Missing Completed': return tasks.some(t => t.completed === '');
        case 'Missing Any': return tasks.some(t => t.original === '' || t.remaining === '' || t.completed === '');
        case 'Overridden Only': return tasks.some(t => t.isOverridden);
        default: return true;
      }
    });
  }, [items, activeTab, activeFilter]);

  if (error === 'CONFIG_NOT_SAVED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Estimation Planner" description="Plan and persist story point estimations for upcoming sprints." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-warning-fg" />
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

  if (error === 'NO_SPRINT_SELECTED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Estimation Planner" description="Plan and persist story point estimations for upcoming sprints." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4">
            <ShieldAlert size={32} className="text-warning-fg" />
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
        <PageHeader title="Estimation Planner" description="Plan and persist story point estimations for upcoming sprints." />
        <div className="bg-danger-bg border border-danger/20 text-danger-fg p-8 rounded-2xl flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4"><AlertCircle size={32} className="text-danger-fg" /></div>
          <h3 className="text-xl font-bold mb-2 text-danger-fg">Unable to load data</h3>
          <p className="text-sm max-w-md text-danger-fg mb-6">{error}</p>
          <button onClick={handleRefresh} className="px-5 py-2.5 bg-danger text-primary-fg rounded-xl text-sm font-medium hover:bg-danger/90 transition-colors shadow-sm flex items-center gap-2"><RefreshCw size={16} /> Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
      <PageHeader title="Estimation Planner" description={`Showing live estimates for iteration: ${committedConfig?.iteration.selectedPath.split('\\').pop() || 'Unknown'}`} actions={<button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary bg-surface border border-border rounded-lg hover:bg-background hover:text-content-primary transition-colors"><RefreshCw size={16} /> Refresh Data</button>} />
      
      <SecondaryTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 mt-4">
        <div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-content-secondary" /><span className="text-sm font-medium text-content-primary">Filter Estimations:</span></div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(filter => (
            <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${activeFilter === filter ? 'bg-primary text-primary-fg border-primary shadow-sm' : 'bg-surface text-content-secondary border-border hover:bg-background hover:text-content-primary'}`}>{filter}</button>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-surface border border-border rounded-2xl shadow-sm">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <h3 className="text-lg font-semibold text-content-primary">Fetching Sprint Data</h3>
            <p className="text-sm text-content-secondary mt-1">Pulling work items and estimates from Azure DevOps...</p>
          </div>
        ) : filteredData.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="hidden md:grid grid-cols-[40px_80px_minmax(200px,1fr)_100px_120px_100px_100px] gap-2 px-4 py-2 bg-surface border border-border rounded-xl shadow-sm text-xs font-semibold text-content-secondary uppercase tracking-wider sticky top-[120px] z-10">
              <div></div><div>ID</div><div>Title & Tags</div><div>Type</div><div>State</div><div className="text-right">Total Orig</div><div className="text-right">Total Rem</div>
            </div>
            {filteredData.map(item => <EstimationRow key={item.id} item={item} config={committedConfig!} onUpdate={handleUpdateItem} />)}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface border border-dashed border-border rounded-2xl text-center">
            <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mb-4"><Filter size={24} className="text-content-secondary" /></div>
            <h3 className="text-lg font-semibold text-content-primary mb-1">No items found</h3>
            <p className="text-sm text-content-secondary max-w-md">There are no work items matching the current tab and filter criteria.</p>
          </div>
        )}
      </div>
    </div>
  );
}
