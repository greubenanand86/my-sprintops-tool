import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAuthType, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { message: 'Method not allowed' } }) };

  try {
    const { orgUrl, project } = getAdoServerConfig();
    const authHeaders = getAdoAuthHeaders();
    const authType = getAuthType();

    const baseUrl = orgUrl.replace(/\/$/, '');
    const adoUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/fields?api-version=7.0`;

    const response = await axios.get(adoUrl, {
      headers: authHeaders,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: response.data.value, authType }) };
    } else {
      return { 
        statusCode: response.status, 
        headers, 
        body: JSON.stringify({ ok: false, error: { message: response.data?.message || 'Failed to fetch fields', code: 'ADO_ERROR' }, authType }) 
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { message: err.message || 'Internal server error' } }) };
  }
};
