import React, { useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { UserDetails, EducationalLevel } from '../types.ts';
import { countries } from '../data/countries.ts';
import { universities } from '../data/universities.ts';
import SearchableDropdown from './SearchableDropdown.tsx';

interface UserDetailsFormProps {
    userDetails: UserDetails;
    setUserDetails: (details: UserDetails) => void;
    showExtendedFields?: boolean;
}

const UserDetailsForm: React.FC<UserDetailsFormProps> = ({ userDetails, setUserDetails, showExtendedFields = false }) => {
    const { t } = useLanguage();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setUserDetails({ ...userDetails, [e.target.name]: e.target.value });
    };
    
    const handleDropdownChange = (name: keyof UserDetails, value: string) => {
        setUserDetails({ ...userDetails, [name]: value });
    };

    const universityOptions = useMemo(() => {
        const filtered = userDetails.country
            ? universities.filter(u => u.country === userDetails.country)
            : universities;
        return filtered.map(u => ({ name: u.name }));
    }, [userDetails.country]);
    
    const countryOptions = useMemo(() => countries.map(c => ({ name: c })), []);
    
    const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

    const programmeLabel =
        userDetails.educationalLevel === EducationalLevel.HIGH_SCHOOL || userDetails.educationalLevel === EducationalLevel.OTHER
            ? t('userDetails.courseOfStudy')
            : t('userDetails.programmeOfStudies');
            
    const isUniversityLevel = ![EducationalLevel.HIGH_SCHOOL, EducationalLevel.OTHER].includes(userDetails.educationalLevel);

    const eduLevelOptions = [
        { value: EducationalLevel.HIGH_SCHOOL, labelKey: 'eduLevel.highSchool' },
        { value: EducationalLevel.UNDERGRADUATE, labelKey: 'eduLevel.undergraduate' },
        { value: EducationalLevel.POSTGRADUATE, labelKey: 'eduLevel.postgraduate' },
        { value: EducationalLevel.DOCTORATE, labelKey: 'eduLevel.doctorate' },
        { value: EducationalLevel.OTHER, labelKey: 'eduLevel.other' },
    ];

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('userDetails.name')}</label>
                <input type="text" name="name" id="name" value={userDetails.name} onChange={handleInputChange} className={inputClasses} required />
            </div>
            {showExtendedFields && (
                <>
                     <div>
                        <label htmlFor="biography" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.biography')} ({t('common.optional')})</label>
                        <textarea 
                            name="biography" 
                            id="biography" 
                            rows={4}
                            value={userDetails.biography || ''} 
                            onChange={handleInputChange} 
                            className={`${inputClasses} resize-y`} 
                            placeholder={t('profile.biographyPlaceholder')}
                            maxLength={500}
                        />
                        <p className="text-xs text-right text-gray-500 dark:text-gray-400 mt-1">{(userDetails.biography || '').length} / 500</p>
                    </div>
                </>
            )}

            <div>
                <label htmlFor="educationalLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('userDetails.level')}</label>
                <select name="educationalLevel" id="educationalLevel" value={userDetails.educationalLevel} onChange={handleInputChange} className={inputClasses}>
                    {eduLevelOptions.map(({ value, labelKey }) => (
                        <option key={value} value={value}>{t(labelKey as any)}</option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="programmeOfStudy" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{programmeLabel}</label>
                <input
                    type="text"
                    name="programmeOfStudy"
                    id="programmeOfStudy"
                    value={userDetails.programmeOfStudy || ''}
                    onChange={handleInputChange}
                    className={inputClasses}
                    placeholder={t('userDetails.programmePlaceholder')}
                />
            </div>
            
            {isUniversityLevel ? (
                <>
                    <div>
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('userDetails.country')}
                            <span className="text-red-500 ml-1">*</span>
                        </label>
                         <SearchableDropdown
                            id="country"
                            name="country"
                            options={countryOptions}
                            value={userDetails.country || ''}
                            onChange={(value) => handleDropdownChange('country', value)}
                            placeholder={t('userDetails.countryPlaceholder')}
                         />
                    </div>
                     <div>
                        <label htmlFor="institution" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('userDetails.institution')}</label>
                         <SearchableDropdown
                            id="institution"
                            name="institution"
                            options={universityOptions}
                            value={userDetails.institution || ''}
                            onChange={(value) => handleDropdownChange('institution', value)}
                            placeholder={t('userDetails.institutionPlaceholder')}
                            disabled={!userDetails.country}
                         />
                    </div>
                    {showExtendedFields && (
                        <div>
                            <label htmlFor="institutionAbbreviation" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('profile.institutionAbbr')} ({t('common.optional')})</label>
                            <input
                                type="text"
                                name="institutionAbbreviation"
                                id="institutionAbbreviation"
                                value={userDetails.institutionAbbreviation || ''}
                                onChange={handleInputChange}
                                className={inputClasses}
                                placeholder={t('profile.institutionAbbrPlaceholder')}
                                maxLength={10}
                            />
                        </div>
                    )}
                </>
            ) : (
                 <div>
                    <label htmlFor="institution" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('userDetails.institution')}</label>
                    <input
                        type="text"
                        name="institution"
                        id="institution"
                        value={userDetails.institution || ''}
                        onChange={handleInputChange}
                        className={inputClasses}
                        placeholder={t('userDetails.institutionPlaceholder.school' as any)}
                    />
                </div>
            )}
            
             <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('userDetails.email')} ({t('common.optional')})</label>
                <input type="email" name="email" id="email" value={userDetails.email || ''} onChange={handleInputChange} className={inputClasses} />
            </div>
        </div>
    );
};

export default UserDetailsForm;