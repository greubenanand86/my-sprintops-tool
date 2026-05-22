import { SessionConfig } from '../types/config';
import { fetchWithRetry } from '../utils/api';
import { getApiUrl, safeParseApiResponse } from '../utils/apiUtils';
import { AdoNormalizationService } from './adoNormalization';
import { ParentWorkItem, ChildWorkItem } from '../types/adoModels';
import { toArray } from '../utils/arrayUtils';
import { isTerminalState } from '../utils/actionabilityUtils';

const HEADERS = { 'Content-Type': 'application/json' };

export async function fetchRawWorkItems(cfg: SessionConfig): Promise<{ items: any[], currentUser?: any, diagnostics?: any }> {
  const res = await fetchWithRetry(getApiUrl('workitems'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, iteration: cfg.iteration })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  if (!parsed.data?.success) throw new Error(parsed.data?.error?.message || 'Failed to fetch work items');
  return { 
    items: toArray(parsed.data.value), 
    currentUser: parsed.data.currentUser,
    diagnostics: parsed.data.diagnostics
  };
}

export async function enrichWithCommentsAndHistory(parents: ParentWorkItem[], cfg: SessionConfig): Promise<ParentWorkItem[]> {
  const parentIds = parents.map(p => p.id);
  if (parentIds.length === 0) return parents;

  try {
    const commentsRes = await fetchWithRetry(getApiUrl('comments'), {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ ado: cfg.ado, workItemIds: parentIds })
    });
    const commentsParsed = await safeParseApiResponse(commentsRes);
    if (commentsParsed.ok && commentsParsed.data?.success) {
      const commentsMap = commentsParsed.data.value;
      parents.forEach(p => {
        const itemCommentsData = commentsMap[p.id];
        if (!itemCommentsData || !itemCommentsData.success) {
          p.isApproved = false;
          p.approvalStatus = 'unknown';
          return;
        }
        p.approvalStatus = itemCommentsData.approvalStatus;
        p.isApproved = itemCommentsData.approvalStatus === 'approved';
      });
    }
  } catch (e) {
    console.error('Failed to fetch comments', e);
  }

  const terminalParentIds = parents.filter(p => isTerminalState(p.state)).map(p => p.id);
  if (terminalParentIds.length > 0) {
    try {
      const historyRes = await fetchWithRetry(getApiUrl('history-audit'), {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ ado: cfg.ado, workItemIds: terminalParentIds, targetState: cfg.readiness.parentState })
      });
      const historyParsed = await safeParseApiResponse(historyRes);
      if (historyParsed.ok && historyParsed.data?.success) {
        const historyMap = historyParsed.data.value;
        parents.forEach(p => {
          if (isTerminalState(p.state)) p.readyForProdTransition = historyMap[p.id] || 'unknown';
        });
      }
    } catch (e) {
      console.error('Failed to fetch history audit', e);
    }
  }
  return parents;
}

export async function fetchAndNormalizeWorkItems(cfg: SessionConfig): Promise<{ parents: ParentWorkItem[], unparentedTasks: ChildWorkItem[], currentUser?: any }> {
  const { items, currentUser, diagnostics } = await fetchRawWorkItems(cfg);
  const normalized = AdoNormalizationService.normalizeWorkItems(items, cfg, diagnostics);
  const enrichedParents = await enrichWithCommentsAndHistory(normalized.parents, cfg);
  return { parents: enrichedParents, unparentedTasks: normalized.unparentedTasks, currentUser };
}

export async function validateExistingTask(cfg: SessionConfig, taskId: number) {
  const res = await fetchWithRetry(getApiUrl('validate-task'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, taskId })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  return parsed.data.value;
}

export async function linkExistingTask(cfg: SessionConfig, parentId: number, taskId: number, slot: string) {
  const res = await fetchWithRetry(getApiUrl('link-task'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, parentId, taskId, slot })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  return parsed.data.value;
}

export async function updateWorkItem(cfg: SessionConfig, id: number, patchDocument: any[]) {
  const res = await fetchWithRetry(getApiUrl('update-workitem'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, id, patchDocument })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  return parsed.data.value;
}

export async function createTask(cfg: SessionConfig, payload: any) {
  const res = await fetchWithRetry(getApiUrl('create-task'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, ...payload })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  return parsed.data.value;
}

export async function createLink(cfg: SessionConfig, sourceId: number, targetId: number) {
  const res = await fetchWithRetry(getApiUrl('create-link'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, sourceId, targetId })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  return parsed.data.value;
}

export async function addComment(cfg: SessionConfig, workItemId: number, text: string) {
  const res = await fetchWithRetry(getApiUrl('add-comment'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, workItemId, text })
  });
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok) throw parsed.error;
  return parsed.data.value;
}
