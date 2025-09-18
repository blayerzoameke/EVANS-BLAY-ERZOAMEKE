import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  id: string;
}

const Switch: React.FC<SwitchProps> = ({ checked, onChange, disabled, id }) => (
  <input 
    id={id} 
    type="checkbox" 
    checked={checked} 
    onChange={onChange} 
    disabled={disabled} 
    className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 appearance-none checked:bg-teal-600 transition duration-200 ease-in-out relative cursor-pointer disabled:opacity-50
        after:content-[''] after:h-5 after:w-5 after:rounded-full after:bg-white after:absolute after:top-0.5 after:left-0.5 after:transition after:duration-200 checked:after:translate-x-5" 
  />
);

export default Switch;
