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

    // 1. Verify target exists
    const targetUrl = `${baseUrl}/_apis/wit/workitems/${targetId}?api-version=7.0`;
    const targetRes = await axios.get(targetUrl, { headers: authHeaders, validateStatus: () => true });
    
    if (targetRes.status === 404) {
      return { statusCode: 404, headers, body: JSON.stringify({ ok: false, error: { code: 'TARGET_NOT_FOUND', message: `Target work item #${targetId} does not exist.` } }) };
    }

    // 2. Check if link already exists
    const sourceUrl = `${baseUrl}/_apis/wit/workitems/${sourceId}?$expand=relations&api-version=7.0`;
    const sourceRes = await axios.get(sourceUrl, { headers: authHeaders, validateStatus: () => true });
    
    if (sourceRes.status === 200 && sourceRes.data.relations) {
      const targetWorkItemUrl = `${baseUrl}/_apis/wit/workItems/${targetId}`.toLowerCase();
      const linkExists = sourceRes.data.relations.some((rel: any) => 
        (rel.rel === 'System.LinkTypes.Related' || rel.rel === 'ArtifactLink') && 
        rel.url.toLowerCase() === targetWorkItemUrl
      );

      if (linkExists) {
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, message: 'Link already exists', authType: 'pat' }) };
      }
    }

    // 3. Create the link
    const patchDocument = [{
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Related',
        url: `${baseUrl}/_apis/wit/workItems/${targetId}`,
        attributes: { comment: 'Linked via SprintOps Console' }
      }
    }];

    const patchUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${sourceId}?api-version=7.0`;
    const response = await axios.patch(patchUrl, patchDocument, { headers: patchHeaders, validateStatus: () => true });

    if (response.status >= 200 && response.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: response.data, authType: 'pat' }) };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: { code: response.status === 403 ? 'PERMISSION_DENIED' : 'AZDO_LINK_FAILED', message: response.data?.message || 'Failed to create link' } 
        })
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
