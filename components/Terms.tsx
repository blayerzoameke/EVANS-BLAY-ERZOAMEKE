
// FIX: Implement Terms component to resolve module error.
import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const Terms: React.FC = () => {
    const { t } = useLanguage();

    return (
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2 text-center">{t('terms.title')}</h2>
            <p className="text-center text-gray-500 dark:text-gray-400 mb-8">{t('terms.subtitle')}</p>

            <nav className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border dark:border-gray-700">
                <h3 className="font-semibold mb-2">{t('terms.toc')}</h3>
                <ul className="list-disc list-inside space-y-1">
                    <li><a href="#tos" className="text-blue-700 dark:text-blue-500 hover:underline">{t('terms.tos')}</a></li>
                    <li><a href="#privacy" className="text-blue-700 dark:text-blue-500 hover:underline">{t('terms.privacy')}</a></li>
                </ul>
            </nav>

            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-8">
                <section id="tos">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('terms.tos.title')}</h3>
                    <p>{t('terms.tos.body')}</p>
                    <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum imperdiet. Duis sagittis ipsum. Praesent mauris. Fusce nec tellus sed augue semper porta. Mauris massa. Vestibulum lacinia arcu eget nulla.</p>
                </section>
                <section id="privacy">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-white">{t('terms.privacy.title')}</h3>
                    <p>{t('terms.privacy.body')}</p>
                    <p>Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Curabitur sodales ligula in libero. Sed dignissim lacinia nunc. Curabitur tortor. Pellentesque nibh. Aenean quam. In scelerisque sem at dolor. Maecenas mattis. Sed convallis tristique sem. Proin ut ligula vel nunc egestas porttitor.</p>
                </section>
            </div>
        </div>
    );
};

export default Terms;
