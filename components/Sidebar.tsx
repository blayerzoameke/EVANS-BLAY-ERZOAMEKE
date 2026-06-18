import React, { useState } from 'react';
import type { View, UserDetails } from '../types';
import { LogoIcon } from './icons/LogoIcon';
import { CloseIcon } from './icons/CloseIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import type { TranslationKey } from '../lib/i18n';

interface SidebarProps {
  view: View;
  setView: (view: View) => void;
  isOpen: boolean;
  setOpen: (isOpen: boolean) => void;
  userDetails: UserDetails | null;
  unreadFeedbackCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ view, setView, isOpen, setOpen, userDetails, unreadFeedbackCount = 0 }) => {
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggleSection = (sectionId: string) => {
    setOpenSection(prev => (prev === sectionId ? null : sectionId));
  };
  
  type NavItem = { id: View; nameKey: TranslationKey };

  const manageNavItems: NavItem[] = [
    { id: 'dashboard', nameKey: 'sidebar.dashboard' },
    { id: 'history', nameKey: 'sidebar.history' },
    { id: 'progression', nameKey: 'sidebar.progression' },
    { id: 'uploadslides', nameKey: 'sidebar.uploadslides' },
    { id: 'examprep', nameKey: 'sidebar.examprep' },
    { id: 'collaborative', nameKey: 'sidebar.collaborativeSession' },
    { id: 'mytimetables', nameKey: 'sidebar.mytimetables' },
    { id: 'notes', nameKey: 'sidebar.notes' },
    { id: 'profile', nameKey: 'sidebar.profile' },
  ];

  const preferencesNavItems: NavItem[] = [
    { id: 'language', nameKey: 'preferences.language.title' },
    { id: 'theme', nameKey: 'preferences.theme.title' },
    { id: 'notification', nameKey: 'preferences.notifications.title' },
  ];
  
  const appNavItems: NavItem[] = [
    { id: 'library', nameKey: 'sidebar.library' },
    { id: 'settings', nameKey: 'sidebar.settings' },
  ];
  
  const supportNavItems: NavItem[] = [
    { id: 'report', nameKey: 'sidebar.report'},
    { id: 'feedback', nameKey: 'sidebar.feedback' },
    { id: 'help', nameKey: 'sidebar.help' },
    { id: 'tutorial', nameKey: 'sidebar.tutorial' },
    { id: 'about', nameKey: 'sidebar.about' },
  ];

  const handleNavClick = (newView: View) => {
    setView(newView);
    if (window.innerWidth < 1024) { 
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
        className={`flex items-center justify-between px-4 py-2.5 text-sm rounded-md transition-colors duration-200 ${
          isActive
            ? "bg-white/20 text-white font-semibold shadow-sm"
            : "text-gray-200 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span>{t(item.nameKey)}</span>
        <div className="flex items-center gap-1.5">
          {item.id === 'collaborative' && (
              <span className="flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black bg-emerald-500 text-white rounded-full tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
                  NEW
              </span>
          )}
          {item.id === 'history' && (
              <span className="flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black bg-blue-500 text-white rounded-full tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
                  🕐
              </span>
          )}
          {item.id === 'examprep' && (
              <span className="flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black bg-amber-400 text-black rounded-full tracking-wide uppercase" style={{ letterSpacing: '0.08em' }}>
                  ✦
              </span>
          )}
          {item.id === 'feedback' && unreadFeedbackCount > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full animate-pulse shadow-sm">
                  {unreadFeedbackCount > 99 ? '99+' : unreadFeedbackCount}
              </span>
          )}
        </div>
      </a>
    );
  };
  
  const NavGroup: React.FC<{titleKey: TranslationKey, items: NavItem[]}> = ({ titleKey, items }) => (
    <div>
        <h3 className="px-4 text-xs font-bold text-white/50 uppercase tracking-wider mb-2">{t(titleKey)}</h3>
        <div className="space-y-1">
            {items.map(item => <NavLink key={item.id} item={item} currentView={view} onClick={handleNavClick} />)}
        </div>
    </div>
  );

  const CollapsibleNavGroup: React.FC<{
    titleKey: TranslationKey;
    sectionId: string;
    items: NavItem[];
  }> = ({ titleKey, sectionId, items }) => {
    const isOpen = openSection === sectionId;
    const hasGroupBadge = items.some(item => item.id === 'feedback' && unreadFeedbackCount > 0);

    return (
        <div>
            <button
                onClick={() => toggleSection(sectionId)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white rounded-md transition-colors"
            >
                <div className="flex items-center gap-2">
                    <span>{t(titleKey)}</span>
                    {!isOpen && hasGroupBadge && (
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                    )}
                </div>
                <ChevronDownIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="pl-6 mt-1 space-y-1 border-l-2 border-white/20 ml-2">
                    {items.map(item => <NavLink key={item.id} item={item} currentView={view} onClick={handleNavClick} />)}
                </div>
            )}
        </div>
    );
  };

  // ── Sidebar inner content with Ghana classroom background ────────────────
  const sidebarContent = (
      <div className="flex flex-col h-full no-print relative overflow-hidden">

          {/* ── Background image ── */}
          <div
              style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: 'url(/Ghana_village_school__desk_corner.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  backgroundRepeat: 'no-repeat',
                  zIndex: 0,
              }}
          />

          {/* ── Dark overlay — keeps text readable ── */}
          <div
              style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(180deg, rgba(10,20,40,0.92) 0%, rgba(10,20,40,0.85) 60%, rgba(10,20,40,0.95) 100%)',
                  zIndex: 1,
              }}
          />

          {/* ── All sidebar content sits above background ── */}
          <div className="relative z-10 flex flex-col h-full">

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
                  <div className="flex items-center">
                      <LogoIcon className="w-8 h-8 text-blue-400" />
                      <span className="ml-3 text-2xl font-bold text-white">EduBlay</span>
                  </div>
                  <button
                      onClick={() => setOpen(false)}
                      className="lg:hidden p-1 -mr-2 text-white/60 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                  >
                      <CloseIcon className="w-6 h-6" />
                  </button>
              </div>

              {/* User greeting */}
              {userDetails && (
                  <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-xs text-white/50 font-medium">Welcome back,</p>
                      <p className="text-sm font-bold text-white truncate">{userDetails.name || userDetails.email}</p>
                  </div>
              )}

              {/* Nav */}
              <nav className="flex-1 px-4 pt-4 pb-24 lg:pb-4 space-y-6 overflow-y-auto">
                  <NavGroup titleKey="sidebar.manage" items={manageNavItems} />
                  <CollapsibleNavGroup titleKey="sidebar.preferences" sectionId="preferences" items={preferencesNavItems} />
                  <CollapsibleNavGroup titleKey="sidebar.app" sectionId="app" items={appNavItems} />
                  <CollapsibleNavGroup titleKey="sidebar.support" sectionId="support" items={supportNavItems} />
              </nav>

              {/* Bottom tag */}
              <div className="px-4 py-3 border-t border-white/10 text-center">
                  <p className="text-[10px] text-white/30 font-medium uppercase tracking-widest">
                      EduBlay · Study Smarter
                  </p>
              </div>
          </div>
      </div>
  );

  return (
    <>
        {isOpen && (
            <div
                className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden no-print"
                onClick={() => setOpen(false)}
            />
        )}
        
        {/* Mobile sidebar */}
        <div className={`fixed inset-y-0 left-0 z-40 flex lg:hidden transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} no-print`}>
            <div className="relative flex-1 flex flex-col max-w-xs w-full shadow-2xl">
               {sidebarContent}
            </div>
        </div>
        
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0 no-print">
            <div className="flex flex-col w-64 border-r border-white/10">
                {sidebarContent}
            </div>
        </div>
    </>
  );
};

export default Sidebar;