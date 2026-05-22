import { ChildWorkItem } from '../types/adoModels';

export const TERMINAL_STATES = [
  'Closed', 
  'Production Deployed', 
  'Removed', 
  'Done', 
  'Resolved', 
  'Cut'
];

/**
 * Checks if a work item state is considered terminal/inactive.
 */
export function isTerminalState(state: string | undefined): boolean {
  if (!state) return false;
  return TERMINAL_STATES.includes(state);
}

/**
 * Checks if a child work item failed to load its details from Azure DevOps
 * or if it is an unavailable/broken relation.
 */
export function isLoadFailedChild(child: ChildWorkItem): boolean {
  if (child.isLoadFailed || child.isUnavailableRelation) return true;
  if (child.state === 'Unknown' || child.state === 'Load Failed') return true;
  return false;
}

/**
 * Determines if a child work item is a valid, actionable iteration mismatch.
 * It must have successfully loaded, have a different sprint, and not be in a terminal state.
 */
export function isActionableMismatch(child: ChildWorkItem, parentIterationPath: string): boolean {
  if (isLoadFailedChild(child)) return false;
  if (child.iterationPath === parentIterationPath) return false;
  if (isTerminalState(child.state)) return false;
  return true;
}
