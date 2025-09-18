import React from 'react';
import type { View } from '../App.tsx';
import { LogoIcon } from './icons/LogoIcon';
import { CloseIcon } from './icons/CloseIcon';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ view, setView, isOpen, setOpen }) => {
  const { t } = useLanguage();
  
  type NavItem = { id: View; nameKey: keyof typeof import('../lib/i18n.ts').translations['en'] };

  const manageNavItems: NavItem[] = [
    { id: 'dashboard', nameKey: 'sidebar.dashboard' },
    { id: 'progression', nameKey: 'sidebar.progression' },
    { id: 'uploadslides', nameKey: 'sidebar.uploadslides' },
    { id: 'examprep', nameKey: 'sidebar.examprep' },
    { id: 'mytimetables', nameKey: 'sidebar.mytimetables' },
    { id: 'notes', nameKey: 'sidebar.notes' },
    { id: 'profile', nameKey: 'sidebar.profile' },
  ];

  const preferencesNavItems: NavItem[] = [
    { id: 'notification', nameKey: 'sidebar.notification'},
    { id: 'language', nameKey: 'sidebar.language'},
    { id: 'theme', nameKey: 'sidebar.theme'},
    { id: 'settings', nameKey: 'sidebar.settings' },
  ];
  
  const supportNavItems: NavItem[] = [
    { id: 'report', nameKey: 'sidebar.report'},
    { id: 'feedback', nameKey: 'sidebar.feedback' },
    { id: 'help', nameKey: 'sidebar.help' },
    { id: 'about', nameKey: 'sidebar.about' },
  ];

  const handleNavClick = (newView: View) => {
    setView(newView);
    if (window.innerWidth < 1024) { // Close sidebar on mobile after navigation
      setOpen(false);
    }
  };
  
  const NavLink: React.FC<{
    item: NavItem;
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
            ? "bg-blue-100 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        {t(item.nameKey)}
      </a>
    );
  };
  
  const NavGroup: React.FC<{titleKey: keyof typeof import('../lib/i18n.ts').translations['en'], items: NavItem[]}> = ({ titleKey, items }) => (
    <div>
        <h3 className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t(titleKey)}</h3>
        <div className="space-y-1">
            {items.map(item => <NavLink key={item.id} item={item} currentView={view} onClick={handleNavClick} />)}
        </div>
    </div>
  );
  
  const sidebarContent = (
      <div className="flex flex-col h-full no-print">
        <div className="flex items-center justify-between px-4 py-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center">
            <LogoIcon className="w-8 h-8 text-blue-700 dark:text-blue-500" />
            <span className="ml-3 text-lg font-bold text-slate-800 dark:text-slate-100">EduBlay</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 -mr-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md">
              <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
            <NavGroup titleKey="sidebar.manage" items={manageNavItems} />
            <NavGroup titleKey="sidebar.preferences" items={preferencesNavItems} />
            <NavGroup titleKey="sidebar.support" items={supportNavItems} />
        </nav>
      </div>
  );

  return (
    <>
        {/* Mobile sidebar overlay */}
        {isOpen && <div className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden no-print" onClick={() => setOpen(false)}></div>}
        
        {/* Mobile sidebar */}
        <div className={`fixed inset-y-0 left-0 z-40 flex lg:hidden transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} no-print`}>
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-800 shadow-xl">
               {sidebarContent}
            </div>
        </div>
        
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0 no-print">
            <div className="flex flex-col w-64 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                {sidebarContent}
            </div>
        </div>
    </>
  );
};

export default Sidebar;