import React from 'react';
import { UserDetails } from '../types';
import { countries } from '../data/countries';
import { universities } from '../data/universities';
import SearchableDropdown from './SearchableDropdown';

interface UserDetailsFormProps {
  userDetails: UserDetails;
  setUserDetails: (details: UserDetails) => void;
  disabled?: boolean;
}

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({ userDetails, setUserDetails, disabled }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setUserDetails({ ...userDetails, [e.target.name]: e.target.value });
  };
  
  const handleDropdownChange = (name: string, value: string) => {
    setUserDetails({ ...userDetails, [name]: value });
  }

  const filteredUniversities = userDetails.country 
    ? universities.filter(u => u.country === userDetails.country) 
    : universities;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Full Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={userDetails.name}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="e.g., Jane Doe"
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor="educationalLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Educational Level
        </label>
        <select
          id="educationalLevel"
          name="educationalLevel"
          value={userDetails.educationalLevel}
          onChange={handleInputChange}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          disabled={disabled}
        >
          <option>High School</option>
          <option>Undergraduate</option>
          <option>Postgraduate</option>
          <option>PhD</option>
          <option>Other</option>
        </select>
      </div>
       <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Country
        </label>
        <SearchableDropdown
            id="country"
            name="country"
            options={countries.map(c => ({name: c}))}
            value={userDetails.country || ''}
            onChange={(value) => handleDropdownChange('country', value)}
            placeholder="Select your country"
            disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor="institution" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Institution / University
        </label>
         <SearchableDropdown
            id="institution"
            name="institution"
            options={filteredUniversities}
            value={userDetails.institution || ''}
            onChange={(value) => handleDropdownChange('institution', value)}
            placeholder="Type to search for your institution"
            disabled={disabled || !userDetails.country}
        />
      </div>
    </div>
  );
};

export default UserDetailsForm;
