/**
 * SprintOps Console - Backend Auth Utility
 * 
 * This module handles server-side authentication for Azure DevOps using 
 * Personal Access Tokens (PAT). Credentials are pulled exclusively from 
 * environment variables to ensure zero exposure to the frontend.
 */

export interface AdoServerConfig {
  pat: string;
  orgUrl: string;
  project: string;
}

/**
 * Retrieves and validates the ADO configuration from environment variables.
 * Throws structured errors if configuration is missing.
 */
export function getAdoServerConfig(): AdoServerConfig {
  const pat = process.env.ADO_PAT;
  const orgUrl = process.env.ADO_ORG_URL;
  const project = process.env.ADO_PROJECT;

  if (!pat) {
    throw { 
      statusCode: 500, 
      code: 'MISSING_SERVER_PAT', 
      message: 'Azure DevOps PAT is not configured on the server.' 
    };
  }

  if (!orgUrl) {
    throw { 
      statusCode: 500, 
      code: 'MISSING_SERVER_ORG_URL', 
      message: 'Azure DevOps Organization URL is not configured on the server.' 
    };
  }

  return {
    pat,
    orgUrl: orgUrl.replace(/\/$/, ''),
    project: project || ''
  };
}

/**
 * Generates the Basic Authentication headers required for ADO REST API.
 * Format: Basic base64(:PAT)
 */
export function getAdoAuthHeaders(): Record<string, string> {
  const { pat } = getAdoServerConfig();
  
  // ADO Basic Auth uses an empty username, so the format is ":PAT"
  const token = Buffer.from(`:${pat}`).toString('base64');
  
  return {
    'Authorization': `Basic ${token}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
}

/**
 * Helper to determine the correct API URL based on server config.
 * Handles both project-scoped and organization-scoped endpoints.
 */
export function getAdoBaseUrl(scopedToProject: boolean = true): string {
  const { orgUrl, project } = getAdoServerConfig();
  
  if (scopedToProject) {
    if (!project) {
      throw { 
        statusCode: 500, 
        code: 'MISSING_SERVER_PROJECT', 
        message: 'A project-scoped request was made but ADO_PROJECT is not configured.' 
      };
    }
    return `${orgUrl}/${encodeURIComponent(project)}`;
  }
  
  return orgUrl;
}

/**
 * Legacy support for auth type checks during transition.
 * Always returns 'pat' now.
 */
export function getAuthType(): 'pat' {
  return 'pat';
}
