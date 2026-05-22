import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) };
  }

  try {
    const parsedBody = JSON.parse(event.body || '{}');
    const { ado, parentId, taskId, slot } = parsedBody;
    
    if (!ado?.orgUrl || !ado?.project || !parentId || !taskId || !slot) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields' } }) };
    }

    const authHeaders = getAdoAuthHeaders();
    const { orgUrl, project } = getAdoServerConfig();

    const patchHeaders = { ...authHeaders, 'Content-Type': 'application/json-patch+json' };
    const baseUrl = orgUrl;

    const slotTagMap: Record<string, string> = {
      dev: 'SprintOps:DEV',
      qa: 'SprintOps:QA',
      uat: 'SprintOps:UAT',
      post_deployment: 'SprintOps:POST_DEPLOYMENT'
    };

    const targetTag = slotTagMap[slot];
    if (!targetTag) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: { code: 'INVALID_SLOT', message: 'Invalid readiness slot' } }) };
    }

    // 1. Validate Task
    const taskUrl = `${baseUrl}/_apis/wit/workitems/${taskId}?$expand=relations&api-version=7.0`;
    const taskRes = await axios.get(taskUrl, { headers: authHeaders, validateStatus: () => true });
    if (taskRes.status !== 200) {
      return { statusCode: taskRes.status, headers, body: JSON.stringify({ ok: false, error: { code: 'TASK_FETCH_FAILED', message: `Failed to fetch task #${taskId}` } }) };
    }

    const task = taskRes.data;
    if (task.fields?.['System.WorkItemType'] !== 'Task') {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: { code: 'INVALID_TYPE', message: `Work item #${taskId} is not a Task.` } }) };
    }

    // 2. Check Relations (Strict Reparenting Block)
    const relations = task.relations || [];
    const parentRel = relations.find((r: any) => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
    let needsLinking = true;

    if (parentRel) {
      const existingParentId = parseInt(parentRel.url.split('/').pop() || '0', 10);
      if (existingParentId === parentId) {
        needsLinking = false;
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            ok: false,
            error: { code: 'REPARENTING_BLOCKED', message: `Task #${taskId} is linked to another parent (#${existingParentId}).` }
          })
        };
      }
    }

    // 3. Build Patch
    const patchDoc: any[] = [];
    if (needsLinking) {
      patchDoc.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${baseUrl}/_apis/wit/workItems/${parentId}`
        }
      });
    }

    const tags = (task.fields?.['System.Tags'] || '').split(';').map((t: string) => t.trim()).filter((t: string) => t && !t.startsWith('SprintOps:'));
    tags.push(targetTag);
    patchDoc.push({ op: 'add', path: '/fields/System.Tags', value: tags.join('; ') });

    const patchUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${taskId}?api-version=7.0`;
    const patchRes = await axios.patch(patchUrl, patchDoc, { headers: patchHeaders, validateStatus: () => true });

    if (patchRes.status >= 200 && patchRes.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: patchRes.data, authType: 'pat' }) };
    } else {
      return {
        statusCode: patchRes.status,
        headers,
        body: JSON.stringify({ ok: false, error: { code: patchRes.status === 403 ? 'PERMISSION_DENIED' : 'PATCH_FAILED', message: patchRes.data?.message || 'Failed to update task' } })
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
