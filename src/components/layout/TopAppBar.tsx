import React, { useState, useRef, useEffect } from 'react';
import { Activity, ChevronDown, Check, Sun, Moon, RefreshCw, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useConfig } from '../../contexts/ConfigContext';
import { useTheme } from '../../contexts/ThemeContext';

export function TopAppBar() {
  const { committedConfig, updateCommittedConfig, iterations, connectionStatus, checkConnection } = useConfig();
  const { theme, toggleTheme } = useTheme();
  
  const [isSprintOpen, setIsSprintOpen] = useState(false);
  const sprintRef = useRef<HTMLDivElement>(null);

  const iterationName = committedConfig?.iteration.selectedPath 
    ? committedConfig.iteration.selectedPath.split('\\').pop() 
    : 'No Sprint Selected';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (sprintRef.current && !sprintRef.current.contains(target)) {
        setIsSprintOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSprintSelect = (path: string) => {
    if (committedConfig) {
      updateCommittedConfig('iteration', { ...committedConfig.iteration, selectedPath: path });
    }
    setIsSprintOpen(false);
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'testing':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-info-bg/30 border border-info/20 text-info-fg animate-pulse">
            <Loader2 size={14} className="animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider">Connecting...</span>
          </div>
        );
      case 'success':
        return (
          <button 
            onClick={() => checkConnection()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success-bg/30 border border-success/20 text-success hover:bg-success-bg/50 transition-colors"
            title="ADO Connected. Click to re-test."
          >
            <CheckCircle2 size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">ADO Connected</span>
          </button>
        );
      case 'failure':
        return (
          <button 
            onClick={() => checkConnection()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger-bg/30 border border-danger/20 text-danger-fg hover:bg-danger-bg/50 transition-colors"
            title="ADO Disconnected. Click to re-test."
          >
            <AlertCircle size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">ADO Disconnected</span>
          </button>
        );
      default:
        return (
          <button 
            onClick={() => checkConnection()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border text-content-secondary hover:bg-background transition-colors"
          >
            <RefreshCw size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">Check Connection</span>
          </button>
        );
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-surface border-b border-border z-30 flex items-center justify-between px-4 md:px-6 transition-colors duration-200">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-fg shadow-sm">
            <Activity size={20} />
          </div>
          <span className="font-bold text-lg hidden sm:block tracking-tight text-content-primary">SprintOps Console</span>
        </div>
        
        {/* Sprint Selector */}
        <div className="relative hidden md:block" ref={sprintRef}>
          <button 
            onClick={() => committedConfig?.iteration.allowManual && setIsSprintOpen(!isSprintOpen)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors ${
              isSprintOpen ? 'bg-background border-border' : 'border-transparent hover:bg-background hover:border-border'
            } ${!committedConfig?.iteration.allowManual ? 'cursor-default' : ''}`}
          >
            <span className="text-sm font-medium text-content-primary">{iterationName}</span>
            {committedConfig?.iteration.allowManual && (
              <ChevronDown size={16} className={`text-content-secondary transition-transform ${isSprintOpen ? 'rotate-180' : ''}`} />
            )}
          </button>

          {isSprintOpen && committedConfig?.iteration.allowManual && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-80 overflow-y-auto bg-surface border border-border rounded-xl shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
              {iterations.length === 0 ? (
                <div className="px-4 py-3 text-sm text-content-secondary italic">No iterations found.</div>
              ) : (
                iterations.map((iter) => (
                  <button
                    key={iter.path}
                    onClick={() => handleSprintSelect(iter.path)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-center justify-between transition-colors ${
                      committedConfig.iteration.selectedPath === iter.path ? 'text-primary font-medium bg-primary/10' : 'text-content-primary hover:bg-muted/50'
                    }`}
                  >
                    <span className="truncate pr-2">{iter.name}</span>
                    {committedConfig.iteration.selectedPath === iter.path && <Check size={16} className="shrink-0" />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Connection Status */}
        <div className="hidden sm:block">
          {getStatusBadge()}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-background text-content-secondary hover:text-content-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      </div>
    </header>
  );
}
