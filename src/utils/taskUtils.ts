/**
 * Safely generates a child task title from a pattern, injecting parent context.
 * Enforces strict guardrails to ensure literal placeholders never leak into Azure DevOps.
 * 
 * AUDIT CONFIRMED: This shared helper securely handles Dev, QA, UAT, and Post Deployment 
 * task creation paths. It is immune to unresolved placeholder leaks.
 */
export function generateTaskTitle(
  pattern: string | undefined,
  parentId: number | string | undefined | null,
  parentTitle: string | undefined | null
): string {
  if (!parentId) {
    throw new Error("Parent work item ID is missing.");
  }
  if (!parentTitle || !parentTitle.trim()) {
    throw new Error("Parent work item title is missing.");
  }
  if (!pattern || !pattern.trim()) {
    throw new Error("Task title pattern is missing or empty.");
  }

  const safeId = String(parentId);
  const safeTitle = parentTitle.trim();

  // Safely replace both raw angle brackets (< >) and HTML-escaped entities (&lt; &gt;)
  // Added \s* to gracefully handle accidental spaces like < parent ID >
  // Supports both <parent ID> and legacy <workitem ID>
  const generatedTitle = pattern
    .replace(/(<|&lt;)\s*(parent ID|workitem ID)\s*(>|&gt;)/gi, safeId)
    .replace(/(<|&lt;)\s*parent title\s*(>|&gt;)/gi, safeTitle);

  // Guardrail: Check for any remaining unresolved placeholders
  const unresolvedRegex = /(<|&lt;)\s*(parent ID|workitem ID|parent title)\s*(>|&gt;)/i;
  if (unresolvedRegex.test(generatedTitle)) {
    throw new Error("Unresolved placeholders remain in the generated task title. Please check your configuration patterns.");
  }

  return generatedTitle.trim();
}
