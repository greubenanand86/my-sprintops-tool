import React, { useState } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface AccordionCardProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  errorCount?: number;
  disabled?: boolean;
}

export function AccordionCard({ title, children, defaultOpen = true, errorCount = 0, disabled = false }: AccordionCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`bg-surface rounded-2xl shadow-soft border overflow-hidden mb-6 transition-all ${errorCount > 0 ? 'border-danger/30' : 'border-border'} ${disabled ? 'opacity-60 pointer-events-none grayscale-[0.2]' : ''}`}>
      <button
        type="button"
        className="w-full px-6 py-4 flex items-center justify-between md:cursor-default md:pointer-events-none"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-content-primary">{title}</h2>
          {errorCount > 0 && !disabled && (
            <span className="flex items-center gap-1 text-xs font-medium text-danger-fg bg-danger-bg px-2 py-1 rounded-full">
              <AlertCircle size={14} />
              {errorCount} error{errorCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <ChevronDown
          className={`md:hidden text-content-secondary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          size={20}
        />
      </button>
      <div className={`${isOpen ? 'block' : 'hidden'} md:block px-6 pb-6 pt-0`}>
        {children}
      </div>
    </div>
  );
}
