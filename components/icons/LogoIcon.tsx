
import React from 'react';

export const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <g fill="currentColor">
      {/* Calendar Body */}
      <path d="M19,4H18V2H16V4H8V2H6V4H5C3.89,4,3,4.9,3,6V20A2,2,0,0,0,5,22H15.1C14.41,21.14,14,20.12,14,19C14,15.69,16.69,13,20,13C20.34,13,20.68,13.05,21,13.13V6C21,4.9,20.1,4,19,4Z"></path>
      {/* Grid dots. We use a contrasting color for visibility. Since we can't use CSS, we'll use a path with a hole (evenodd fill-rule) */}
      <path fillRule="evenodd" d="M7 11h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2zM7 15h2v2H7v-2zm4 0h2v2h-2v-2z" />
      {/* Clock */}
      <path d="M20,15C17.24,15,15,17.24,15,20C15,22.76,17.24,25,20,25C22.76,25,25,22.76,25,20C25,17.24,22.76,15,20,15M20.5,20.25L18,21.5V18H19.5V19.9L21.5,18.9L22,19.6L20.5,20.25Z"></path>
    </g>
  </svg>
);