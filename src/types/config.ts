export interface ConnectionConfig {
  orgUrl: string;
  project: string;
  team: string;
}

export interface IterationConfig {
  defaultCurrent: boolean;
  allowManual: boolean;
  selectedPath: string;
}

export interface FieldMappingConfig {
  tags: string;
  originalEstimate: string;
  remaining: string;
  completed: string;
  state: string;
  iterationPath: string;
  areaPath: string;
}

export interface AdoUser {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
}

export interface AssigneeConfig {
  devBehavior: 'parent'; 
  qaAssignee: AdoUser | null;
}

export interface TaskRulesConfig {
  childWorkItemType: 'Task'; 
  devPattern: string;
  qaPattern: string;
  uatPattern: string;
  postPattern: string;
  inheritIteration: boolean;
  inheritArea: boolean;
  defaultState: string;
  emptyDescription: boolean;
  inheritTags: boolean;
  preventDuplicates: boolean;
}

export interface ReadinessRulesConfig {
  parentState: string;
  requiredClosedTasks: string[];
  deploymentLinkRequired: boolean;
  ignorePostDeployment: boolean;
}

export interface EstimationRulesConfig {
  estimateTaskTypes: string[];
  excludeTaskTypes: string[];
  qaPercentOfDev: number;
  uatPercentOfDev: number;
  roundToNearest: number;
  stopAutoUpdateOnOverride: boolean;
}

export interface GroupingRulesConfig {
  productTabs: string[];
  fallbackTab: string;
  productionIssueMultiTab: boolean;
}

export interface AiFieldMapping {
  displayName: string;
  referenceName: string;
}

export interface AiRecommendationConfig {
  provider: 'openai' | 'gemini';
  fieldMappings: {
    title?: AiFieldMapping;
    description?: AiFieldMapping;
    acceptanceCriteria?: AiFieldMapping;
    reproSteps?: AiFieldMapping;
    additionalContext: AiFieldMapping[];
  };
  includeAttachments: boolean;
}

export interface SessionConfig {
  ado: ConnectionConfig;
  iteration: IterationConfig;
  mapping: FieldMappingConfig;
  assignee: AssigneeConfig;
  tasks: TaskRulesConfig;
  readiness: ReadinessRulesConfig;
  estimation: EstimationRulesConfig;
  grouping: GroupingRulesConfig;
  aiRecommendation: AiRecommendationConfig;
}

export type ValidationErrors = Record<string, Record<string, string>>;

export interface AdoIteration {
  id: string;
  name: string;
  path: string;
  attributes: {
    startDate: string;
    finishDate: string;
    timeFrame: 'past' | 'current' | 'future';
  };
}

export interface AdoField {
  name: string;
  referenceName: string;
  type: string;
}
