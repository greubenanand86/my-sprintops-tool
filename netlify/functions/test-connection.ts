import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAdoBaseUrl, getAuthType } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: { message: 'Only POST is supported' } })
    };
  }

  try {
    // Validate server configuration first
    const authHeaders = getAdoAuthHeaders();
    const baseUrl = getAdoBaseUrl(true); // Test connection to the specific team/project
    
    const body = JSON.parse(event.body || '{}');
    const team = body.team || process.env.ADO_PROJECT + " Team"; // Fallback to a guessed team name

    const adoUrl = `${baseUrl}/_apis/projects/${encodeURIComponent(process.env.ADO_PROJECT || '')}/teams/${encodeURIComponent(team)}?api-version=7.0`;

    const response = await axios.get(adoUrl, {
      headers: authHeaders,
      validateStatus: () => true
    });

    if (response.status >= 200 && response.status < 300) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true, 
          status: 200, 
          message: 'Server-side PAT connection successful',
          authType: 'pat',
          details: { 
            project: process.env.ADO_PROJECT,
            team: team
          }
        })
      };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          ok: false, 
          status: response.status, 
          code: 'ADO_CONNECTION_FAILED', 
          message: response.status === 401 ? 'The server-side PAT is invalid or expired.' : 'Failed to connect to Azure DevOps.',
          details: { rawStatus: response.status }
        })
      };
    }
  } catch (err: any) {
    return {
      statusCode: err.statusCode || 500,
      headers,
      body: JSON.stringify({
        ok: false, 
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Failed to process request.'
      })
    };
  }
};
