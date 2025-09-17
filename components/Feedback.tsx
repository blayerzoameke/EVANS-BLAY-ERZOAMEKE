import React from 'react';

const Feedback: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10 text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Feedback</h2>
      <p className="text-gray-600 dark:text-gray-400">
        This section is currently under construction.
      </p>
      <p className="text-gray-600 dark:text-gray-400 mt-2">
        Soon, you'll be able to provide feedback to help us improve the app!
      </p>
    </div>
  );
};

export default Feedback;