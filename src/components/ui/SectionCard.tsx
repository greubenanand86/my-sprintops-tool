import React from 'react';

interface SectionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
}

export function SectionCard({ children, title, className = '', ...props }: SectionCardProps) {
  return (
    <section 
      className={`bg-surface rounded-2xl shadow-soft border border-border p-6 ${className}`}
      {...props}
    >
      {title && <h2 className="text-lg font-semibold mb-4 text-content-primary">{title}</h2>}
      {children}
    </section>
  );
}
