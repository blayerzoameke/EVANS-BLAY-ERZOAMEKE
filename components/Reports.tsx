
import React, { useState, useEffect } from 'react';
// FIX: Added .ts extension to import path.
import type { UserDetails } from '../types.ts';
import { useLanguage } from '../contexts/LanguageContext';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';

interface ReportsProps {
  userDetails: UserDetails | null;
}

const Reports: React.FC<ReportsProps> = ({ userDetails }) => {
  const { t } = useLanguage();
  const [category, setCategory] = useState('bug');
  const [description, setDescription] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [contactEmail, setContactEmail] = useState(userDetails?.email || '');
  const [contactWhatsApp, setContactWhatsApp] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (userDetails?.email) {
      setContactEmail(userDetails.email);
    }
  }, [userDetails]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `[EduBlay Report] - ${t(`reports.category.${category}` as any)}`;
    let body = `Report Details:\n`;
    body += `-----------------\n`;
    body += `Category: ${t(`reports.category.${category}` as any)}\n\n`;
    body += `Description:\n${description}\n\n`;
    body += `Contact Information:\n`;
    body += `Email: ${contactEmail}\n`;
    if (contactWhatsApp) {
        body += `WhatsApp: ${contactWhatsApp}\n`;
    }
    body += `-----------------\n\n`;

    if (attachment) {
        body += t('reports.mailto.attachNotice', { fileName: attachment.name });
    }

    const mailtoLink = `mailto:blayerzoameke@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;

    setSuccessMessage(t('reports.success'));
    // Reset form
    setCategory('bug');
    setDescription('');
    setAttachment(null);
    setContactWhatsApp('');
  };

  const inputClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="max-w-2xl mx-auto space-y-8">
        <div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('reports.title')}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1">{t('reports.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-6">
            <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reports.category')}</label>
                <select id="category" value={category} onChange={e => setCategory(e.target.value)} className={`${inputClasses} mt-1`}>
                    <option value="bug">{t('reports.category.bug')}</option>
                    <option value="feature">{t('reports.category.feature')}</option>
                    <option value="feedback">{t('reports.category.feedback')}</option>
                    <option value="other">{t('reports.category.other')}</option>
                </select>
            </div>

            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reports.description')}</label>
                <textarea
                    id="description"
                    rows={8}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    className={`${inputClasses} mt-1`}
                    placeholder={t('reports.descriptionPlaceholder')}
                    maxLength={1500}
                    required
                />
                <p className="text-xs text-right text-gray-500 dark:text-gray-400 mt-1">{description.length} / 1500</p>
            </div>

            <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reports.attachment')}</label>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('reports.attachmentDesc')}</p>
                 {!attachment ? (
                    <label htmlFor="attachment-upload" className="cursor-pointer flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                        <UploadIcon className="w-5 h-5" />
                        <span>Choose a file...</span>
                    </label>
                 ) : (
                    <div className="flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <span className="text-sm font-medium truncate">{attachment.name}</span>
                        <button type="button" onClick={() => setAttachment(null)} className="p-1 text-gray-500 hover:text-red-500"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                 )}
                 <input id="attachment-upload" type="file" className="hidden" onChange={handleFileChange} />
            </div>
            
             <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 border-t pt-4 mt-4 dark:border-gray-700">{t('reports.contactInfo')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label htmlFor="email" className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('reports.email')}</label>
                        <input type="email" id="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className={`${inputClasses} mt-1`} required/>
                    </div>
                     <div>
                        <label htmlFor="whatsapp" className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('reports.whatsapp')}</label>
                        <input type="tel" id="whatsapp" value={contactWhatsApp} onChange={e => setContactWhatsApp(e.target.value)} className={`${inputClasses} mt-1`}/>
                    </div>
                </div>
            </div>

            <button type="submit" className="w-full px-4 py-3 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-blue-400">
                {t('reports.submit')}
            </button>
            
            {successMessage && <p className="text-center text-green-600 dark:text-green-400 mt-4">{successMessage}</p>}
        </form>
    </div>
  );
};

export default Reports;