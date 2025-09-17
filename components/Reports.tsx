
import React from 'react';
import type { UserDetails } from '../types';

// FIX: Added props to the component to resolve type error in App.tsx
interface ReportsProps {
  userDetails: UserDetails | null;
}

const Reports: React.FC<ReportsProps> = ({ userDetails }) => {
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10 text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Reports</h2>
      <p className="text-gray-600 dark:text-gray-400">
        This section is currently under construction.
      </p>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Detailed reports and analytics about your study habits will be available here soon!
      </p>
    </div>
  );
};

export default Reports;
