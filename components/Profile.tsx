import React, { useState, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserDetails, Toast, ProfileEditState } from '../types.ts';
import UserDetailsForm from './UserDetailsForm.tsx';
import { PencilIcon } from './icons/PencilIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { BuildingIcon } from './icons/BuildingIcon.tsx';
import CropImageModal from './CropImageModal.tsx';

interface ProfileProps {
    userDetails: UserDetails | null;
    setUserDetails: (details: UserDetails) => void;
    addToast: (message: string, type: Toast['type']) => void;
    profileEditState: ProfileEditState;
    setProfileEditState: React.Dispatch<React.SetStateAction<ProfileEditState>>;
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

const Profile: React.FC<ProfileProps> = ({ userDetails: initialDetails, setUserDetails, addToast, profileEditState, setProfileEditState }) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);

    const { isEditing, details: editableDetails } = profileEditState;

    if (!initialDetails) return <div>Loading profile...</div>;

    const handleEditClick = () => {
        setProfileEditState({ isEditing: true, details: initialDetails });
    };

    const handleSave = () => {
        if (!editableDetails || !editableDetails.name.trim()) {
            addToast('Full Name is required.', 'error');
            return;
        }
        setUserDetails(editableDetails);
        setProfileEditState({ isEditing: false, details: null });
        addToast(t('toasts.profileUpdated'), 'success');
    };

    const handleCancel = () => {
        setProfileEditState({ isEditing: false, details: null });
    };

    const setEditableDetails = (updater: (prev: UserDetails | null) => UserDetails | null) => {
        setProfileEditState(prev => ({ ...prev, details: updater(prev.details) }));
    };
    
    const handlePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                addToast('Profile picture must be less than 5MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImageToCrop(reader.result as string);
                setIsCropModalOpen(true);
            };
            reader.readAsDataURL(file);
        } else if (file) {
            addToast('Please select a valid image file.', 'error');
        }
        if (e.target) e.target.value = '';
    };

    const handleCropComplete = (croppedImageUrl: string) => {
        setEditableDetails(prev => prev ? { ...prev, profilePicture: croppedImageUrl } : null);
        setIsCropModalOpen(false);
        setImageToCrop(null);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                addToast('Institution logo must be less than 2MB.', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditableDetails(prev => prev ? { ...prev, institutionLogo: reader.result as string } : null);
            };
            reader.readAsDataURL(file);
            addToast('Institution logo updated!', 'success');
        } else if (file) {
            addToast('Please select a valid image file for logo.', 'error');
        }
    };
    
    const displayDetails = isEditing ? editableDetails : initialDetails;
    if (!displayDetails) return <div>Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                 <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('profile.title')}</h2>
                 {!isEditing && (
                     <button onClick={handleEditClick} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-text bg-primary rounded-md hover:bg-primary-dark">
                         <PencilIcon className="w-4 h-4" /> {t('common.edit')}
                     </button>
                 )}
            </div>
           
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                 <div className="flex flex-col items-center space-y-4 mb-8">
                    <div className="flex items-start gap-10">
                        <div className="relative group">
                            {displayDetails.profilePicture ? (
                                <img src={displayDetails.profilePicture} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700" />
                            ) : (
                                <div className="w-32 h-32 rounded-full bg-primary text-primary-text flex items-center justify-center font-bold text-5xl border-4 border-gray-200 dark:border-gray-700">
                                    {getInitials(displayDetails.name)}
                                </div>
                            )}
                            {isEditing && (
                                <>
                                    <button onClick={() => fileInputRef.current?.click()} className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Change profile picture">
                                        <PencilIcon className="w-8 h-8" />
                                    </button>
                                    <input type="file" ref={fileInputRef} onChange={handlePictureUpload} className="hidden" accept="image/png, image/jpeg, image/webp" />
                                </>
                            )}
                        </div>
                        <div className="flex flex-col items-center mt-4">
                            <div className="relative group">
                                {displayDetails.institutionLogo ? (
                                    <img src={displayDetails.institutionLogo} alt="Institution Logo" className="w-24 h-24 rounded-full object-contain border-2 border-gray-200 dark:border-gray-600" />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200 dark:border-gray-600">
                                        <BuildingIcon className="w-12 h-12 text-gray-400" />
                                    </div>
                                )}
                                {isEditing && (
                                    <>
                                        <button onClick={() => logoInputRef.current?.click()} className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Change institution logo">
                                            <PencilIcon className="w-6 h-6" />
                                        </button>
                                        <input type="file" ref={logoInputRef} onChange={handleLogoUpload} className="hidden" accept="image/png, image/jpeg, image/webp, image/svg+xml" />
                                    </>
                                )}
                            </div>
                             {!isEditing && initialDetails.institutionAbbreviation && (
                                <p className="text-xs font-semibold text-center text-gray-500 dark:text-gray-400 mt-2 w-24 truncate" title={initialDetails.institution}>{initialDetails.institutionAbbreviation}</p>
                            )}
                        </div>
                    </div>

                    {!isEditing && (
                        <div className="text-center">
                            <h3 className="text-2xl font-bold">{initialDetails.name}</h3>
                            {initialDetails.programmeOfStudy && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{initialDetails.programmeOfStudy}</p>}
                        </div>
                    )}
                 </div>

                 {isEditing && editableDetails ? (
                    <>
                        <UserDetailsForm userDetails={editableDetails} setUserDetails={(details) => setEditableDetails(() => details)} showExtendedFields={true} />
                        <div className="flex justify-end gap-4 mt-6">
                            <button onClick={handleCancel} className="px-6 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">{t('common.cancel')}</button>
                            <button onClick={handleSave} className="flex items-center gap-2 px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"><SaveIcon className="w-4 h-4" /> {t('common.save')}</button>
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                         {initialDetails.biography && (
                            <div>
                                <h4 className="font-semibold text-gray-800 dark:text-gray-300 mb-1 border-b pb-1 dark:border-gray-600">Biography</h4>
                                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap pt-2">{initialDetails.biography}</p>
                            </div>
                         )}
                         <div>
                            <h4 className="font-semibold text-gray-800 dark:text-gray-300 mb-1 border-b pb-1 dark:border-gray-600">Details</h4>
                            <div className="space-y-4 pt-2">
                                <div><p className="text-sm text-gray-500">{t('userDetails.email')}</p><p className="text-lg">{initialDetails.email || 'Not provided'}</p></div>
                                <div><p className="text-sm text-gray-500">{t('userDetails.level')}</p><p className="text-lg">{initialDetails.educationalLevel}</p></div>
                                {initialDetails.country && <div><p className="text-sm text-gray-500">{t('userDetails.country')}</p><p className="text-lg">{initialDetails.country}</p></div>}
                                {initialDetails.institution && <div><p className="text-sm text-gray-500">{t('userDetails.institution')}</p><p className="text-lg">{initialDetails.institution}</p></div>}
                            </div>
                         </div>
                    </div>
                )}
            </div>

            {isCropModalOpen && imageToCrop && (
                <CropImageModal isOpen={isCropModalOpen} onClose={() => setIsCropModalOpen(false)} imageSrc={imageToCrop} onCropComplete={handleCropComplete} />
            )}
        </div>
    );
};

export default Profile;