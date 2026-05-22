import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAuthType, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers, 
      body: JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) 
    };
  }

  try {
    const { orgUrl, project } = getAdoServerConfig();
    const authHeaders = getAdoAuthHeaders();
    const authType = getAuthType();

    const body = JSON.parse(event.body || '{}');
    const { taskId } = body;
    
    if (!taskId) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing taskId' } }) 
      };
    }

    const baseUrl = orgUrl.replace(/\/$/, '');
    const adoUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${taskId}?$expand=relations&api-version=7.0`;

    const response = await axios.get(adoUrl, { headers: authHeaders, validateStatus: () => true });

    if (response.status === 404) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ ok: false, error: { code: 'TASK_NOT_FOUND', message: `Work item #${taskId} not found or access denied.` }, authType })
      };
    }

    if (response.status !== 200) {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ ok: false, error: { code: 'ADO_ERROR', message: response.data?.message || `HTTP ${response.status}` }, authType })
      };
    }

    const wi = response.data;
    const type = wi.fields?.['System.WorkItemType'];

    if (type !== 'Task') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: { code: 'INVALID_WORK_ITEM_TYPE', message: `Work item #${taskId} is a '${type}', not a 'Task'.` },
          authType 
        })
      };
    }

    let parentId = null;
    if (Array.isArray(wi.relations)) {
      const parentRel = wi.relations.find((r: any) => r.rel === 'System.LinkTypes.Hierarchy-Reverse');
      if (parentRel && parentRel.url) {
        parentId = parseInt(parentRel.url.split('/').pop() || '0', 10) || null;
      }
    }

    const taskDetails = {
      id: wi.id,
      title: wi.fields?.['System.Title'] || '',
      type: wi.fields?.['System.WorkItemType'] || '',
      state: wi.fields?.['System.State'] || '',
      iterationPath: wi.fields?.['System.IterationPath'] || '',
      assignedTo: wi.fields?.['System.AssignedTo']?.displayName || 'Unassigned',
      tags: wi.fields?.['System.Tags'] || '',
      parentId
    };

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: taskDetails, authType }) };

  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
