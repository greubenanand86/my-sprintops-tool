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
    const { ado, sourceId, targetId } = parsedBody;
    
    if (!ado?.orgUrl || !ado?.project || !sourceId || !targetId) {
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

    // 1. Fetch source to find index
    const sourceUrl = `${baseUrl}/_apis/wit/workitems/${sourceId}?$expand=relations&api-version=7.0`;
    const sourceRes = await axios.get(sourceUrl, { headers: authHeaders, validateStatus: () => true });
    
    if (sourceRes.status !== 200) {
      return { statusCode: sourceRes.status, headers, body: JSON.stringify({ ok: false, error: { code: 'SOURCE_FETCH_FAILED', message: `Failed to fetch source #${sourceId}` } }) };
    }

    const targetUrl = `${baseUrl}/_apis/wit/workItems/${targetId}`.toLowerCase();
    const relIndex = (sourceRes.data.relations || []).findIndex((rel: any) => 
      (rel.rel === 'System.LinkTypes.Related' || rel.rel === 'ArtifactLink' || rel.rel === 'Related') && 
      rel.url.toLowerCase() === targetUrl
    );

    if (relIndex === -1) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, message: 'Link already removed', authType: 'pat' }) };
    }

    // 2. Remove
    const patchDoc = [{ op: 'remove', path: `/relations/${relIndex}` }];
    const patchUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${sourceId}?api-version=7.0`;
    const response = await axios.patch(patchUrl, patchDoc, { headers: patchHeaders, validateStatus: () => true });

    if (response.status >= 200 && response.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: response.data, authType: 'pat' }) };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: { code: response.status === 403 ? 'PERMISSION_DENIED' : 'AZDO_UNLINK_FAILED', message: response.data?.message || 'Failed to remove link' } 
        })
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
