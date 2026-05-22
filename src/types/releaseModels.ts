import { ReadinessDisplayStatus } from '../utils/readinessUtils';
import { ParentWorkItem } from './adoModels';

export type Product = 'Learner Wallet' | 'Edlusion' | 'NCSI' | 'Unknown/Unmapped';
export type ReleaseType = 'Sprint Release' | 'Hotfix';
export type ReadinessStatus = 'Ready' | 'Not Ready' | 'Deployed' | 'Deployed and Verified' | 'Unknown';

export interface LinkedWorkItem {
  id: number;
  title: string;
  type: string;
  state: string;
  iterationPath: string;
  areaPath: string;
  assignedTo: string;
  tags: string[];
  isLoadFailed: boolean;
  displayStatus: ReadinessDisplayStatus;
  parentItem?: ParentWorkItem;
}

export interface ReleaseTask {
  id: number;
  title: string;
  product: Product;
  type: ReleaseType;
  version: string | null;
  state: string;
  readiness: ReadinessStatus;
  tags: string[];
  iterationPath: string;
  areaPath: string;
  assignedTo: string;
  createdDate: string;
  changedDate: string;
  linkedItems: {
    ready: number;
    notReady: number;
    deployed: number;
    verified: number;
    closedWithoutEvidence: number;
    withWarnings: number;
    total: number;
    readinessPercentage: number;
  };
  linkedWorkItems: LinkedWorkItem[];
  rawRelations: any[];
}
