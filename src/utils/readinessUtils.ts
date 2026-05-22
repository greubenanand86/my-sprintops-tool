import { ParentWorkItem } from '../types/adoModels';

export function isClosureState(state: string | undefined): boolean {
  if (!state) return false;
  const s = state.toLowerCase().trim();
  return ['closed', 'done', 'production deployed', 'cut', 'removed'].includes(s);
}

export interface ReadinessDisplayStatus {
  displayMode: 'readiness' | 'closure';
  statusLabel: string;
  statusSeverity: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  percentage: number;
  missingReasons: string[];
  warnings: string[];
  evidence: {
    parentReady: boolean;
    uatClosed: boolean;
    linkExists: boolean;
    isApproved: boolean;
    postClosed: boolean;
  };
}

/**
 * Centralized resolver for work item readiness and closure status.
 * Differentiates between active items (percentage-based readiness) 
 * and closed items (deployment evidence verification).
 */
export function resolveReadinessDisplayStatus(item: ParentWorkItem): ReadinessDisplayStatus {
  const parentReady = item.state === 'Ready for Production';
  const uatClosed = item.tasks.UAT.actionState === 'created' && item.tasks.UAT.adoState === 'Closed';
  const linkExists = item.link.actionState === 'created';
  const isApproved = item.approvalStatus === 'approved';
  const postClosed = item.tasks.Post.actionState === 'created' && item.tasks.Post.adoState === 'Closed';

  const evidence = { parentReady, uatClosed, linkExists, isApproved, postClosed };

  const hasUnavailableChildren = item.allChildren.some(c => c.isUnavailableRelation || c.isLoadFailed);
  const hasUnavailableRelated = item.relatedItems.some(r => r.isUnavailableRelation || r.isLoadFailed);
  const isLinkUnavailable = item.link.isUnavailableRelation || item.link.isLoadFailed;

  // 1. Handle Closed/Terminal Items
  if (isClosureState(item.state)) {
    let statusLabel = '';
    let statusSeverity: ReadinessDisplayStatus['statusSeverity'] = 'neutral';
    const missingReasons: string[] = [];
    const warnings: string[] = [];

    // Fail closed: Only show Deployed and Verified if evidence is actually proven
    if (linkExists && !isLinkUnavailable && postClosed) {
      statusLabel = 'Deployed and Verified';
      statusSeverity = 'success';
    } else if (linkExists) {
      statusLabel = 'Deployed';
      statusSeverity = 'info';
      
      if (isLinkUnavailable) {
        missingReasons.push('Deployment link exists but task details unavailable');
      }
      
      if (item.tasks.Post.actionState !== 'created') {
        if (hasUnavailableChildren) {
          missingReasons.push('Post deployment evidence unavailable');
        } else {
          missingReasons.push('Post Deployment Task missing');
        }
      } else if (!postClosed) {
        missingReasons.push('Post Deployment Task not closed');
      }
    } else {
      statusLabel = 'Closed Without Deployment Evidence';
      statusSeverity = 'warning';
      if (hasUnavailableRelated) {
        missingReasons.push('Deployment evidence unavailable');
      } else {
        missingReasons.push('No deployment link');
      }
    }

    // Transition Audit Warnings
    if (item.readyForProdTransition === 'not_found') {
      warnings.push('Closed Without Ready-for-Production Transition');
    } else if (item.readyForProdTransition === 'unknown') {
      warnings.push('Ready-for-Production transition unknown');
    }

    // Load Failure Warnings (Honest Evidence Reporting)
    if (hasUnavailableChildren) {
      warnings.push('Some child tasks are unavailable');
    }
    if (hasUnavailableRelated) {
      warnings.push('Some related items are unavailable');
    }

    return {
      displayMode: 'closure',
      statusLabel,
      statusSeverity,
      percentage: 100, // Conceptually 100% through its lifecycle
      missingReasons,
      warnings,
      evidence
    };
  }

  // 2. Handle Active Items (Standard Readiness)
  const criteria = [
    { name: 'Parent Ready', met: parentReady, shortName: 'State' },
    { name: 'UAT Closed', met: uatClosed, shortName: 'UAT' },
    { name: 'Link Exists', met: linkExists, shortName: 'Link' },
    { name: 'Approved', met: isApproved, shortName: 'Approval' }
  ];

  const metCount = criteria.filter(c => c.met).length;
  const totalCount = criteria.length;
  const percentage = Math.round((metCount / totalCount) * 100);

  const missing = criteria.filter(c => !c.met).map(c => c.shortName);
  let statusLabel = '';
  
  if (missing.length === 0) {
    statusLabel = 'Ready for production';
  } else if (missing.length === 1) {
    if (missing[0] === 'State') statusLabel = 'Not in Ready state';
    else if (missing[0] === 'UAT') statusLabel = hasUnavailableChildren ? 'UAT evidence unavailable' : 'Missing UAT task';
    else if (missing[0] === 'Link') statusLabel = hasUnavailableRelated ? 'Deployment evidence unavailable' : 'Missing deploy link';
    else if (missing[0] === 'Approval') {
      statusLabel = item.approvalStatus === 'unknown' ? 'Approval unknown' : 'Missing Approved comment';
    }
  } else {
    const missingLabels = missing.map(m => {
      if (m === 'UAT' && hasUnavailableChildren) return 'UAT (unavailable)';
      if (m === 'Link' && hasUnavailableRelated) return 'Link (unavailable)';
      if (m === 'Approval' && item.approvalStatus === 'unknown') return 'Approval (unknown)';
      return m;
    });
    statusLabel = `Missing: ${missingLabels.join(', ')}`;
  }

  let statusSeverity: ReadinessDisplayStatus['statusSeverity'] = 'success';
  if (percentage < 100 && percentage >= 40) statusSeverity = 'info';
  if (percentage < 40) statusSeverity = 'warning';

  return {
    displayMode: 'readiness',
    statusLabel,
    statusSeverity,
    percentage,
    missingReasons: missing,
    warnings: [],
    evidence
  };
}
