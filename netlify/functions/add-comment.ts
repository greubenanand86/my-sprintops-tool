import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders } from './utils/adoAuth';

function isAlreadyApproved(comments: any[]): boolean {
  if (!Array.isArray(comments)) return false;
  for (const c of comments) {
    if (!c || typeof c !== 'object') continue;
    const rawText = typeof c.text === 'string' ? c.text : '';
    if (!rawText.trim()) continue;
    const text = rawText
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (text === 'approved') return true;
  }
  return false;
}

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) };
  }

  try {
    const parsedBody = JSON.parse(event.body || '{}');
    const { ado, workItemId, text } = parsedBody;
    
    if (!ado?.orgUrl || !ado?.project || !workItemId || !text) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing required fields' } }) 
      };
    }

    // Use server-side PAT headers
    const authHeaders = getAdoAuthHeaders();

    const baseUrl = ado.orgUrl.replace(/\/$/, '');
    const adoUrl = `${baseUrl}/${encodeURIComponent(ado.project)}/_apis/wit/workItems/${workItemId}/comments?api-version=7.0-preview.3`;

    if (text.trim().toLowerCase() === 'approved') {
      const getRes = await axios.get(adoUrl, { headers: authHeaders, validateStatus: () => true });
      if (getRes.status === 200) {
        const comments = getRes.data?.comments || getRes.data?.value || [];
        if (isAlreadyApproved(comments)) {
          return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, message: 'Already approved', authType: 'pat' }) };
        }
      }
    }

    const response = await axios.post(adoUrl, { text }, { headers: authHeaders, validateStatus: () => true });

    if (response.status >= 200 && response.status < 300) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: response.data, authType: 'pat' }) };
    } else {
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: { code: response.status === 403 ? 'PERMISSION_DENIED' : 'AZDO_COMMENT_FAILED', message: response.data?.message || 'Failed to add comment' } 
        })
      };
    }
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: err.message } }) };
  }
};
