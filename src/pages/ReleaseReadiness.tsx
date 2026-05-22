import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { useConfig } from '../contexts/ConfigContext';
import { useToast } from '../contexts/ToastContext';
import { fetchReleaseTasks } from '../services/releaseService';
import { ReleaseTask } from '../types/releaseModels';
import { Rocket, Plus, Filter, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

export function ReleaseReadiness() {
  const { committedConfig } = useConfig();
  const { showToast } = useToast();
  
  const [data, setData] = useState<ReleaseTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (cfg: any) => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await fetchReleaseTasks(cfg);
      setData(tasks);
    } catch (err: any) {
      setError(err.message || 'Failed to load release tasks');
      showToast(err.message || 'Failed to load release tasks', 'error');
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
    if (committedConfig?.iteration.selectedPath) loadData(committedConfig);
  };

  if (error === 'CONFIG_NOT_SAVED' || error === 'NO_SPRINT_SELECTED') {
    return (
      <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
        <PageHeader title="Release Readiness" description="Review release tasks and production readiness." />
        <div className="flex flex-col items-center justify-center py-24 px-4 bg-surface border border-dashed border-border rounded-2xl text-center shadow-sm">
          <div className="w-16 h-16 bg-warning-bg rounded-full flex items-center justify-center mb-4"><ShieldAlert size={32} className="text-warning" /></div>
          <h3 className="text-xl font-bold mb-2 text-content-primary">{error === 'CONFIG_NOT_SAVED' ? 'Configuration Required' : 'No Sprint Selected'}</h3>
          <p className="text-sm max-w-md text-content-secondary mb-6">{error === 'CONFIG_NOT_SAVED' ? 'Complete and save your Azure DevOps configuration before loading release tasks.' : 'Please select an iteration in the Configuration page.'}</p>
          <Link to="/config" className="px-5 py-2.5 bg-primary text-primary-fg rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors shadow-sm">Go to Configuration</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 pb-20 md:pb-8">
      <PageHeader 
        title="Release Readiness" 
        description="Review release tasks and production readiness."
        actions={<button onClick={handleRefresh} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-content-secondary bg-surface border border-border rounded-lg hover:bg-background hover:text-content-primary transition-colors"><RefreshCw size={16} /> Refresh Data</button>}
      />
      
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 bg-surface border border-border rounded-2xl shadow-sm">
            <Loader2 className="animate-spin text-primary mb-4" size={40} />
            <h3 className="text-lg font-semibold text-content-primary">Fetching Release Tasks</h3>
            <p className="text-sm text-content-secondary mt-1">Authenticating via server-side PAT...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-surface border border-dashed border-border rounded-2xl text-center">
            <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center mb-4"><Filter size={24} className="text-content-secondary" /></div>
            <h3 className="text-lg font-semibold text-content-primary mb-1">No releases found</h3>
            <p className="text-sm text-content-secondary">No work items tagged with 'Release task' were found in this iteration.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {/* Release list rendering... */}
          </div>
        )}
      </div>
    </div>
  );
}
