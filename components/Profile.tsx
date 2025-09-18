import React, { useState, useEffect, useRef } from 'react';
import type { UserDetails, Toast } from '../types.ts';
import { EducationalLevel } from '../types.ts';
import UserDetailsForm from './UserDetailsForm';
import { useLanguage } from '../contexts/LanguageContext';
import { PencilIcon } from './icons/PencilIcon.tsx';
import { UploadIcon } from './icons/UploadIcon.tsx';
import ConfirmationModal from './ConfirmationModal.tsx';

interface ProfileProps {
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
  addToast: (message: string, type: Toast['type']) => void;
}

const emptyUserDetails: UserDetails = { 
    name: '', 
    educationalLevel: EducationalLevel.UNDERGRADUATE, 
    country: '', 
    institution: '', 
    email: '',
    profilePicture: null,
    institutionLogo: null,
    biography: ''
};

const Profile: React.FC<ProfileProps> = ({ 
    userDetails: initialDetails, 
    setUserDetails: setGlobalUserDetails,
    addToast,
}) => {
  const [localDetails, setLocalDetails] = useState<UserDetails>(initialDetails || emptyUserDetails);
  const [isEditing, setIsEditing] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const { t } = useLanguage();
  
  const profilePicRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialDetails) {
      setLocalDetails(initialDetails);
    }
  }, [initialDetails, isEditing]);

  const isDirty = JSON.stringify(localDetails) !== JSON.stringify(initialDetails);
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'profilePicture' | 'institutionLogo') => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setLocalDetails(prev => ({...prev, [field]: reader.result as string}));
          };
          reader.readAsDataURL(file);
      }
  };

  const handleSave = () => {
    setGlobalUserDetails(localDetails);
    setIsEditing(false);
    addToast(t('toasts.profileSaved'), 'success');
  };
  
  const handleCancel = () => {
    if (isDirty) {
        setShowCancelConfirm(true);
    } else {
        setIsEditing(false);
    }
  }
  
  const confirmCancel = () => {
    setIsEditing(false);
    setShowCancelConfirm(false);
    // State will be reset by the useEffect hook
  }

  return (
    <>
        <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('profile.title')}</h2>
            <div className="flex items-center justify-end gap-4">
            {isEditing ? (
                <>
                <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">{t('profile.cancel')}</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800">{t('profile.save')}</button>
                </>
            ) : (
                <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-700 rounded-md hover:bg-blue-800">{t('profile.edit')}</button>
            )}
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center gap-6 mb-6">
                    <div className="relative">
                        {localDetails.profilePicture ? (
                            <img src={localDetails.profilePicture} alt="Profile" className="w-24 h-24 rounded-full object-cover" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-blue-600 text-white flex items-center justify-center text-4xl font-bold">
                                {localDetails.name ? localDetails.name[0].toUpperCase() : ''}
                            </div>
                        )}
                        {isEditing && (
                            <>
                                <button onClick={() => profilePicRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-white dark:bg-gray-700 rounded-full shadow-md hover:bg-gray-100">
                                    <PencilIcon className="w-4 h-4 text-gray-600 dark:text-gray-200" />
                                </button>
                                <input type="file" ref={profilePicRef} accept="image/*" onChange={(e) => handleImageUpload(e, 'profilePicture')} className="hidden" />
                            </>
                        )}
                    </div>
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{localDetails.name || "Your Name"}</h3>
                        <p className="text-gray-500 dark:text-gray-400">{localDetails.email || "your.email@example.com"}</p>
                    </div>
                </div>
                <UserDetailsForm 
                    userDetails={localDetails} 
                    setUserDetails={setLocalDetails} 
                    disabled={!isEditing}
                />
            </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('profile.biography')}
                    </label>
                    <textarea
                        rows={5}
                        value={localDetails.biography || ''}
                        onChange={(e) => setLocalDetails(d => ({...d, biography: e.target.value}))}
                        className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 dark:disabled:bg-gray-700"
                        placeholder={t('profile.biographyPlaceholder')}
                        disabled={!isEditing}
                    />
                </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('userdetails.institutionLogo')}</label>
                    {localDetails.institutionLogo && (
                        <img src={localDetails.institutionLogo} alt="Institution Logo" className="max-h-20 mx-auto mb-4" />
                    )}
                    {isEditing && (
                        <>
                            <button onClick={() => logoRef.current?.click()} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">
                            <UploadIcon className="w-4 h-4" /> {t('profile.uploadLogo')}
                            </button>
                            <input type="file" ref={logoRef} accept="image/*" onChange={(e) => handleImageUpload(e, 'institutionLogo')} className="hidden" />
                        </>
                    )}
                </div>
            </div>
        </div>

        <ConfirmationModal
            isOpen={showCancelConfirm}
            onClose={() => setShowCancelConfirm(false)}
            onConfirm={confirmCancel}
            title={t('confirmation.discardChanges.title')}
            message={t('confirmation.discardChanges.message')}
            confirmText={t('common.discard')}
            cancelText={t('common.keepEditing')}
            confirmColor="red"
        />
        </div>
    </>
  );
};

export default Profile;