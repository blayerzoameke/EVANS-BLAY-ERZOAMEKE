import React from 'react';

export const ToolsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M3 21h4l13-13a2.12 2.12 0 0 0-3-3L4 17v4Z" />
    <path d="m14.5 5.5 4 4" />
    <path d="M5 12s2.5-1.5 5-1.5 5 1.5 5 1.5" />
    <path d="M12 19s-2.5 1.5-5 1.5-5-1.5-5-1.5" />
  </svg>
);
