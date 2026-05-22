import { SessionConfig, ValidationErrors, AdoField } from '../types/config';

export function validateConfig(config: SessionConfig, adoFields: AdoField[] = []): ValidationErrors {
  const errors: ValidationErrors = {
    ado: {},
    mapping: {},
    assignee: {},
    tasks: {}
  };

  // ADO Connection Validation
  if (!config.ado.orgUrl) {
    errors.ado.orgUrl = 'Organization URL is required';
  } else if (!/^https:\/\/(dev\.azure\.com|.*\.visualstudio\.com)/i.test(config.ado.orgUrl)) {
    errors.ado.orgUrl = 'Must be a valid Azure DevOps URL (dev.azure.com or visualstudio.com)';
  }

  if (!config.ado.project) errors.ado.project = 'Project is required';
  if (!config.ado.team) errors.ado.team = 'Team is required';

  // Field Mapping Validation
  const validateMapping = (val: string, label: string, key: string) => {
    if (!val) {
      errors.mapping[key] = `${label} mapping is required`;
    } else if (adoFields.length === 0) {
      errors.mapping[key] = `Connect to ADO to verify field`;
    } else if (!adoFields.some(f => f.referenceName === val)) {
      errors.mapping[key] = `Field '${val}' not found in ADO`;
    }
  };

  validateMapping(config.mapping.tags, 'Tags', 'tags');
  validateMapping(config.mapping.originalEstimate, 'Original Estimate', 'originalEstimate');
  validateMapping(config.mapping.remaining, 'Remaining Work', 'remaining');
  validateMapping(config.mapping.completed, 'Completed Work', 'completed');
  validateMapping(config.mapping.state, 'State', 'state');
  validateMapping(config.mapping.iterationPath, 'Iteration Path', 'iterationPath');
  validateMapping(config.mapping.areaPath, 'Area Path', 'areaPath');

  // Assignee Validation
  if (!config.assignee.qaAssignee) errors.assignee.qaAssignee = 'QA/UAT/Post default assignee is required';

  // Task Rules Validation
  if (!config.tasks.devPattern) errors.tasks.devPattern = 'Dev task pattern is required';
  if (!config.tasks.qaPattern) errors.tasks.qaPattern = 'QA task pattern is required';
  if (!config.tasks.uatPattern) errors.tasks.uatPattern = 'UAT task pattern is required';
  if (!config.tasks.postPattern) errors.tasks.postPattern = 'Post-Deployment task pattern is required';

  return errors;
}

export function calculateCompleteness(errors: ValidationErrors): number {
  const totalRequiredFields = 14; // 3 ado + 7 mapping + 1 assignee + 3 tasks (removed PAT requirement)
  let errorCount = 0;

  Object.values(errors).forEach(sectionErrors => {
    errorCount += Object.keys(sectionErrors).length;
  });

  const validFields = Math.max(0, totalRequiredFields - errorCount);
  return Math.round((validFields / totalRequiredFields) * 100);
}
