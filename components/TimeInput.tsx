import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ClockIcon } from './icons/ClockIcon';

const generateTimeOptions = () => {
    const times = [];
    for (let i = 0; i < 24 * 4; i++) { // 4 intervals per hour
        const totalMinutes = i * 15;
        const hours24 = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const period = hours24 >= 12 ? 'PM' : 'AM';
        let hours12 = hours24 % 12;
        if (hours12 === 0) {
            hours12 = 12;
        }
        times.push(`${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`);
    }
    return times;
};

interface TimeInputProps {
  value: string;
  onChange: (newValue: string) => void;
  id?: string;
  disabled?: boolean;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange, id, disabled = false }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const timeOptions = useMemo(() => generateTimeOptions().map(t => ({ name: t })), []);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleSelectOption = (option: { name: string }) => {
    onChange(option.name);
    setInputValue(option.name);
    setIsOpen(false);
  };
  
  const filteredOptions = timeOptions.filter(option =>
    option.name.toLowerCase().includes(inputValue.toLowerCase())
  );
  
  const baseClasses = "w-full h-10 pl-4 pr-10 py-2 bg-slate-50 dark:bg-slate-700/50 border-2 border-slate-200 dark:border-slate-600 rounded-lg shadow-inner placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm";
  const disabledClasses = "disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed";

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        id={id}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder="HH:MM AM/PM"
        autoComplete="off"
        className={`${baseClasses} ${disabledClasses}`}
        disabled={disabled}
      />
      <ClockIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
      {isOpen && !disabled && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <li
                key={index}
                onClick={() => handleSelectOption(option)}
                className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-200"
              >
                {option.name}
              </li>
            ))
          ) : (
            <li className="px-3 py-2 text-gray-500">No matching times</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default TimeInput;
