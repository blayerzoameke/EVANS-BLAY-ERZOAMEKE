import React from 'react';

const About: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-6 md:p-10 text-center">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">About EDU. Timetable Planner</h2>
      <p className="text-gray-600 dark:text-gray-400">
        Version 1.0.0
      </p>
      <p className="text-gray-600 dark:text-gray-400 mt-4">
        This application is designed to help students organize their academic lives with an intelligent planner.
      </p>
       <p className="text-gray-600 dark:text-gray-400 mt-2">
        Created with passion to make learning more structured and productive.
      </p>
    </div>
  );
};

export default About;