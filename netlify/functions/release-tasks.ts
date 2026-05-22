import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) };
  }

  try {
    const { orgUrl, project } = getAdoServerConfig();
    const authHeaders = getAdoAuthHeaders();
    
    const body = JSON.parse(event.body || '{}');
    const { iteration } = body;

    if (!iteration?.selectedPath) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_ITERATION', message: 'No iteration path provided.' } }) 
      };
    }

    const baseUrl = orgUrl;
    const wiqlUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`;
    const safeProject = project.replace(/'/g, "''");
    const safeIteration = String(iteration.selectedPath).replace(/'/g, "''");
    
    const query = `Select [System.Id] From WorkItems Where [System.TeamProject] = '${safeProject}' And [System.IterationPath] = '${safeIteration}' And [System.Tags] Contains 'Release task'`;

    const wiqlRes = await axios.post(wiqlUrl, { query }, { headers: authHeaders, validateStatus: () => true });

    if (wiqlRes.status !== 200) {
      return { statusCode: wiqlRes.status, headers, body: JSON.stringify({ ok: false, error: { code: 'WORKITEM_QUERY_FAILED', message: 'Failed to query release tasks.' } }) };
    }

    const ids = Array.isArray(wiqlRes.data?.workItems) ? wiqlRes.data.workItems.map((wi: any) => wi?.id).filter(Boolean) : [];
    
    if (ids.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: [], authType: 'pat' }) };
    }

    const itemsUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitemsbatch?api-version=7.0`;
    const itemsRes = await axios.post(itemsUrl, {
      ids,
      $expand: "relations",
      errorPolicy: "omit"
    }, { headers: authHeaders, validateStatus: () => true });
    
    if (itemsRes.status !== 200 || !Array.isArray(itemsRes.data?.value)) {
      return { statusCode: itemsRes.status, headers, body: JSON.stringify({ ok: false, error: { code: 'WORKITEM_FETCH_FAILED', message: 'Failed to fetch release task details' } }) };
    }

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ 
        ok: true, 
        success: true, 
        value: itemsRes.data.value,
        authType: 'pat'
      }) 
    };

  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
