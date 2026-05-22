import { ItemType, TaskType, WorkItemState } from './adoModels';

export type EstimationTaskType = 'Dev' | 'QA' | 'UAT';

export interface TaskEstimate {
  id?: number;
  type: TaskType;
  original: number | '';
  remaining: number | '';
  completed: number | '';
  isOverridden: boolean;
}

export interface EstimationItem {
  id: number;
  title: string;
  type: ItemType;
  state: WorkItemState;
  tags: string[];
  visibleTabs: string[];
  tasks: Record<EstimationTaskType, TaskEstimate>;
}

export type EstimationFilter = 
  | 'None' 
  | 'Missing Original' 
  | 'Missing Remaining' 
  | 'Missing Completed' 
  | 'Missing Any' 
  | 'Overridden Only';

export interface SourceFieldCoverage {
  used: boolean;
  sourceField: string | null;
  length: number;
}

export interface AiRecommendation {
  provider?: 'openai' | 'gemini';
  recommendedDevHours: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  reasoningSummary: string;
  assumptions: string[];
  riskFactors: string[];
  notEnoughInfo: boolean;
  missingInputs?: string[];
  reasonCode?: string;
  sourceCoverage: {
    title: boolean;
    description: SourceFieldCoverage | boolean;
    acceptanceCriteria: SourceFieldCoverage | boolean;
    reproSteps: SourceFieldCoverage | boolean;
    additionalContext: string[];
    attachmentsIncluded: { name: string; type: string; excerptLength: number }[];
    attachmentsSkipped: { name: string; reason: string }[];
    extractedLengths?: Record<string, number>;
    extractionStrength?: 'strong' | 'partial' | 'weak';
  };
}
