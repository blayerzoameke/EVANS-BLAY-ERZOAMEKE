// FIX: Implement Library component to resolve module error.
import React, { useState } from 'react';
import { libraryResources } from '../data/libraryResources.ts';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { SearchIcon } from './icons/SearchIcon.tsx';
import { BookIcon } from './icons/BookIcon.tsx';
import { ToolsIcon } from './icons/ToolsIcon.tsx';
import { WriteIcon } from './icons/WriteIcon.tsx';
import { BuildingIcon } from './icons/BuildingIcon.tsx';

const categoryIcons: { [key: string]: React.FC<React.SVGProps<SVGSVGElement>> } = {
    'digital-book-libraries': BuildingIcon,
    'study-techniques': BookIcon,
    'productivity-tools': ToolsIcon,
    'writing-aids': WriteIcon,
    'research-databases': SearchIcon,
};

const Library: React.FC = () => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    
    const categories = Array.from(new Set(libraryResources.map(r => r.category)));

    const filteredResources = libraryResources.filter(resource =>
        t(resource.titleKey as any).toLowerCase().includes(searchTerm.toLowerCase()) ||
        t(resource.descriptionKey as any).toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8">
            <div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('library.title')}</h2>
                <p className="text-gray-500 dark:text-gray-400 mt-1">{t('library.subtitle')}</p>
            </div>

            <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    type="search"
                    placeholder={t('library.search')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md"
                />
            </div>
            
            <div className="space-y-10">
                {categories.map(category => {
                    const resourcesForCategory = filteredResources.filter(r => r.category === category);
                    if (resourcesForCategory.length === 0) return null;

                    const CategoryIcon = categoryIcons[category];
                    
                    return (
                        <section key={category}>
                            <div className="flex items-center gap-3 mb-4">
                                {CategoryIcon && <CategoryIcon className="w-6 h-6 text-blue-700 dark:text-blue-500" />}
                                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                                    {t(`library.category.${category}` as any)}
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {resourcesForCategory.map(resource => (
                                    <a 
                                        key={resource.id} 
                                        href={resource.link} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 transition-transform hover:scale-105 hover:shadow-lg"
                                    >
                                        <h4 className="font-bold text-lg text-gray-900 dark:text-gray-100">{t(resource.titleKey as any)}</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{t(resource.descriptionKey as any)}</p>
                                    </a>
                                ))}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

export default Library;