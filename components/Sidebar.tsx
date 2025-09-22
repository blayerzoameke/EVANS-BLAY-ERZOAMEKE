import React from 'react';
import type { View } from '../App.tsx';
import { LogoIcon } from './icons/LogoIcon.tsx';
import { CloseIcon } from './icons/CloseIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ view, setView, isOpen, setOpen }) => {
  const { t } = useLanguage();
  
  // @ts-ignore
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
    { id: 'library', nameKey: 'sidebar.library' },
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
        className={`flex items-center px-4 py-2.5 text-sm rounded-md transition-colors duration-200 ${
          isActive
            ? "bg-primary/10 dark:bg-primary/20 text-primary-dark dark:text-primary-light font-semibold"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
        }`}
      >
        {t(item.nameKey as any)}
      </a>
    );
  };
  
  // @ts-ignore
  const NavGroup: React.FC<{titleKey: keyof typeof import('../lib/i18n.ts').translations['en'], items: NavItem[]}> = ({ titleKey, items }) => (
    <div>
        <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t(titleKey as any)}</h3>
        <div className="space-y-1">
            {items.map(item => <NavLink key={item.id} item={item} currentView={view} onClick={handleNavClick} />)}
        </div>
    </div>
  );
  
  const sidebarContent = (
      <div className="flex flex-col h-full no-print">
        <div className="flex items-center justify-between px-4 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <LogoIcon className="w-8 h-8 text-primary dark:text-primary-light" />
            <span className="ml-3 text-2xl font-bold text-gray-800 dark:text-gray-100">EduBlay</span>
          </div>
          <button onClick={() => setOpen(false)} className="lg:hidden p-1 -mr-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md">
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