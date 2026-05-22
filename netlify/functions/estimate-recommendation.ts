import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, status: 405, code: 'METHOD_NOT_ALLOWED', message: 'Only POST is supported' }) };
  }

  try {
    const { orgUrl, project } = getAdoServerConfig();
    const authHeaders = getAdoAuthHeaders();

    const body = JSON.parse(event.body || '{}');
    const { workItemId, aiConfig, apiKey } = body;

    if (!workItemId || !aiConfig || !apiKey) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, status: 400, code: 'MISSING_FIELDS', message: 'Missing workItemId, AI config, or API key.' }) };
    }

    const baseUrl = orgUrl.replace(/\/$/, '');
    const wiUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?$expand=all&api-version=7.0`;
    const wiRes = await axios.get(wiUrl, { headers: authHeaders, validateStatus: () => true });

    if (wiRes.status !== 200) {
      return { statusCode: wiRes.status, headers, body: JSON.stringify({ ok: false, status: wiRes.status, code: 'WORKITEM_FETCH_FAILED', message: wiRes.data?.message || 'Failed to fetch work item details.' }) };
    }

    // AI logic placeholder
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, message: 'AI logic placeholder' }) };

  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, status: 500, code: 'INTERNAL_ERROR', message: err.message }) };
  }
};
