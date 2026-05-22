import { Handler } from '@netlify/functions';
import axios from 'axios';
import { getAdoAuthHeaders, getAdoBaseUrl, getAdoServerConfig } from './utils/adoAuth';

export const handler: Handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } }) };
  }

  try {
    const { orgUrl, project } = getAdoServerConfig();
    const authHeaders = getAdoAuthHeaders();
    
    const parsedBody = JSON.parse(event.body || '{}');
    const { iteration } = parsedBody;

    if (!iteration?.selectedPath) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ ok: false, error: { code: 'MISSING_ITERATION', message: 'No iteration path provided by frontend.' } }) 
      };
    }

    // 1. Query for Parent IDs
    const baseUrl = orgUrl;
    const wiqlUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.0`;
    const safeProject = project.replace(/'/g, "''");
    const safeIteration = String(iteration.selectedPath).replace(/'/g, "''");
    const query = `Select [System.Id] From WorkItems Where [System.TeamProject] = '${safeProject}' And [System.IterationPath] = '${safeIteration}'`;

    const wiqlRes = await axios.post(wiqlUrl, { query }, { headers: authHeaders, validateStatus: () => true });
    if (wiqlRes.status !== 200) {
      return { statusCode: wiqlRes.status, headers, body: JSON.stringify({ ok: false, error: { message: 'Failed to query work items.' } }) };
    }

    const ids = Array.isArray(wiqlRes.data?.workItems) ? wiqlRes.data.workItems.map((wi: any) => wi?.id).filter(Boolean) : [];
    if (ids.length === 0) return { statusCode: 200, headers, body: JSON.stringify({ ok: true, success: true, value: [], authType: 'pat' }) };

    // 2. Initial Batch Fetch for Parents
    const workItems: any[] = [];
    const parentsUrl = `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitemsbatch?api-version=7.0`;
    
    // PRESERVE: No 'fields' when using '$expand: "relations"'
    const itemsRes = await axios.post(parentsUrl, { ids, $expand: "relations", errorPolicy: "omit" }, { headers: authHeaders, validateStatus: () => true });
    if (itemsRes.status === 200 && Array.isArray(itemsRes.data?.value)) {
      workItems.push(...itemsRes.data.value.filter(Boolean));
    }

    // 3. Relation Discovery
    const missingIdsMap = new Map<number, string>();
    const fetchedIds = new Set(workItems.map(wi => wi?.id));
    
    workItems.forEach(wi => {
      if (!wi) return;
      const relations = Array.isArray(wi.relations) ? wi.relations : [];
      relations.forEach((rel: any) => {
        if (!rel?.url) return;
        const linkedId = parseInt(rel.url.split('/').pop() || '0', 10);
        if (linkedId && !fetchedIds.has(linkedId)) {
          missingIdsMap.set(linkedId, rel.url);
        }
      });
    });

    // 4. Hydration: Org-Scoped Batch (for cross-project items)
    const missingArray = Array.from(missingIdsMap.keys());
    const diagnostics: any = { relation_hydration: { requestedIds: missingArray, batchReturnedIds: [] as number[], directFetchAttempts: [] as any[] } };

    if (missingArray.length > 0) {
      const batchUrl = `${baseUrl}/_apis/wit/workitemsbatch?api-version=7.0`;
      const batchRes = await axios.post(batchUrl, { ids: missingArray, $expand: "relations", errorPolicy: "omit" }, { headers: authHeaders, validateStatus: () => true });
      
      if (batchRes.status === 200 && Array.isArray(batchRes.data?.value)) {
        batchRes.data.value.forEach((wi: any) => {
          if (!wi) return;
          workItems.push(wi);
          fetchedIds.add(wi.id);
          diagnostics.relation_hydration.batchReturnedIds.push(wi.id);
        });
      }

      // 5. Fallback: Direct URL for remaining items
      const omittedIds = missingArray.filter(id => !fetchedIds.has(id));
      for (const id of omittedIds) {
        let url = missingIdsMap.get(id)!;
        url += url.includes('?') ? '&api-version=7.0' : '?api-version=7.0';
        try {
          const directRes = await axios.get(url, { headers: authHeaders, validateStatus: () => true });
          if (directRes.status === 200 && directRes.data) {
            workItems.push(directRes.data);
            fetchedIds.add(id);
          }
        } catch (e) {}
      }
    }

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ ok: true, success: true, value: workItems, diagnostics, authType: 'pat' }) 
    };

  } catch (err: any) {
    return { 
      statusCode: err.statusCode || 500, 
      headers, 
      body: JSON.stringify({ ok: false, error: { code: err.code || 'RUNTIME_ERROR', message: err.message } }) 
    };
  }
};
