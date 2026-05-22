import { 
  ParentWorkItem, 
  ChildTask, 
  DeploymentLinkStatus, 
  TaskType, 
  ReadinessSummary,
  SessionConfig,
  ChildWorkItem,
  HierarchyParent,
  RelatedWorkItem
} from '../types/adoModels';
import { toArray } from '../utils/arrayUtils';

export class AdoNormalizationService {
  
  static classifyChildTask(title: string, workItemType: string, tags: string[] = []): TaskType | 'other' {
    if (workItemType !== 'Task') return 'other';
    const lowerTags = tags.map(t => t.toLowerCase());
    if (lowerTags.includes('sprintops:dev')) return 'Dev';
    if (lowerTags.includes('sprintops:qa')) return 'QA';
    if (lowerTags.includes('sprintops:uat')) return 'UAT';
    if (lowerTags.includes('sprintops:post_deployment')) return 'Post';

    const t = title.trim().toLowerCase();
    if (/\bpost[- ]deployment\b/i.test(t) || /\bpost[- ]prod\b/i.test(t)) return 'Post';
    if (/\buat\b/i.test(t) || t.includes('user acceptance')) return 'UAT';
    if (/\bqa\b/i.test(t) || t.includes('quality assurance') || t.includes('testing')) return 'QA';
    if (/\bdev\b/i.test(t) || t.includes('development')) return 'Dev';
    return 'other';
  }

  static isDeploymentRelatedWorkItem(item: any, rel?: any): boolean {
    if (rel?.attributes?.comment === 'Linked via SprintOps Console') return true;
    if (!item) return false;
    const t = (item.fields?.['System.Title'] || '').toLowerCase();
    const type = (item.fields?.['System.WorkItemType'] || '').toLowerCase();
    return t.includes('deployment') || type.includes('deployment') || t.includes('release');
  }

  static determineTabs(tags: string[]): string[] {
    const safeTags = toArray(tags);
    const tabs = new Set<string>(['All']);
    const hasProdIssue = safeTags.includes('Production Issue');
    const productTags = safeTags.filter(t => ['Learner Wallet', 'Edlusion', 'NCSI'].includes(t));
    if (hasProdIssue) tabs.add('Production Issue');
    if (productTags.length > 0) productTags.forEach(t => tabs.add(t));
    else tabs.add('General');
    return Array.from(tabs);
  }

  static normalizeWorkItems(rawItems: any[], config: SessionConfig, diagnostics?: any): { parents: ParentWorkItem[], unparentedTasks: ChildWorkItem[] } {
    const { mapping } = config;
    const safeRawItems = toArray(rawItems);
    
    // 1. Build Canonical Item Map (Source of Truth)
    // This ensures that if #52508 is hydrated once, it's used everywhere.
    const itemMap = new Map<number, any>();
    safeRawItems.forEach(item => {
      if (item && item.id) {
        // If we already have this item and the new one has no fields, don't overwrite
        const existing = itemMap.get(item.id);
        if (existing && (!item.fields || Object.keys(item.fields).length === 0)) return;
        itemMap.set(item.id, item);
      }
    });

    const getFailureReason = (id: number) => {
      return diagnostics?.relation_hydration?.[`failure_${id}`] || 'omitted_by_ado';
    };

    const parentsRaw = safeRawItems.filter(item => {
      const type = item.fields?.['System.WorkItemType'];
      if (type === 'User Story') return true;
      if (type === 'Bug') {
        const hasParent = toArray(item.relations).some((rel: any) => rel.rel === 'System.LinkTypes.Hierarchy-Reverse');
        return !hasParent;
      }
      return false;
    });

    const parents = parentsRaw.map(parent => {
      const id = parent.id;
      const title = parent.fields?.['System.Title'] || '';
      const type = parent.fields?.['System.WorkItemType'] || 'Unknown';
      const state = parent.fields?.[mapping.state] || 'New';
      const tags = (parent.fields?.[mapping.tags] || '').split(';').map((t: string) => t.trim()).filter(Boolean);
      const assignedToObj = parent.fields?.['System.AssignedTo'];
      const assignedTo = assignedToObj?.displayName || '';
      const assignedToUniqueName = assignedToObj?.uniqueName || '';
      const iterationPath = parent.fields?.[mapping.iterationPath] || '';
      const areaPath = parent.fields?.[mapping.areaPath] || '';

      const relations = toArray(parent.relations);
      const allChildren: ChildWorkItem[] = [];
      const relatedItems: RelatedWorkItem[] = [];
      let linkStatus: DeploymentLinkStatus = { actionState: 'absent' };
      let hierarchyParent: HierarchyParent | undefined = undefined;

      const seenIds = new Set<number>();

      relations.forEach((rel: any) => {
        const targetId = parseInt(rel.url.split('/').pop() || '0', 10);
        if (!targetId || targetId === 0 || seenIds.has(targetId)) return;
        
        const hydratedItem = itemMap.get(targetId);
        const isHydrated = hydratedItem && hydratedItem.fields && Object.keys(hydratedItem.fields).length > 0;

        // A. Handle Hierarchy (Parent)
        if (rel.rel === 'System.LinkTypes.Hierarchy-Reverse') {
          if (isHydrated) {
            hierarchyParent = {
              id: targetId,
              title: hydratedItem.fields['System.Title'],
              type: hydratedItem.fields['System.WorkItemType'],
              state: hydratedItem.fields[mapping.state],
              iterationPath: hydratedItem.fields[mapping.iterationPath],
              isLoadFailed: false,
              isUnavailableRelation: false,
              relationIntegrityStatus: 'loaded'
            };
          } else {
            hierarchyParent = {
              id: targetId,
              title: `Work Item #${targetId} unavailable`,
              type: 'Unknown',
              state: 'Unknown',
              isLoadFailed: true,
              isUnavailableRelation: true,
              relationIntegrityStatus: 'unavailable',
              loadFailureReason: getFailureReason(targetId)
            };
          }
          return;
        }

        // B. Handle Hierarchy (Children)
        if (rel.rel === 'System.LinkTypes.Hierarchy-Forward') {
          seenIds.add(targetId);
          if (isHydrated) {
            const childTags = (hydratedItem.fields[mapping.tags] || '').split(';').map((t: string) => t.trim()).filter(Boolean);
            allChildren.push({
              id: targetId,
              title: hydratedItem.fields['System.Title'],
              type: hydratedItem.fields['System.WorkItemType'],
              state: hydratedItem.fields[mapping.state],
              assignedTo: hydratedItem.fields['System.AssignedTo']?.displayName || '',
              assignedToUniqueName: hydratedItem.fields['System.AssignedTo']?.uniqueName || '',
              bucket: this.classifyChildTask(hydratedItem.fields['System.Title'], hydratedItem.fields['System.WorkItemType'], childTags),
              iterationPath: hydratedItem.fields[mapping.iterationPath],
              isLoadFailed: false,
              isUnavailableRelation: false,
              relationIntegrityStatus: 'loaded',
              tags: childTags
            });
          } else {
            allChildren.push({
              id: targetId,
              title: `Work Item #${targetId} unavailable`,
              type: 'Unknown',
              state: 'Unknown',
              assignedTo: '',
              bucket: 'other',
              isLoadFailed: true,
              isUnavailableRelation: true,
              relationIntegrityStatus: 'unavailable',
              loadFailureReason: getFailureReason(targetId)
            });
          }
          return;
        }

        // C. Handle Related & Deployment Links
        if (rel.rel === 'System.LinkTypes.Related' || rel.rel === 'Related' || rel.rel === 'ArtifactLink') {
          seenIds.add(targetId);
          
          // Check if this is a deployment link
          if (this.isDeploymentRelatedWorkItem(hydratedItem, rel)) {
            const baseUrl = config.ado.orgUrl.replace(/\/$/, '');
            const webUrl = `${baseUrl}/${encodeURIComponent(config.ado.project)}/_workitems/edit/${targetId}`;
            
            if (isHydrated) {
              linkStatus = {
                actionState: 'created',
                url: webUrl,
                id: targetId,
                title: hydratedItem.fields['System.Title'],
                type: hydratedItem.fields['System.WorkItemType'],
                state: hydratedItem.fields[mapping.state],
                iterationPath: hydratedItem.fields[mapping.iterationPath],
                isLoadFailed: false,
                isUnavailableRelation: false,
                relationIntegrityStatus: 'loaded'
              };
            } else {
              linkStatus = {
                actionState: 'created',
                url: webUrl,
                id: targetId,
                title: `Deployment Task #${targetId} unavailable`,
                isLoadFailed: true,
                isUnavailableRelation: true,
                relationIntegrityStatus: 'unavailable',
                loadFailureReason: getFailureReason(targetId)
              };
            }
          }

          // Also add to related items list
          if (isHydrated) {
            relatedItems.push({
              id: targetId,
              title: hydratedItem.fields['System.Title'],
              type: hydratedItem.fields['System.WorkItemType'],
              state: hydratedItem.fields[mapping.state],
              iterationPath: hydratedItem.fields[mapping.iterationPath],
              isLoadFailed: false,
              isUnavailableRelation: false,
              relationIntegrityStatus: 'loaded'
            });
          } else {
            relatedItems.push({
              id: targetId,
              title: `Work Item #${targetId} unavailable`,
              type: 'Unknown',
              state: 'Unknown',
              isLoadFailed: true,
              isUnavailableRelation: true,
              relationIntegrityStatus: 'unavailable',
              loadFailureReason: getFailureReason(targetId)
            });
          }
        }
      });

      // Build ChildTask slots for the UI grid
      const buildChildTask = (taskType: TaskType): ChildTask => {
        const found = allChildren.find(c => c.bucket === taskType && !c.isUnavailableRelation);
        if (found) {
          const raw = itemMap.get(found.id);
          return {
            id: found.id,
            type: taskType,
            actionState: 'created',
            adoState: found.state,
            assignee: found.assignedTo,
            assigneeUniqueName: found.assignedToUniqueName,
            original: raw?.fields?.[mapping.originalEstimate] ?? '',
            remaining: raw?.fields?.[mapping.remaining] ?? '',
            completed: raw?.fields?.[mapping.completed] ?? '',
            title: found.title,
            iterationPath: found.iterationPath
          };
        }
        return { type: taskType, actionState: 'absent' };
      };

      return { 
        id, title, type, state, tags, assignedTo, assignedToUniqueName, iterationPath, areaPath, 
        visibleTabs: this.determineTabs(tags), 
        tasks: { Dev: buildChildTask('Dev'), QA: buildChildTask('QA'), UAT: buildChildTask('UAT'), Post: buildChildTask('Post') }, 
        link: linkStatus,
        allChildren,
        parent: hierarchyParent,
        relatedItems,
        isApproved: false
      };
    });

    return { parents, unparentedTasks: [] };
  }
}
