import React from 'react';
import { MenuIcon } from './icons/MenuIcon';
import { LogoIcon } from './icons/LogoIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { UserDetails } from '../types';
import { View } from '../App';

interface HeaderProps {
  toggleSidebar: () => void;
  userDetails: UserDetails | null;
  setView: (view: View) => void;
}

const Header: React.FC<HeaderProps> = ({ toggleSidebar, userDetails, setView }) => {
  const { t } = useLanguage();
  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm no-print">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="text-slate-500 dark:text-slate-400 focus:outline-none focus:text-slate-700 dark:focus:text-slate-200 lg:hidden"
          aria-label="Open sidebar"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center ml-4">
            <LogoIcon className="w-8 h-8 text-blue-700 dark:text-blue-500" />
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 ml-2">
                {t('header.title')}
            </h1>
        </div>
      </div>
      <div className="flex items-center">
         <button onClick={() => setView('profile')} className="flex items-center gap-3 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
             <span className="font-semibold text-sm hidden md:block text-slate-700 dark:text-slate-200">{userDetails?.name}</span>
             {userDetails?.profilePicture ? (
                 <img src={userDetails.profilePicture} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
             ) : (
                 <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                     {userDetails?.name ? userDetails.name[0].toUpperCase() : ''}
                 </div>
             )}
         </button>
      </div>
    </header>
  );
};

export default Header;