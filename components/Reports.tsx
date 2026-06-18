import React, { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { UserDetails, ReportDraft, Toast } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { UploadIcon } from './icons/UploadIcon';
import { CloseIcon } from './icons/CloseIcon';

interface ReportsProps {
  userDetails: UserDetails | null;
  reportDraft: ReportDraft;
  setReportDraft: React.Dispatch<React.SetStateAction<ReportDraft>>;
  addToast: (message: string, type: Toast['type']) => void;
}

const Reports: React.FC<ReportsProps> = ({ userDetails, reportDraft, setReportDraft, addToast }) => {
  const { t } = useLanguage();
  const [successMessage, setSuccessMessage] = useState('');
  const { category, description, attachment, contactEmail, contactWhatsApp } = reportDraft;

  useEffect(() => {
    if (userDetails?.email && !contactEmail) {
      setReportDraft(prev => ({ ...prev, contactEmail: userDetails.email || '' }));
    }
  }, [userDetails, contactEmail, setReportDraft]);

  const updateDraft = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => {
      setReportDraft(prev => ({...prev, [key]: value}));
  };

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections?.length > 0) {
        addToast(t('toasts.invalidImageFile') || 'Unsupported file type.', 'error');
        return;
    }

    const file = acceptedFiles[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) { // 25MB limit
        addToast(t('toasts.fileSizeTooLarge', { fileName: file.name, size: 25 }), 'error');
        return;
      }
      updateDraft('attachment', file);
    }
  }, [addToast, t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false } as any);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `[EduBlay Report] - ${t(`reports.category.${category}` as any)}`;
    let body = `Report Details:\n-----------------\n`;
    body += `Category: ${t(`reports.category.${category}` as any)}\n\n`;
    body += `Description:\n${description}\n\n`;
    body += `Contact Information:\nEmail: ${contactEmail}\n`;
    if (contactWhatsApp) body += `WhatsApp: ${contactWhatsApp}\n`;
    body += `-----------------\n\n`;
    if (attachment) body += t('reports.mailto.attachNotice', { fileName: attachment.name });

    window.location.href = `mailto:support@edublay.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSuccessMessage(t('reports.success'));
    setReportDraft({ category: 'bug', description: '', attachment: null, contactEmail: userDetails?.email || '', contactWhatsApp: '' });
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
                <select id="category" value={category} onChange={e => updateDraft('category', e.target.value)} className={`${inputClasses} mt-1`}>
                    <option value="bug">{t('reports.category.bug')}</option>
                    <option value="feature">{t('reports.category.feature')}</option>
                    <option value="feedback">{t('reports.category.feedback')}</option>
                    <option value="other">{t('reports.category.other')}</option>
                </select>
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reports.description')}</label>
                <textarea id="description" rows={8} value={description} onChange={e => updateDraft('description', e.target.value)} className={`${inputClasses} mt-1`} placeholder={t('reports.descriptionPlaceholder')} maxLength={1500} required />
                <p className="text-xs text-right text-gray-500 dark:text-gray-400 mt-1">{description.length} / 1500</p>
            </div>
            <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('reports.attachment')}</label>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('reports.attachmentDesc')}</p>
                 {!attachment ? (
                    <div {...getRootProps()} className={`mt-1 group p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isDragActive ? 'border-green-600 bg-green-100 dark:bg-green-900/30' : 'border-gray-300 dark:border-gray-600'} hover:border-green-500 dark:hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20`}>
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400"><UploadIcon className="w-10 h-10 mb-3" /><p className="font-semibold">{t('reports.uploadPrompt')}</p></div>
                    </div>
                 ) : (
                    <div className="mt-1 flex items-center justify-between p-2 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <span className="text-sm font-medium truncate">{attachment.name}</span>
                        <button type="button" onClick={() => updateDraft('attachment', null)} className="p-1 text-gray-500 hover:text-red-500"><CloseIcon className="w-4 h-4" /></button>
                    </div>
                 )}
            </div>
             <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 border-t pt-4 mt-4 dark:border-gray-700">{t('reports.contactInfo')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div><label htmlFor="email" className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('reports.email')}</label><input type="email" id="email" value={contactEmail} onChange={e => updateDraft('contactEmail', e.target.value)} className={`${inputClasses} mt-1`} required/></div>
                    <div><label htmlFor="whatsapp" className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('reports.whatsapp')}</label><input type="tel" id="whatsapp" value={contactWhatsApp} onChange={e => updateDraft('contactWhatsApp', e.target.value)} className={`${inputClasses} mt-1`}/></div>
                </div>
            </div>
            <button type="submit" className="w-full px-4 py-3 font-semibold text-white bg-blue-700 rounded-md hover:bg-blue-800 disabled:bg-blue-400">{t('reports.submit')}</button>
            {successMessage && <p className="text-center text-green-600 dark:text-green-400 mt-4">{successMessage}</p>}
        </form>
    </div>
  );
};

export default Reports;