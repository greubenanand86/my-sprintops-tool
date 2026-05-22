import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAuthType, getAdoServerConfig } from './utils/adoAuth';

function checkApproval(comments: any[]): { isApproved: boolean, matchedCommentId?: number } {
  if (!Array.isArray(comments)) return { isApproved: false };

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
      
    if (text === 'approved') {
      return { isApproved: true, matchedCommentId: c.id };
    }
  }
  return { isApproved: false };
}

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
    const { workItemIds } = body;
    
    if (!Array.isArray(workItemIds)) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_FIELDS', message: 'Missing workItemIds' } }) 
      };
    }

    const baseUrl = orgUrl.replace(/\/$/, '');
    const results: Record<number, { 
      success: boolean, 
      approvalStatus: 'approved' | 'not_approved' | 'unknown', 
      approvalMatchedCommentId?: number,
      error?: any 
    }> = {};

    const batchSize = 5;
    for (let i = 0; i < workItemIds.length; i += batchSize) {
      const batch = workItemIds.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (id) => {
        try {
          const url = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workItems/${id}/comments?api-version=7.0-preview.3`;
          const res = await axios.get(url, { headers: authHeaders, validateStatus: () => true });
          
          if (res.status === 200) {
            const comments = res.data?.comments || res.data?.value || [];
            const approvalResult = checkApproval(comments);
            results[id] = { 
              success: true, 
              approvalStatus: approvalResult.isApproved ? 'approved' : 'not_approved',
              approvalMatchedCommentId: approvalResult.matchedCommentId
            };
          } else {
            results[id] = { 
              success: false, 
              approvalStatus: 'unknown',
              error: { stage: 'comments_fetch', message: res.data?.message || `HTTP ${res.status}`, rawStatus: res.status }
            };
          }
        } catch (e: any) {
          results[id] = { 
            success: false, 
            approvalStatus: 'unknown',
            error: { stage: 'network', message: e.message }
          };
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
