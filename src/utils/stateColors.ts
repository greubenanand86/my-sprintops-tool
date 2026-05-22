export function getStateColorClass(state: string | undefined): string {
  if (!state) return 'bg-background text-content-secondary border-border';
  
  const s = state.toLowerCase().trim();
  
  const blueStates = ['ready for development', 'development in progress', 'active', 'code review', 'resolved'];
  const purpleStates = ['under refinement', 'design in progress'];
  const orangeStates = ['ready for testing', 'ready for uat', 'test in progress', 'uat in progress'];
  const greenStates = ['ready for production', 'production deployed', 'closed'];
  
  if (blueStates.includes(s)) return 'bg-info-bg text-info-fg border-info/20';
  if (purpleStates.includes(s)) return 'bg-secondary text-secondary-fg border-border';
  if (orangeStates.includes(s)) return 'bg-warning-bg text-warning-fg border-warning/20';
  if (greenStates.includes(s)) return 'bg-success-bg text-success-fg border-success/20';
  
  // Default / Neutral (New, Unknown, etc.)
  return 'bg-background text-content-secondary border-border';
}
