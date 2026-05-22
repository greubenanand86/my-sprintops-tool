import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, Check, X, Link as LinkIcon } from 'lucide-react';
import { TaskActionState, WorkItemState } from '../../types/adoModels';

interface TaskCellProps {
  actionState: TaskActionState;
  adoState?: WorkItemState;
  isLink?: boolean;
  onClick?: () => void;
  onLinkExisting?: () => void;
  title?: string;
}

export function TaskCell({ actionState, adoState, isLink, onClick, onLinkExisting, title }: TaskCellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isClosed = adoState === 'Closed';
  const baseClasses = "w-8 h-8 rounded-md flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none";
  
  let stateClasses = "";
  let Icon = Plus;

  switch (actionState) {
    case 'absent':
      stateClasses = "border border-dashed border-border text-content-secondary hover:bg-border/50 hover:text-content-primary cursor-pointer bg-surface";
      Icon = isLink ? LinkIcon : Plus;
      break;
    case 'creating':
      stateClasses = "border border-info/30 bg-info-bg text-info-fg cursor-wait";
      Icon = Loader2;
      break;
    case 'failed':
      stateClasses = "border border-danger bg-danger-bg text-danger-fg hover:bg-danger-bg/80 cursor-pointer";
      Icon = X;
      break;
    case 'created':
      if (isLink) {
        stateClasses = "border border-success/30 bg-success-bg text-success-fg cursor-pointer hover:bg-success/20";
        Icon = LinkIcon;
      } else {
        if (isClosed) {
          stateClasses = "border border-success/30 bg-success-bg text-success-fg cursor-pointer hover:bg-success/20";
          Icon = Check;
        } else {
          stateClasses = "border border-warning/30 bg-warning-bg text-warning-fg cursor-pointer hover:bg-warning-bg/80";
          Icon = Check; // Exists but not closed
        }
      }
      break;
  }

  const isClickable = actionState === 'absent' || actionState === 'failed';

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const menuWidth = 160;
      let left = rect.left + window.scrollX;
      
      // Prevent overflow on the right edge
      if (left + menuWidth > window.innerWidth) {
        left = window.innerWidth - menuWidth - 10;
      }
      
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left
      });
    }
  }, []);

  useEffect(() => {
    if (menuOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        window.removeEventListener('resize', updateCoords);
      };
    }
  }, [menuOpen, updateCoords]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(event.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isClickable) return;

    if (onLinkExisting && (actionState === 'absent' || actionState === 'failed')) {
      updateCoords();
      setMenuOpen(!menuOpen);
    } else if (onClick) {
      onClick();
    }
  };

  const menuPortal = menuOpen ? createPortal(
    <div 
      ref={menuRef}
      style={{ top: coords.top, left: coords.left }}
      className="absolute z-[9999] w-40 bg-surface border border-border rounded-xl shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-200"
    >
      <div className="px-3 py-1.5 border-b border-border mb-1">
        <span className="text-[10px] font-bold text-content-secondary uppercase tracking-wider">Task Action</span>
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClick?.(); }} 
        className="w-full text-left px-3 py-2 text-sm text-content-primary hover:bg-muted/50 flex items-center gap-2.5 transition-colors"
      >
        <Plus size={16} className="text-primary" /> Create New
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onLinkExisting?.(); }} 
        className="w-full text-left px-3 py-2 text-sm text-content-primary hover:bg-muted/50 flex items-center gap-2.5 transition-colors"
      >
        <LinkIcon size={16} className="text-info-fg" /> Link Existing
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button 
        ref={triggerRef}
        className={`${baseClasses} ${stateClasses} ${!isClickable ? 'cursor-default pointer-events-none' : ''}`}
        onClick={handleTriggerClick}
        title={title || actionState}
        aria-label={title || actionState}
        aria-haspopup={onLinkExisting ? "menu" : undefined}
        aria-expanded={menuOpen}
        disabled={actionState === 'creating'}
      >
        <Icon size={16} className={actionState === 'creating' ? 'animate-spin' : ''} />
      </button>
      {menuPortal}
    </>
  );
}
