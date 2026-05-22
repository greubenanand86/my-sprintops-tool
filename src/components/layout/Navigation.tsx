import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Calculator, Settings, ChevronLeft, ChevronRight, Rocket } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: 'Readiness Tracker', icon: LayoutDashboard },
  { path: '/estimation', label: 'Estimation Planner', icon: Calculator },
  { path: '/release', label: 'Release Readiness', icon: Rocket },
  { path: '/config', label: 'Configuration', icon: Settings },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  return (
    <aside className={`hidden md:flex flex-col fixed left-0 top-16 bottom-0 bg-surface border-r border-border p-4 z-20 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <nav className="space-y-1 flex-1 overflow-hidden">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) => `
              flex items-center gap-3 rounded-xl text-sm font-medium transition-colors
              ${isCollapsed ? 'justify-center p-3' : 'px-3 py-2.5'}
              ${isActive 
                ? 'bg-primary/10 text-primary' 
                : 'text-content-secondary hover:bg-background hover:text-content-primary'}
            `}
          >
            <item.icon size={20} className="shrink-0" />
            {!isCollapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t border-border">
        <button
          onClick={onToggle}
          className={`flex items-center text-content-secondary hover:text-content-primary hover:bg-background rounded-xl transition-colors ${isCollapsed ? 'justify-center p-3 w-full' : 'px-3 py-2.5 w-full gap-3'}`}
          title={isCollapsed ? "Expand Navigation" : "Collapse Navigation"}
          aria-label={isCollapsed ? "Expand Navigation" : "Collapse Navigation"}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} className="shrink-0" />}
          {!isCollapsed && <span className="text-sm font-medium truncate">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t border-border z-30 flex justify-around items-center px-2 pb-safe">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `
            flex flex-col items-center justify-center w-full h-full gap-1 text-xs font-medium transition-colors
            ${isActive ? 'text-primary' : 'text-content-secondary hover:text-content-primary'}
          `}
        >
          <item.icon size={20} />
          <span className="truncate w-full text-center px-1">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
