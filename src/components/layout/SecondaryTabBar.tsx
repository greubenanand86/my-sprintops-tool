import React, { useState } from 'react';

export const TABS = ['All', 'Learner Wallet', 'Edlusion', 'NCSI', 'Production Issue', 'General', 'Approval Pending', 'Iteration Mismatch'];

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface SecondaryTabBarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  tabs?: TabItem[];
}

export function SecondaryTabBar({ activeTab: externalTab, onTabChange, tabs }: SecondaryTabBarProps) {
  const displayTabs = tabs || TABS.map(t => ({ id: t, label: t }));
  const [internalTab, setInternalTab] = useState(displayTabs[0].id);
  
  const activeTab = externalTab !== undefined ? externalTab : internalTab;
  
  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalTab(tabId);
    }
  };

  return (
    <div className="sticky top-16 z-20 bg-background/80 backdrop-blur-md border-b border-border -mx-4 px-4 md:-mx-8 md:px-8 mb-8">
      <nav className="flex space-x-1 overflow-x-auto scrollbar-hide py-2" aria-label="Work Item Tabs">
        {displayTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={`
              flex items-center whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeTab === tab.id 
                ? 'bg-surface text-primary shadow-sm border border-border' 
                : 'text-content-secondary hover:text-content-primary hover:bg-surface/50 border border-transparent'}
            `}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-background text-content-secondary border border-border'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
