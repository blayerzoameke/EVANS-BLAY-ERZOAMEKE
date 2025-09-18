import React from 'react';

export const ExportIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M12 11v8" />
    <path d="m16 15-4 4-4-4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
  </svg>
);
