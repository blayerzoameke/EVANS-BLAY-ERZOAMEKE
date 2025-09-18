import React from 'react';
import { UserDetails, EducationalLevel } from '../types.ts';
import { countries } from '../data/countries';
import { universities } from '../data/universities';
import SearchableDropdown from './SearchableDropdown';
import { useLanguage } from '../contexts/LanguageContext';

interface UserDetailsFormProps {
  userDetails: UserDetails;
  setUserDetails: (details: UserDetails) => void;
  disabled?: boolean;
}

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({ userDetails, setUserDetails, disabled }) => {
  const { t } = useLanguage();
  
  const inputClasses = "mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";


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
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('userdetails.fullName')}
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={userDetails.name}
          onChange={handleInputChange}
          className={inputClasses}
          placeholder={t('userdetails.fullNamePlaceholder')}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('userdetails.emailOptional')}
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={userDetails.email || ''}
          onChange={handleInputChange}
          className={inputClasses}
          placeholder={t('userdetails.emailPlaceholder')}
          disabled={disabled}
        />
      </div>
      <div>
        <label htmlFor="educationalLevel" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {t('userdetails.level')}
        </label>
        <select
          id="educationalLevel"
          name="educationalLevel"
          value={userDetails.educationalLevel}
          onChange={handleInputChange}
          className={`${inputClasses} pl-3 pr-10 py-2`}
          disabled={disabled}
        >
          {Object.values(EducationalLevel).map(level => (
            <option key={level} value={level}>
              {t(`userdetails.level.${level}` as any)}
            </option>
          ))}
        </select>
      </div>
      {userDetails.educationalLevel !== EducationalLevel.HIGH_SCHOOL && (
        <>
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('userdetails.country')} <span className="text-red-500">*</span>
            </label>
            <SearchableDropdown
                id="country"
                name="country"
                options={countries.map(c => ({name: c}))}
                value={userDetails.country || ''}
                onChange={(value) => handleDropdownChange('country', value)}
                placeholder={t('userdetails.countryPlaceholder')}
                disabled={disabled}
            />
          </div>
          <div>
            <label htmlFor="institution" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t('userdetails.institution')}
            </label>
            <SearchableDropdown
                id="institution"
                name="institution"
                options={filteredUniversities}
                value={userDetails.institution || ''}
                onChange={(value) => handleDropdownChange('institution', value)}
                placeholder={t('userdetails.institutionPlaceholder')}
                disabled={disabled || !userDetails.country}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default UserDetailsForm;