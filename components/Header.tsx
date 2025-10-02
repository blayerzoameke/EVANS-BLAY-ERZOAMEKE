
import React from 'react';
import { MenuIcon } from './icons/MenuIcon.tsx';
import { LogoIcon } from './icons/LogoIcon.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { UserDetails, Toast } from '../types.ts';
import type { View } from '../App.tsx';
import { ShareIcon } from './icons/ShareIcon.tsx';

interface HeaderProps {
  toggleSidebar: () => void;
  userDetails: UserDetails | null;
  setView: (view: View) => void;
  addToast: (message: string, type: Toast['type']) => void;
}

const getInitials = (name: string | undefined): string => {
    if (!name) return '';
    const nameParts = name.trim().split(' ').filter(Boolean);
    if (nameParts.length === 1) {
        return nameParts[0][0]?.toUpperCase() || '';
    }
    if (nameParts.length > 1) {
        const firstInitial = nameParts[0][0]?.toUpperCase() || '';
        const lastInitial = nameParts[nameParts.length - 1][0]?.toUpperCase() || '';
        return `${firstInitial}${lastInitial}`;
    }
    return '';
};

const Header: React.FC<HeaderProps> = ({ toggleSidebar, userDetails, setView, addToast }) => {
  const { t } = useLanguage();

  const handleShare = async () => {
    const appUrl = 'https://edublay-study-hub.web.app/';

    const shareData = {
      title: t('header.title'),
      text: t('about.intro'),
      url: appUrl,
    };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            addToast(t('toasts.shareSuccess'), 'success');
        } catch (err) {
            if ((err as DOMException).name !== 'AbortError') {
                console.error('Error sharing:', err);
                addToast(t('toasts.shareError'), 'error');
            }
        }
    } else {
        // Fallback to copying the link
        navigator.clipboard.writeText(appUrl).then(() => {
            addToast(t('toasts.shareFallback'), 'info');
        }).catch(err => {
            console.error('Failed to copy link:', err);
            addToast(t('toasts.copyLinkError'), 'error');
        });
    }
  };

  return (
    <header className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm no-print">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="text-gray-500 dark:text-gray-400 focus:outline-none focus:text-gray-700 dark:focus:text-gray-200 lg:hidden"
          aria-label={t('header.openSidebar' as any)}
        >
          <MenuIcon className="w-6 h-6" />
        </button>
        <div className="flex items-center ml-4">
            <LogoIcon className="w-8 h-8 text-primary dark:text-primary-light" />
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 ml-2">
                {t('header.title')}
            </h1>
        </div>
      </div>
      <div className="flex items-center">
        <button
            onClick={handleShare}
            className="p-2 mr-4 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={t('common.share')}
        >
            <ShareIcon className="w-5 h-5" />
        </button>
         <button onClick={() => setView('profile')} className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
             <span className="font-semibold text-sm hidden md:block text-gray-700 dark:text-gray-200">{userDetails?.name}</span>
             {userDetails?.profilePicture ? (
                 <img src={userDetails.profilePicture} alt={t('profile.alt' as any)} className="w-8 h-8 rounded-full object-cover" />
             ) : (
                 <div className="w-8 h-8 rounded-full bg-primary text-primary-text flex items-center justify-center font-bold text-sm">
                     {getInitials(userDetails?.name)}
                 </div>
             )}
         </button>
      </div>
    </header>
  );
};

export default Header;
