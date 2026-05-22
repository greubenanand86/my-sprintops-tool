import React from 'react';
import { HelpCircle, AlertCircle } from 'lucide-react';
import { ParentWorkItem } from '../../types/adoModels';
import { resolveReadinessDisplayStatus } from '../../utils/readinessUtils';

interface ReadinessMeterProps {
  item: ParentWorkItem;
}

export function ReadinessMeter({ item }: ReadinessMeterProps) {
  const status = resolveReadinessDisplayStatus(item);

  // 1. Render Closure State
  if (status.displayMode === 'closure') {
    let bgClass = 'bg-success-bg';
    let borderClass = 'border-success/30';
    let textClass = 'text-success-fg';
    let subtext = '';

    if (status.statusLabel === 'Deployed and Verified') {
      subtext = 'Post deployment task closed';
      bgClass = 'bg-success-bg';
      borderClass = 'border-success/30';
      textClass = 'text-success-fg';
    } else if (status.statusLabel === 'Deployed') {
      subtext = 'Post deployment verification pending';
      bgClass = 'bg-info-bg';
      borderClass = 'border-info/30';
      textClass = 'text-info-fg';
    } else {
      subtext = 'No linked deployment task found';
      bgClass = 'bg-warning-bg';
      borderClass = 'border-warning/30';
      textClass = 'text-warning-fg';
    }

    return (
      <div className="flex flex-col gap-1.5 w-full min-w-[100px]">
        {/* Primary Closure Status Badge */}
        <div className={`flex flex-col justify-center p-2 rounded-md border ${bgClass} ${borderClass} w-full shadow-sm text-left`} title={status.statusLabel}>
          <span className={`text-[11px] font-bold leading-tight ${textClass}`}>
            {status.statusLabel}
          </span>
          <span className={`text-[9px] leading-tight mt-1 opacity-90 ${textClass}`}>
            {subtext}
          </span>
        </div>
        
        {/* Transition & Load Audit Warnings */}
        {status.warnings.map((warning, idx) => {
          const isUnknown = warning.includes('unknown') || warning.includes('unavailable');
          const wBg = isUnknown ? 'bg-muted/30' : 'bg-warning-bg';
          const wBorder = isUnknown ? 'border-border' : 'border-warning/30';
          const wText = isUnknown ? 'text-content-secondary' : 'text-warning-fg';
          const wIcon = isUnknown ? <HelpCircle size={10} className="shrink-0 mt-0.5" /> : <AlertCircle size={10} className="shrink-0 mt-0.5" />;
          
          let wSubtext = '';
          if (warning.includes('unavailable')) {
            wSubtext = 'ADO relation exists, but the linked work item could not be loaded. It may be deleted, inaccessible, or outside your permissions.';
          } else if (warning.includes('unknown')) {
            wSubtext = 'State history could not be verified.';
          } else {
            wSubtext = 'This item appears to have been closed directly.';
          }
          
          return (
            <div key={idx} className={`flex flex-col justify-center p-1.5 rounded-md border ${wBg} ${wBorder} w-full shadow-sm text-left`} title={wSubtext}>
              <span className={`text-[9px] font-bold leading-tight ${wText} flex items-start gap-1`}>
                {wIcon}
                <span className="leading-tight">{warning}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // 2. Render Standard Readiness State
  let colorClass = 'bg-progress-fill';
  if (status.percentage === 100) colorClass = 'bg-success';
  else if (status.percentage < 40) colorClass = 'bg-warning';

  const tooltipText = `Readiness Criteria:\n${[
    { name: 'Parent Ready', met: status.evidence.parentReady, shortName: 'State' },
    { name: 'UAT Closed', met: status.evidence.uatClosed, shortName: 'UAT' },
    { name: 'Link Exists', met: status.evidence.linkExists, shortName: 'Link' },
    { name: 'Approved', met: status.evidence.isApproved, shortName: 'Approval' }
  ].map(c => {
    let name = c.name;
    if (c.shortName === 'Approval' && item.approvalStatus === 'unknown') {
      name = 'Approved (Unknown/Load Failed)';
    }
    return `${c.met ? '✅' : '❌'} ${name}`;
  }).join('\n')}`;

  const metCount = [status.evidence.parentReady, status.evidence.uatClosed, status.evidence.linkExists, status.evidence.isApproved].filter(Boolean).length;
  const totalCount = 4;

  return (
    <div className="flex flex-col gap-1.5 w-full min-w-[100px]" title={tooltipText}>
      <div className="flex justify-between items-center text-xs">
        <span className="font-medium text-content-secondary">Readiness</span>
        <span className={`font-bold ${status.percentage === 100 ? 'text-success' : 'text-content-primary'}`}>
          {status.percentage}%
        </span>
      </div>
      <div className="flex gap-0.5 h-2 w-full">
        {Array.from({ length: totalCount }).map((_, i) => (
          <div 
            key={i} 
            className={`flex-1 first:rounded-l-full last:rounded-r-full transition-colors duration-500 ${
              i < metCount ? colorClass : 'bg-progress-track'
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-content-secondary leading-tight mt-0.5">
        {status.statusLabel}
      </span>
    </div>
  );
}
