import React from 'react';
import { ExternalLink } from 'lucide-react';

interface WorkItemLinkProps {
  id: number | string;
  orgUrl: string;
  project: string;
  className?: string;
  children?: React.ReactNode;
  showIcon?: boolean;
}

export function WorkItemLink({ id, orgUrl, project, className = '', children, showIcon = false }: WorkItemLinkProps) {
  const baseUrl = orgUrl.replace(/\/$/, '');
  const url = `${baseUrl}/${encodeURIComponent(project)}/_workitems/edit/${id}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 hover:underline hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded ${className}`}
      aria-label={`Open work item ${id} in a new tab`}
      onClick={(e) => e.stopPropagation()}
    >
      {children || `#${id}`}
      {showIcon && <ExternalLink size={12} className="opacity-70 shrink-0" />}
    </a>
  );
}
