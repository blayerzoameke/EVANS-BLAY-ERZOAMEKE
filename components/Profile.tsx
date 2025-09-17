import React, { useState, useEffect } from 'react';
import type { UserDetails } from '../types';
import UserDetailsForm from './UserDetailsForm';

interface ProfileProps {
  userDetails: UserDetails | null;
  setUserDetails: (details: UserDetails) => void;
}

const Profile: React.FC<ProfileProps> = ({ userDetails: initialDetails, setUserDetails: setGlobalDetails }) => {
  const [userDetails, setUserDetails] = useState<UserDetails>(initialDetails || { name: '', educationalLevel: 'Undergraduate', country: '', institution: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (initialDetails) {
      setUserDetails(initialDetails);
    }
  }, [initialDetails]);

  const handleSave = () => {
    setGlobalDetails(userDetails);
    setIsEditing(false);
    setSuccessMessage('Profile updated successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };
  
  const handleCancel = () => {
    if (initialDetails) {
      setUserDetails(initialDetails);
    }
    setIsEditing(false);
  }

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6">Your Profile</h2>
      <div className="space-y-6">
        <UserDetailsForm 
          userDetails={userDetails} 
          setUserDetails={setUserDetails} 
          disabled={!isEditing}
        />
        <div className="flex items-center justify-end gap-4 pt-4">
          {isEditing ? (
            <>
              <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Save Changes</button>
            </>
          ) : (
            <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Edit Profile</button>
          )}
        </div>
        {successMessage && <p className="text-center text-green-600 dark:text-green-400 mt-4">{successMessage}</p>}
      </div>
    </div>
  );
};

export default Profile;
