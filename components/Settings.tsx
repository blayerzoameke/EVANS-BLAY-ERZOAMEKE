
import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ExportIcon } from './icons/ExportIcon';
import { ImportIcon } from './icons/ImportIcon';
import { TrashIcon } from './icons/TrashIcon';
import { DocumentIcon } from './icons/DocumentIcon';
import ConfirmationModal from './ConfirmationModal';
import { storageService, getCurrentUser } from '../services/authService';
import type { Toast, UserDetails, SmartPlan, StoredPlan, Note, TrackedSession, UploadedMaterialInfo, View } from '../types';

// Helper functions for PDF generation
const renderUserDetails = (details: UserDetails | null): string => {
    if (!details) return '';
    const sanitize = (str: string | undefined) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'N/A';
    return `
        <div class="section">
            <h3>User Profile</h3>
            <ul>
                <li><strong>Name:</strong> ${sanitize(details.name)}</li>
                <li><strong>Email:</strong> ${sanitize(details.email)}</li>
                <li><strong>Educational Level:</strong> ${sanitize(details.educationalLevel)}</li>
                <li><strong>Institution:</strong> ${sanitize(details.institution)}</li>
                <li><strong>Country:</strong> ${sanitize(details.country)}</li>
                <li><strong>Programme of Study:</strong> ${sanitize(details.programmeOfStudy)}</li>
            </ul>
        </div>
    `;
};

const renderPlan = (plan: SmartPlan, title: string): string => {
    if (!plan || plan.length === 0) return '';
    const sanitize = (str: string | undefined) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    let planHtml = `<div class="section"><h3>${title}</h3>`;
    
    plan.forEach(dayPlan => {
        planHtml += `<h4>${dayPlan.day}</h4>`;
        if (dayPlan.slots.length > 0) {
            planHtml += `
                <table class="plan-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Activity</th>
                            <th>Type</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${dayPlan.slots.map(slot => `
                            <tr>
                                <td>${sanitize(slot.startTime)} - ${sanitize(slot.endTime)}</td>
                                <td>${sanitize(slot.activity)}</td>
                                <td>${sanitize(slot.type)}</td>
                                <td>${sanitize(slot.location)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            planHtml += `<p>No activities scheduled.</p>`;
        }
    });

    planHtml += `</div>`;
    return planHtml;
};

const renderNotes = (notes: Note[] | null): string => {
    if (!notes || notes.length === 0) return '';
    const sanitize = (str: string | undefined) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
    
    let notesHtml = `<div class="section"><h3>Notes</h3>`;
    notes.forEach(note => {
        notesHtml += `
            <div class="note">
                <h4>${sanitize(note.title)}</h4>
                <p class="note-meta"><strong>Subject:</strong> ${sanitize(note.subject)} | <strong>Created:</strong> ${new Date(note.createdAt).toLocaleString()}</p>
                <div class="note-content"><pre>${sanitize(note.content)}</pre></div>
            </div>
        `;
    });
    notesHtml += `</div>`;
    return notesHtml;
};

const renderTrackedData = (data: TrackedSession[] | null): string => {
    if (!data || data.length === 0) return '';
    const sanitize = (str: string | undefined) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    return `
        <div class="section">
            <h3>Tracked Study Sessions</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Duration (minutes)</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(session => `
                        <tr>
                            <td>${sanitize(session.date)}</td>
                            <td>${sanitize(session.subject)}</td>
                            <td>${session.durationMinutes}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

const renderTrackedDataForPrint = (data: TrackedSession[] | null): string => {
    if (!data || data.length === 0) return '';
    const sanitize = (str: string | undefined) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

    return `
        <div class="section">
            <h3>Tracked Study Sessions</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Duration (minutes)</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(session => `
                        <tr>
                            <td>${sanitize(session.date)}</td>
                            <td>${sanitize(session.subject)}</td>
                            <td>${session.durationMinutes}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};

const renderUploadedMaterials = (materials: UploadedMaterialInfo[] | null): string => {
    if (!materials || materials.length === 0) return '';
    const sanitize = (str: string | undefined) => str ? str.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return `
        <div class="section">
            <h3>Uploaded Materials</h3>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Size</th>
                        <th>Context</th>
                    </tr>
                </thead>
                <tbody>
                    ${materials.map(mat => `
                        <tr>
                            <td>${sanitize(mat.name)}</td>
                            <td>${sanitize(mat.type)}</td>
                            <td>${formatBytes(mat.size)}</td>
                            <td>${sanitize(mat.context)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
};


interface SettingsProps {
    addToast: (message: string, type: Toast['type']) => void;
    handleLogout: () => void;
    userDetails: UserDetails | null;
    setShowUpgradeModal: (show: boolean, featureTitle: string) => void;
}

const Settings: React.FC<SettingsProps> = ({ addToast, handleLogout, userDetails, setShowUpgradeModal }) => {
    const { t } = useLanguage();
    const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
    const importInputRef = React.useRef<HTMLInputElement>(null);

    // FIX: Optimized handlePrintReport to use existing props and async storage service properly.
    const handlePrintReport = async () => {
        const currentUser = userDetails;
        if (!currentUser || !currentUser.email) {
            addToast("Could not find user data to export.", 'error');
            return;
        }

        const emailKey = `eb_u_data_${currentUser.email}`;
        const userData = await storageService.loadItem<any>(emailKey);
        
        if (!userData) {
            addToast("No data found to export for the current user.", 'info');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>EduBlay Data Export for ${currentUser.name}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 20px; }
                    h1, h2, h3, h4 { color: #0284c7; }
                    h1 { text-align: center; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 40px; }
                    h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                    .section { margin-bottom: 30px; page-break-inside: avoid; }
                    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9em; }
                    th { background-color: #f2f2f2; }
                    .note { border: 1px solid #eee; padding: 15px; margin-top: 15px; border-radius: 5px; background: #f9f9f9; }
                    .note h4 { margin-top: 0; }
                    .note-meta { font-size: 0.8em; color: #666; margin-bottom: 10px; }
                    .note-content pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
                    ul { padding-left: 20px; }
                    li { margin-bottom: 5px; }
                    .print-header { display: none; }
                    @page {
                        size: A4;
                        margin: 1in;
                    }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                        .print-header { display: block; position: fixed; top: 0; text-align: center; width: 100%; font-size: 0.8em; color: #888; }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">EduBlay Data Export | ${new Date().toLocaleDateString()}</div>
                <h1>EduBlay Data Export</h1>
                <h2>${currentUser.name} (${currentUser.email})</h2>
                
                ${renderUserDetails(userData.userDetails)}
                ${renderPlan(userData.smartPlan, 'Current Smart Plan')}
                ${(userData.savedTimetables || []).map((p: StoredPlan) => renderPlan(p.plan, `Saved Plan: ${p.name}`)).join('')}
                ${renderNotes(userData.notes)}
                ${renderTrackedDataForPrint(userData.trackedData)}
                ${renderUploadedMaterials(userData.uploadedMaterials)}

                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 500); // Small delay to ensure styles are applied
                    }
                </script>
            </body>
            </html>
        `;

        const exportWindow = window.open('', '_blank');
        if (exportWindow) {
            exportWindow.document.write(htmlContent);
            exportWindow.document.close();
        } else {
            addToast("Could not open a new window to print. Please check your browser's pop-up settings.", 'error');
        }
    };
    
    const handleExportData = () => {
        try {
            storageService.exportAllData();
            addToast(t('settings.exportSuccess' as any), 'success');
        } catch (e) {
            console.error(e);
            addToast('Data export failed.', 'error');
        }
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };
    
    const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                await storageService.importAllData(file);
                addToast(t('settings.importSuccess'), 'success');
                setTimeout(() => window.location.reload(), 1000);
            } catch (error: any) {
                addToast(error.message || t('settings.importError'), 'error');
            }
        }
    };

    const handleConfirmClearData = () => {
        storageService.clearAllData();
        handleLogout();
    };
    
    return (
        <>
            <div className="max-w-2xl mx-auto space-y-8">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-white">{t('settings.title')}</h2>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">{t('settings.subtitle')}</p>
                </div>

                <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow space-y-4">
                    <h3 className="text-lg font-semibold">{t('settings.data.title')}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.data.desc')}</p>
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button onClick={handlePrintReport} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 border border-transparent rounded-md shadow-sm hover:bg-sky-700">
                            <DocumentIcon className="w-4 h-4" /> {t('settings.data.printReport' as any)}
                        </button>
                        <button onClick={handleExportData} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700">
                            <ExportIcon className="w-4 h-4" /> {t('settings.data.export' as any)}
                        </button>
                        <button onClick={handleImportClick} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md shadow-sm hover:bg-green-700">
                            <ImportIcon className="w-4 h-4" /> {t('settings.data.import')}
                        </button>
                        <input
                            type="file"
                            ref={importInputRef}
                            onChange={handleFileImport}
                            className="hidden"
                            accept="application/json"
                        />
                    </div>
                    <div className="pt-4 mt-4 border-t dark:border-gray-700">
                        <button onClick={() => setShowClearDataConfirm(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700">
                            <TrashIcon className="w-4 h-4" /> {t('settings.data.clear')}
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showClearDataConfirm}
                onClose={() => setShowClearDataConfirm(false)}
                onConfirm={handleConfirmClearData}
                title={t('confirmation.resetApp.title')}
                message={t('confirmation.resetApp.message')}
                confirmText={t('common.reset')}
                confirmColor="red"
            />
        </>
    );
};

export default Settings;
