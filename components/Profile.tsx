
import React, { useState } from 'react';
// FIX: Added .ts extension
import type { UserDetails, Toast } from '../types.ts';
// FIX: Import `EducationalLevel` as a value to use it for default props.
import { EducationalLevel } from '../types.ts';
import UserDetailsForm from './UserDetailsForm';
import { useLanguage } from '../contexts/LanguageContext';

interface ProfileProps {
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
  addToast: (message: string, type: Toast['type']) => void;
}

const Profile: React.FC<ProfileProps> = ({ userDetails: initialDetails, setUserDetails: setGlobalUserDetails, addToast }) => {
  const { t } = useLanguage();
  
  // Ensure we don't pass null to the form
  // FIX: Use the enum member `EducationalLevel.UNDERGRADUATE` instead of a string literal.
  const safeInitialDetails = initialDetails || { name: '', educationalLevel: EducationalLevel.UNDERGRADUATE, country: '', institution: '' };

  const [userDetails, setUserDetails] = useState<UserDetails>(safeInitialDetails);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    if (!userDetails.name) {
        // @ts-ignore
        addToast(t('profile.error.nameRequired'), 'error');
        return;
    }
    if (userDetails.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userDetails.email)) {
        addToast(t('userdetails.emailInvalid' as any), 'error');
        return;
      }
    }
    setGlobalUserDetails(userDetails);
    setIsEditing(false);
    // @ts-ignore
    addToast(t('profile.success'), 'success');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setUserDetails(safeInitialDetails);
  }

  if (!initialDetails) return <div>Loading profile...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        {/* @ts-ignore */}
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('profile.title')}</h2>
        {/* @ts-ignore */}
        <p className="text-gray-500 dark:text-gray-400 mt-1">{t('profile.subtitle')}</p>
      </div>
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <UserDetailsForm userDetails={userDetails} setUserDetails={setUserDetails} disabled={!isEditing} />
        <div className="mt-6 flex justify-end gap-4">
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-700 text-white rounded-md">{t('common.save')}</button>
            </>
          ) : (
            // @ts-ignore
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-blue-700 text-white rounded-md">{t('profile.edit')}</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
