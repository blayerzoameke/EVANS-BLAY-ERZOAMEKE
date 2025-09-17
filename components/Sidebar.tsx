import React from 'react';
import type { View } from '../App';
import { LogoIcon } from './icons/LogoIcon';
import { CloseIcon } from './icons/CloseIcon';

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const mainNavItems: { id: View; name: string }[] = [
  { id: 'dashboard', name: 'Dashboard' },
  { id: 'progression', name: 'Progress / Stats' },
  { id: 'examprep', name: 'Exam Prep / Quizzes' },
  { id: 'mytimetables', name: 'My Timetables' },
  { id: 'notes', name: 'My Notes' },
  { id: 'profile', name: 'Profile' },
];

const extraNavItems: { id: View; name: string }[] = [
  { id: 'notification', name: 'Notification'},
  { id: 'report', name: 'Report'},
  { id: 'language', name: 'Language'},
  { id: 'theme', name: 'Theme'},
  { id: 'library', name: 'Library' },
  { id: 'terms', name: 'Terms and Service'},
  { id: 'settings', name: 'Settings' },
  { id: 'feedback', name: 'Feedback' },
  { id: 'help', name: 'Help' },
  { id: 'about', name: 'About' },
];

const NavLink: React.FC<{
  item: { id: View; name: string };
  currentView: View;
  onClick: (view: View) => void;
}> = ({ item, currentView, onClick }) => {
  const isActive = item.id === currentView;
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick(item.id); }}
      className={`flex items-center px-4 py-2.5 text-sm font-medium rounded-md transition-colors duration-200 ${
        isActive
          ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
      }`}
    >
      {item.name}
    </a>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ view, setView, isOpen, setOpen }) => {
  const handleNavClick = (newView: View) => {
    setView(newView);
    if (window.innerWidth < 1024) { // Close sidebar on mobile after navigation
      setOpen(false);
    }
  };
  
  const sidebarContent = (
      <div className="flex flex-col h-full no-print">
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <LogoIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            <span className="ml-3 text-lg font-bold text-gray-800 dark:text-gray-100">SmartPlan</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 -mr-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md">
              <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-4 overflow-y-auto">
          <div>
             <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Main</h3>
             <div className="space-y-1">
                {mainNavItems.map(item => <NavLink key={item.id} item={item} currentView={view} onClick={handleNavClick} />)}
             </div>
          </div>
           <div>
             <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 mt-4">Extra</h3>
             <div className="space-y-1">
                {extraNavItems.map(item => <NavLink key={item.id} item={item} currentView={view} onClick={handleNavClick} />)}
             </div>
          </div>
        </nav>
      </div>
  );

  return (
    <>
        {/* Mobile sidebar overlay */}
        {isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden no-print" onClick={() => setOpen(false)}></div>}
        
        {/* Mobile sidebar */}
        <div className={`fixed inset-y-0 left-0 z-40 flex lg:hidden transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} no-print`}>
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800 shadow-xl">
               {sidebarContent}
            </div>
        </div>
        
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0 no-print">
            <div className="flex flex-col w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                {sidebarContent}
            </div>
        </div>
    </>
  );
};

export default Sidebar;
