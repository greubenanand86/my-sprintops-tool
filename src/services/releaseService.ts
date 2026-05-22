import { SessionConfig } from '../types/config';
import { fetchWithRetry } from '../utils/api';
import { getApiUrl, safeParseApiResponse } from '../utils/apiUtils';
import { ReleaseTask, LinkedWorkItem, ReadinessStatus } from '../types/releaseModels';
import { toArray } from '../utils/arrayUtils';
import { parseReleaseMetadata, generateReleaseScopeHtml } from '../utils/releaseUtils';
import { AdoNormalizationService } from './adoNormalization';
import { enrichWithCommentsAndHistory } from './workItemsService';
import { resolveReadinessDisplayStatus, ReadinessDisplayStatus } from '../utils/readinessUtils';

const HEADERS = { 'Content-Type': 'application/json' };

export async function fetchReleaseTasks(cfg: SessionConfig): Promise<ReleaseTask[]> {
  const res = await fetchWithRetry(getApiUrl('release-tasks'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, iteration: cfg.iteration })
  });
  
  const parsed = await safeParseApiResponse(res);
  
  if (!parsed.ok || !parsed.data?.success) {
    throw new Error(parsed.data?.error?.message || 'Failed to fetch release tasks');
  }

  const releaseTasksRaw = toArray(parsed.data.value);
  const relatedItemsMap = parsed.data.relatedItemsMap || {};

  const normalized = AdoNormalizationService.normalizeWorkItems(Object.values(relatedItemsMap), cfg);
  const enrichedParents = await enrichWithCommentsAndHistory(normalized.parents, cfg);
  const parentsMap = new Map(enrichedParents.map(p => [p.id, p]));

  return releaseTasksRaw.map((wi: any): ReleaseTask => {
    const fields = wi.fields || {};
    const tags = (fields['System.Tags'] || '').split(';').map((t: string) => t.trim()).filter(Boolean);
    const title = fields['System.Title'] || `Release Task ${wi.id}`;
    const areaPath = fields['System.AreaPath'] || '';
    
    const { product, type, version } = parseReleaseMetadata(title, tags, areaPath);
    const relations = toArray(wi.relations);
    const relatedLinks = relations.filter(r => r.rel === 'System.LinkTypes.Related' || r.rel === 'Related');

    const linkedWorkItems: LinkedWorkItem[] = relatedLinks.map(rel => {
      const relId = parseInt(rel.url.split('/').pop() || '0', 10);
      const relItem = relatedItemsMap[relId];
      const parentItem = parentsMap.get(relId);
      
      let displayStatus: ReadinessDisplayStatus;
      
      if (parentItem) {
        displayStatus = resolveReadinessDisplayStatus(parentItem);
      } else {
        displayStatus = {
          displayMode: 'readiness',
          statusLabel: relItem ? 'Not a trackable parent' : 'Load Failed',
          statusSeverity: 'neutral',
          percentage: 0,
          missingReasons: [],
          warnings: [],
          evidence: { parentReady: false, uatClosed: false, linkExists: false, isApproved: false, postClosed: false }
        };
      }

      return {
        id: relId,
        title: relItem?.fields?.['System.Title'] || `Work Item ${relId}`,
        type: relItem?.fields?.['System.WorkItemType'] || 'Unknown',
        state: relItem?.fields?.['System.State'] || 'Unknown',
        iterationPath: relItem?.fields?.['System.IterationPath'] || '',
        areaPath: relItem?.fields?.['System.AreaPath'] || '',
        assignedTo: relItem?.fields?.['System.AssignedTo']?.displayName || 'Unassigned',
        tags: (relItem?.fields?.['System.Tags'] || '').split(';').map((t: string) => t.trim()).filter(Boolean),
        isLoadFailed: !relItem,
        displayStatus,
        parentItem
      };
    });

    let ready = 0, notReady = 0, deployed = 0, verified = 0, closedWithoutEvidence = 0, withWarnings = 0;
    
    linkedWorkItems.forEach(item => {
      const status = item.displayStatus;
      if (status.warnings.length > 0) withWarnings++;
      if (status.displayMode === 'closure') {
        if (status.statusLabel === 'Deployed and Verified') verified++;
        else if (status.statusLabel === 'Deployed') deployed++;
        else if (status.statusLabel === 'Closed Without Deployment Evidence') closedWithoutEvidence++;
        else notReady++;
      } else {
        if (status.percentage === 100) ready++;
        else notReady++;
      }
    });

    const total = linkedWorkItems.length;
    const readyLike = ready + deployed + verified;
    const readinessPercentage = total > 0 ? Math.round((readyLike / total) * 100) : 0;

    let readiness: ReadinessStatus = 'Not Ready';
    const state = fields['System.State'] || 'New';
    
    if (['Closed', 'Done', 'Production Deployed'].includes(state)) {
      readiness = 'Deployed';
    } else if (total > 0) {
      if (readinessPercentage === 100) readiness = 'Ready';
      else readiness = 'Not Ready';
    } else {
      readiness = 'Unknown';
    }

    return {
      id: wi.id, title, product, type, version, state, readiness, tags,
      iterationPath: fields['System.IterationPath'] || '',
      areaPath,
      assignedTo: fields['System.AssignedTo']?.displayName || 'Unassigned',
      createdDate: fields['System.CreatedDate'] || '',
      changedDate: fields['System.ChangedDate'] || '',
      linkedItems: { ready, notReady, deployed, verified, closedWithoutEvidence, withWarnings, total, readinessPercentage },
      linkedWorkItems,
      rawRelations: relations
    };
  });
}

export async function removeReleaseLink(cfg: SessionConfig, sourceId: number, targetId: number) {
  const res = await fetchWithRetry(getApiUrl('remove-link'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, sourceId, targetId })
  });
  
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok || !parsed.data?.success) throw new Error(parsed.data?.error?.message || 'Failed to remove link');
  return parsed.data.value;
}

export async function createReleaseTask(cfg: SessionConfig, payload: any) {
  const res = await fetchWithRetry(getApiUrl('create-release-task'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, ...payload })
  });
  
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok || !parsed.data?.success) throw new Error(parsed.data?.error?.message || 'Failed to create release task');
  return parsed.data.value;
}

export async function linkWorkItemsToRelease(cfg: SessionConfig, releaseTaskId: number, workItemIds: number[]) {
  const results = await Promise.allSettled(workItemIds.map(async (id) => {
    const res = await fetchWithRetry(getApiUrl('create-link'), {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ ado: cfg.ado, sourceId: releaseTaskId, targetId: id })
    });
    const parsed = await safeParseApiResponse(res);
    if (!parsed.ok || !parsed.data?.success) throw new Error(parsed.error?.message || `Failed to link #${id}`);
    return id;
  }));

  const succeeded = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<number>).value);
  const failed = results.filter(r => r.status === 'rejected').map(r => (r as PromiseRejectedResult).reason.message);

  return { succeeded, failed };
}

export async function syncReleaseDescription(cfg: SessionConfig, releaseTask: ReleaseTask) {
  const generatedHtml = generateReleaseScopeHtml(releaseTask, cfg.ado.orgUrl, cfg.ado.project);
  const res = await fetchWithRetry(getApiUrl('sync-release-description'), {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ ado: cfg.ado, releaseTaskId: releaseTask.id, generatedHtml })
  });
  
  const parsed = await safeParseApiResponse(res);
  if (!parsed.ok || !parsed.data?.success) throw new Error(parsed.data?.error?.message || 'Failed to sync description');
  return parsed.data.value;
}
