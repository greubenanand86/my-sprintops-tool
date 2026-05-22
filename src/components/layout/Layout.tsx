import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TopAppBar } from './TopAppBar';
import { Sidebar, BottomNav } from './Navigation';

export function Layout() {
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    const saved = localStorage.getItem('sprintops_nav_collapsed');
    return saved !== null ? JSON.parse(saved) : true; // Default to true (collapsed)
  });

  useEffect(() => {
    localStorage.setItem('sprintops_nav_collapsed', JSON.stringify(isNavCollapsed));
  }, [isNavCollapsed]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopAppBar />
      
      <div className="flex flex-1 pt-16">
        <Sidebar isCollapsed={isNavCollapsed} onToggle={() => setIsNavCollapsed(!isNavCollapsed)} />
        
        {/* Main Content Area */}
        <main className={`flex-1 w-full pb-16 md:pb-0 transition-all duration-300 ${isNavCollapsed ? 'md:pl-20' : 'md:pl-64'}`}>
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 py-8 h-full">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
