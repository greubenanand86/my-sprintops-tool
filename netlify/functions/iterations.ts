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

    const body = JSON.parse(event.body || '{}');
    const team = body.team || process.env.ADO_TEAM || (project + " Team");

    const baseUrl = orgUrl.replace(/\/$/, '');
    const adoUrl = `${baseUrl}/${encodeURIComponent(project)}/${encodeURIComponent(team)}/_apis/work/teamsettings/iterations?api-version=7.0`;

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
        body: JSON.stringify({ ok: false, error: { message: response.data?.message || 'Failed to fetch iterations', code: 'ADO_ERROR' }, authType }) 
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { message: err.message || 'Internal server error' } }) };
  }
};
