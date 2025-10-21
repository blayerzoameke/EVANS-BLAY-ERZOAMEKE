import React from 'react';

export const UserCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    {...props} 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M5.52 19c.64-2.2 1.84-4 3.22-5.26C10.07 12.5 11.24 12 12.5 12s2.43.5 3.76 1.74c1.38 1.26 2.58 3.06 3.22 5.26" />
    <circle cx="12.5" cy="8" r="4" />
    <circle cx="12.5" cy="12" r="10" />
  </svg>
);