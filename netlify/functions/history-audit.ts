import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAuthType, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) };
  }

  try {
    const { orgUrl, project } = getAdoServerConfig();
    const authHeaders = getAdoAuthHeaders();
    const authType = getAuthType();

    const body = JSON.parse(event.body || '{}');
    const { workItemIds, targetState } = body;
    
    if (!Array.isArray(workItemIds) || !targetState) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing workItemIds or targetState' } }) 
      };
    }

    const baseUrl = orgUrl.replace(/\/$/, '');
    const results: Record<number, 'passed_ready_for_production' | 'not_found' | 'unknown'> = {};

    const batchSize = 5;
    for (let i = 0; i < workItemIds.length; i += batchSize) {
      const batch = workItemIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (id) => {
        try {
          const url = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workItems/${id}/updates?api-version=7.0`;
          const res = await axios.get(url, { headers: authHeaders, validateStatus: () => true });
          
          if (res.status === 200) {
            const updates = res.data?.value || [];
            let passed = false;
            for (const update of updates) {
              const stateField = update.fields?.['System.State'];
              if (stateField && stateField.newValue === targetState) {
                passed = true;
                break;
              }
            }
            results[id] = passed ? 'passed_ready_for_production' : 'not_found';
          } else {
            results[id] = 'unknown';
          }
        } catch (e: any) {
          results[id] = 'unknown';
        }
      }));

      if (i + batchSize < workItemIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: results, authType }) };

  } catch (err: any) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) 
    };
  }
};
