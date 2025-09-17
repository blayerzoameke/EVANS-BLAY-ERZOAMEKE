import React from 'react';

const Settings: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10">
      <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-6">Settings</h2>
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Auto-Generation</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Enable this to automatically parse your uploaded timetable images.
            </p>
            <div className="mt-3 flex items-center justify-between">
                <span>Auto-generate timetable from images</span>
                <label className="relative inline-flex items-center cursor-not-allowed">
                    <input type="checkbox" value="" className="sr-only peer" disabled />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                </label>
            </div>
             <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">(Feature coming soon)</p>
        </div>
        <p className="text-center text-gray-500 dark:text-gray-400 pt-4">More settings will be available here in the future.</p>
      </div>
    </div>
  );
};

export default Settings;