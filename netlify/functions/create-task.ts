import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAdoBaseUrl, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { message: 'Method not allowed' } }) };
  }

  try {
    const authHeaders = getAdoAuthHeaders();
    const { project, orgUrl } = getAdoServerConfig();
    
    const parsedBody = JSON.parse(event.body || '{}');
    const { taskType, title, assignedTo, iterationPath, areaPath, parentId } = parsedBody;
    
    if (!title || !parentId) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: { message: 'Missing title or parentId' } }) };
    }

    const patchHeaders = { ...authHeaders, 'Content-Type': 'application/json-patch+json' };

    // 1. Create Task
    const createUrl = `${orgUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$Task?api-version=7.0`;
    const patchDoc: any[] = [
      { op: 'add', path: '/fields/System.Title', value: title },
      {
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `${orgUrl}/_apis/wit/workItems/${parentId}`
        }
      }
    ];
    
    if (assignedTo) patchDoc.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo });
    if (iterationPath) patchDoc.push({ op: 'add', path: '/fields/System.IterationPath', value: iterationPath });
    if (areaPath) patchDoc.push({ op: 'add', path: '/fields/System.AreaPath', value: areaPath });

    const createRes = await axios.post(createUrl, patchDoc, { headers: patchHeaders, validateStatus: () => true });

    if (createRes.status >= 200 && createRes.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: createRes.data }) };
    } else {
      return { statusCode: createRes.status, headers, body: JSON.stringify({ ok: false, error: { message: createRes.data?.message || 'Failed to create task' } }) };
    }
  } catch (err: any) {
    return { statusCode: err.statusCode || 500, headers, body: JSON.stringify({ ok: false, error: { message: err.message } }) };
  }
};
