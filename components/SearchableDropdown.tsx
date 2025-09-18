import React, { useState, useRef, useEffect } from 'react';

interface SearchableDropdownProps {
  options: { name: string }[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
}

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({ options, placeholder, value, onChange, id, name, disabled = false }) => {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    onChange(newValue); // Update parent state on every keystroke for custom entries
    setIsOpen(true);
  };

  const handleSelectOption = (option: { name: string }) => {
    onChange(option.name);
    setInputValue(option.name);
    setIsOpen(false);
  };
  
  const filteredOptions = options.filter(option =>
    option.name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const baseClasses = "block w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm";
  const disabledClasses = "disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed";

  return (
    <div className="relative" ref={dropdownRef}>
      <input
        id={id}
        name={name}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        className={`${baseClasses} ${disabledClasses}`}
        disabled={disabled}
      />
      {isOpen && !disabled && (
        <ul className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
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
            <li className="px-3 py-2 text-gray-500">No results found for "{inputValue}"</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableDropdown;