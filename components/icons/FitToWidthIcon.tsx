import React from 'react';

export const FitToWidthIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M4 12h16" />
    <path d="m4 6 2.5 6L4 18" />
    <path d="m20 6-2.5 6L20 18" />
    <rect x="8" y="4" width="8" height="16" rx="1" />
  </svg>
);