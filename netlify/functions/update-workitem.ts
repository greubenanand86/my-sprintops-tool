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
    const { ado, id, patchDocument } = parsedBody;
    
    if (!ado?.orgUrl || !ado?.project || !id || !patchDocument) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields' } }) 
      };
    }

    // Use server-side PAT headers
    const authHeaders = getAdoAuthHeaders();
    const { orgUrl, project } = getAdoServerConfig();

    const patchHeaders = { 
      ...authHeaders, 
      'Content-Type': 'application/json-patch+json'
    };

    const baseUrl = orgUrl;
    const adoUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${id}?api-version=7.0`;

    const response = await axios.patch(adoUrl, patchDocument, { headers: patchHeaders, validateStatus: () => true });

    if (response.status >= 200 && response.status < 300) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, success: true, value: response.data, authType: 'pat' })
      };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: { 
            code: response.status === 403 ? 'PERMISSION_DENIED' : 'AZDO_UPDATE_FAILED', 
            message: response.data?.message || 'Failed to update work item' 
          } 
        })
      };
    }
  } catch (err: any) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) 
    };
  }
};
