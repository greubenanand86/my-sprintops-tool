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
    const { ado, releaseTaskId, generatedHtml } = parsedBody;
    
    if (!ado?.orgUrl || !ado?.project || !releaseTaskId || !generatedHtml) {
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

    // 1. Fetch current
    const getUrl = `${baseUrl}/_apis/wit/workitems/${releaseTaskId}?$expand=fields&api-version=7.0`;
    const getRes = await axios.get(getUrl, { headers: authHeaders, validateStatus: () => true });

    if (getRes.status !== 200) {
      return { statusCode: getRes.status, headers, body: JSON.stringify({ ok: false, error: { code: 'FETCH_FAILED', message: `Failed to fetch release task #${releaseTaskId}` } }) };
    }

    const currentDesc = getRes.data?.fields?.['System.Description'] || '';
    const startMarker = '<!-- SprintOps:ReleaseScope:Start -->';
    const endMarker = '<!-- SprintOps:ReleaseScope:End -->';
    const newSection = `${startMarker}\n${generatedHtml}\n${endMarker}`;
    const regex = /<!-- SprintOps:ReleaseScope:Start -->[\s\S]*?<!-- SprintOps:ReleaseScope:End -->/i;
    
    const newDesc = regex.test(currentDesc) 
      ? currentDesc.replace(regex, newSection) 
      : currentDesc + (currentDesc ? '<br><br>' : '') + newSection;

    // 2. Patch
    const patchDoc = [{ op: 'add', path: '/fields/System.Description', value: newDesc }];
    const patchUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${releaseTaskId}?api-version=7.0`;
    const patchRes = await axios.patch(patchUrl, patchDoc, { headers: patchHeaders, validateStatus: () => true });

    if (patchRes.status >= 200 && patchRes.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: patchRes.data, authType: 'pat' }) };
    } else {
      return {
        statusCode: patchRes.status,
        headers,
        body: JSON.stringify({ ok: false, error: { code: patchRes.status === 403 ? 'PERMISSION_DENIED' : 'PATCH_FAILED', message: patchRes.data?.message || 'Failed to update description' } })
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
