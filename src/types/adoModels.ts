import { SessionConfig } from './config';

export type ItemType = 'User Story' | 'Bug' | 'Task';
export type TaskType = 'Dev' | 'QA' | 'UAT' | 'Post';
export type TaskActionState = 'absent' | 'creating' | 'created' | 'failed';
export type WorkItemState = 'New' | 'Active' | 'Resolved' | 'Ready for Production' | 'Closed' | string;

export interface ChildWorkItem {
  id: number;
  title: string;
  type: string;
  state: string;
  assignedTo: string;
  assignedToUniqueName?: string;
  bucket: TaskType | 'other';
  iterationPath?: string;
  isLoadFailed?: boolean;
  isUnavailableRelation?: boolean;
  relationIntegrityStatus?: 'unavailable' | 'loaded';
  loadFailureReason?: string;
  tags?: string[];
}

export interface ChildTask {
  id?: number;
  type: TaskType;
  actionState: TaskActionState;
  adoState?: WorkItemState;
  assignee?: string;
  assigneeUniqueName?: string;
  expectedAssignee?: string;
  original?: number | '';
  remaining?: number | '';
  completed?: number | '';
  isOverridden?: boolean;
  title?: string;
  iterationPath?: string;
}

export interface DeploymentLinkStatus {
  actionState: TaskActionState;
  url?: string;
  title?: string;
  id?: number;
  type?: string;
  state?: string;
  iterationPath?: string;
  isLoadFailed?: boolean;
  isUnavailableRelation?: boolean;
  relationIntegrityStatus?: 'unavailable' | 'loaded';
  loadFailureReason?: string;
}

export interface HierarchyParent {
  id: number;
  title: string;
  type: string;
  state: string;
  iterationPath?: string;
  isLoadFailed?: boolean;
  isUnavailableRelation?: boolean;
  relationIntegrityStatus?: 'unavailable' | 'loaded';
  loadFailureReason?: string;
}

export interface RelatedWorkItem {
  id: number;
  title: string;
  type: string;
  state: string;
  iterationPath?: string;
  isLoadFailed?: boolean;
  isUnavailableRelation?: boolean;
  relationIntegrityStatus?: 'unavailable' | 'loaded';
  loadFailureReason?: string;
}

export interface ParentWorkItem {
  id: number;
  title: string;
  type: ItemType;
  state: WorkItemState;
  tags: string[];
  assignedTo?: string;
  assignedToUniqueName?: string;
  iterationPath: string;
  areaPath: string;
  tasks: Record<TaskType, ChildTask>;
  link: DeploymentLinkStatus;
  visibleTabs: string[];
  allChildren: ChildWorkItem[];
  parent?: HierarchyParent;
  relatedItems: RelatedWorkItem[];
  isApproved?: boolean;
  approvalStatus?: 'approved' | 'not_approved' | 'unknown';
  readyForProdTransition?: 'passed_ready_for_production' | 'not_found' | 'unknown';
}

export interface ReadinessSummary {
  isReady: boolean;
  metCriteria: number;
  totalCriteria: number;
  details: {
    parentReady: boolean;
    uatClosed: boolean;
    linkExists: boolean;
    isApproved: boolean;
  };
}

export interface FieldOption {
  name: string;
  referenceName: string;
  type: string;
}

export interface UserOption {
  id: string;
  displayName: string;
  uniqueName: string;
  imageUrl?: string;
}

export interface IterationOption {
  id: string;
  name: string;
  path: string;
  startDate?: string;
  finishDate?: string;
  timeFrame?: 'past' | 'current' | 'future';
}

export type { SessionConfig };
