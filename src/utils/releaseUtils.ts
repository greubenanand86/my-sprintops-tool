import { Product, ReleaseType, ReleaseTask, LinkedWorkItem } from '../types/releaseModels';

/**
 * Centralized helper to extract product, release type, and version 
 * from a release task's title, tags, and area path.
 */
export function parseReleaseMetadata(title: string, tags: string[], areaPath: string) {
  const lowerTitle = title.toLowerCase();
  const lowerTags = tags.map(t => t.toLowerCase());
  const lowerArea = areaPath.toLowerCase();

  // 1. Version Detection
  // Matches standard semver-like patterns: 1.0, 1.0.0, 1.0.0.1, etc.
  const versionMatch = title.match(/\b(\d+\.\d+(?:\.\d+)*)\b/);
  const version = versionMatch ? versionMatch[1] : null;

  // 2. Product Detection
  let product: Product = 'Unknown/Unmapped';
  if (lowerTags.includes('learner wallet') || lowerArea.includes('learner wallet') || /^\bLW\b/i.test(title)) {
    product = 'Learner Wallet';
  } else if (lowerTags.includes('edlusion') || lowerArea.includes('edlusion') || /^\bED\b/i.test(title)) {
    product = 'Edlusion';
  } else if (lowerTags.includes('ncsi') || lowerArea.includes('ncsi') || /^\bNCSI\b/i.test(title)) {
    product = 'NCSI';
  }

  // 3. Release Type Detection
  let type: ReleaseType = 'Sprint Release';
  if (lowerTitle.includes('hotfix') || lowerTags.includes('hotfix')) {
    type = 'Hotfix';
  }

  return { product, type, version };
}

/**
 * Compares two semantic version strings.
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = v2.split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(p1.length, p2.length);
  
  for (let i = 0; i < len; i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

/**
 * Increments a version string based on the release type.
 * Sprint Release increments the patch (3rd segment).
 * Hotfix increments or appends the hotfix suffix (4th segment).
 */
export function incrementVersion(version: string | null | undefined, type: ReleaseType): string {
  if (!version || version === 'None') return type === 'Sprint Release' ? '1.0.0' : '1.0.0.1';
  
  const parts = version.split('.').map(n => parseInt(n, 10) || 0);
  
  if (type === 'Sprint Release') {
    // Ensure at least 3 parts (major.minor.patch)
    while (parts.length < 3) parts.push(0);
    parts[2] += 1;
    return parts.slice(0, 3).join('.');
  } else {
    // Ensure at least 3 parts before adding hotfix suffix
    while (parts.length < 3) parts.push(0);
    if (parts.length === 3) {
      parts.push(1); // Append .1
    } else {
      parts[3] += 1; // Increment existing 4th part
    }
    return parts.join('.');
  }
}

/**
 * Generates the managed HTML section for the release scope.
 */
export function generateReleaseScopeHtml(releaseTask: ReleaseTask, orgUrl: string, project: string): string {
  const baseUrl = orgUrl.replace(/\/$/, '');
  const getUrl = (id: number) => `${baseUrl}/${encodeURIComponent(project)}/_workitems/edit/${id}`;

  const { linkedItems, linkedWorkItems } = releaseTask;

  const isReadyLike = (item: LinkedWorkItem) => {
    if (item.displayStatus.displayMode === 'readiness') return item.displayStatus.percentage === 100;
    return item.displayStatus.statusLabel === 'Deployed and Verified' || item.displayStatus.statusLabel === 'Deployed';
  };

  const notReadyItems = linkedWorkItems.filter(i => !isReadyLike(i));
  const readyItems = linkedWorkItems.filter(i => isReadyLike(i));

  const bugs = readyItems.filter(i => i.type === 'Bug');
  const stories = readyItems.filter(i => i.type === 'User Story');
  const others = readyItems.filter(i => i.type !== 'Bug' && i.type !== 'User Story');

  const formatItem = (item: LinkedWorkItem, includeStatus = false) => {
    let str = `<li><a href="${getUrl(item.id)}">#${item.id}</a> ${item.title}`;
    if (includeStatus) {
      const statusText = item.displayStatus.displayMode === 'readiness' && item.displayStatus.percentage === 100 
        ? 'Ready' 
        : item.displayStatus.displayMode === 'readiness' 
          ? 'Not Ready' 
          : item.displayStatus.statusLabel;
      str += ` - <strong>${statusText}</strong>`;
    }
    str += `</li>`;
    return str;
  };

  const formatList = (items: LinkedWorkItem[], includeStatus = false) => {
    if (items.length === 0) return '<p><em>None</em></p>';
    return `<ul>${items.map(i => formatItem(i, includeStatus)).join('')}</ul>`;
  };

  return `
<div>
  <h3>Release Scope Summary</h3>
  <ul>
    <li><strong>Total Linked:</strong> ${linkedItems.total}</li>
    <li><strong>Ready:</strong> ${linkedItems.ready}</li>
    <li><strong>Not Ready:</strong> ${linkedItems.notReady + linkedItems.closedWithoutEvidence}</li>
    <li><strong>Deployed:</strong> ${linkedItems.deployed}</li>
    <li><strong>Deployed & Verified:</strong> ${linkedItems.verified}</li>
  </ul>
  <hr>
  <h4>User Stories (${stories.length})</h4>
  ${formatList(stories)}
  <h4>Bugs (${bugs.length})</h4>
  ${formatList(bugs)}
  <h4>Other (${others.length})</h4>
  ${formatList(others)}
  <h4>Not Ready (${notReadyItems.length})</h4>
  ${formatList(notReadyItems, true)}
</div>`.trim();
}
