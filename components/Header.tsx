import React, { useState, useEffect, useRef } from 'react';
import { MenuIcon } from './icons/MenuIcon';
import { LogoIcon } from './icons/LogoIcon';
import { useLanguage } from '../contexts/LanguageContext';
import { UserDetails, Toast, View } from '../types';
import { ShareIcon } from './icons/ShareIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { UserCircleIcon } from './icons/UserCircleIcon';

interface HeaderProps {
  toggleSidebar: () => void;
  userDetails: UserDetails | null;
  setView: (view: View) => void;
  addToast: (message: string, type: Toast['type']) => void;
  handleLogout: () => void;
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

const Header: React.FC<HeaderProps> = ({ toggleSidebar, userDetails, setView, addToast, handleLogout }) => {
  const { t } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleShare = async () => {
    const appUrl = 'https://bit.ly/EduBlaystudyhub';

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
        navigator.clipboard.writeText(appUrl).then(() => {
            addToast(t('toasts.shareFallback'), 'info');
        }).catch(err => {
            console.error('Failed to copy link:', err);
            addToast(t('toasts.copyLinkError'), 'error');
        });
    }
  };

  return (
    <>
      <style>{`
        .eb-header {
          padding-top: 1rem;
          padding-top: max(1rem, calc(env(safe-area-inset-top) + 0.5rem));
          padding-left: max(1rem, calc(env(safe-area-inset-left) + 0.5rem));
          padding-right: max(1rem, calc(env(safe-area-inset-right) + 0.5rem));
          padding-bottom: 0.75rem;
        }
        .eb-hamburger {
          min-width: 44px; min-height: 44px;
          display: flex; align-items: center; justify-content: center;
          margin-left: -8px; border-radius: 10px;
          -webkit-tap-highlight-color: transparent;
        }
        .eb-hamburger:active { background: rgba(0,0,0,0.06); }
        .dark .eb-hamburger:active { background: rgba(255,255,255,0.08); }
      `}</style>
    <header className="relative z-10 eb-header flex items-center justify-between bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm no-print">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="eb-hamburger text-gray-500 dark:text-gray-400 focus:outline-none lg:hidden"
          aria-label={t('header.openSidebar')}
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
      <div className="flex items-center gap-4">
        <button
            onClick={handleShare}
            className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={t('common.share')}
        >
            <ShareIcon className="w-5 h-5" />
        </button>
        <div className="relative" ref={dropdownRef}>
            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <span className="font-semibold text-sm hidden md:block text-gray-700 dark:text-gray-200">{userDetails?.name}</span>
                {userDetails?.profilePicture ? (
                    <img src={userDetails.profilePicture} alt={t('profile.alt.profilePicture')} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-text flex items-center justify-center font-bold text-sm">
                        {getInitials(userDetails?.name)}
                    </div>
                )}
            </button>
            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border dark:border-gray-700">
                    <button
                        onClick={() => { setView('profile'); setIsDropdownOpen(false); }}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <UserCircleIcon className="w-4 h-4" />
                        My Profile
                    </button>
                    <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <LogoutIcon className="w-4 h-4" />
                        Log Out
                    </button>
                </div>
            )}
        </div>
      </div>
    </header>
    </>
  );
};

export default Header;