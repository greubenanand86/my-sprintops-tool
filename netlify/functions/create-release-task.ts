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
    const { ado, title, description, iterationPath, areaPath, assignedTo, tags } = parsedBody;
    
    if (!ado?.orgUrl || !ado?.project || !title) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields' } }) 
      };
    }

    const authHeaders = getAdoAuthHeaders();
    const { orgUrl, project } = getAdoServerConfig();

    const patchHeaders = { ...authHeaders, 'Content-Type': 'application/json-patch+json' };
    const baseUrl = orgUrl;
    const createUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$Task?api-version=7.0`;
    
    const patchDoc: any[] = [
      { op: 'add', path: '/fields/System.Title', value: title }
    ];
    
    if (tags && Array.isArray(tags)) patchDoc.push({ op: 'add', path: '/fields/System.Tags', value: tags.join('; ') });
    if (description) patchDoc.push({ op: 'add', path: '/fields/System.Description', value: description });
    if (iterationPath) patchDoc.push({ op: 'add', path: '/fields/System.IterationPath', value: iterationPath });
    if (areaPath) patchDoc.push({ op: 'add', path: '/fields/System.AreaPath', value: areaPath });
    if (assignedTo) patchDoc.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignedTo });

    const createRes = await axios.post(createUrl, patchDoc, { headers: patchHeaders, validateStatus: () => true });

    if (createRes.status >= 200 && createRes.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: createRes.data, authType: 'pat' }) };
    } else {
      return {
        statusCode: createRes.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: { code: createRes.status === 403 ? 'PERMISSION_DENIED' : 'AZDO_CREATE_FAILED', message: createRes.data?.message || 'Failed to create release task' } 
        })
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
