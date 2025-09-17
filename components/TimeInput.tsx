import React, { useState, useEffect } from 'react';

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minutes = ['00', '15', '30', '45'];
const periods = ['AM', 'PM'];

interface TimeInputProps {
  value: string;
  onChange: (newValue: string) => void;
}

const TimeInput: React.FC<TimeInputProps> = ({ value, onChange }) => {
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState('AM');

  useEffect(() => {
    // Parse the incoming value prop
    try {
        const [time, p] = value.split(' ');
        const [h, m] = time.split(':');
        if (hours.includes(h) && minutes.includes(m) && periods.includes(p)) {
            setHour(h);
            setMinute(m);
            setPeriod(p);
        }
    } catch(e) {
        // Handle potential parsing error if value is malformed
        console.error("Malformed time value:", value);
    }
  }, [value]);
  
  const handleChange = (part: 'h' | 'm' | 'p', val: string) => {
    let newHour = hour, newMinute = minute, newPeriod = period;
    if (part === 'h') newHour = val;
    if (part === 'm') newMinute = val;
    if (part === 'p') newPeriod = val;
    onChange(`${newHour}:${newMinute} ${newPeriod}`);
  };

  const selectClasses = "w-full appearance-none bg-transparent p-0 text-center focus:outline-none focus:ring-0 border-none text-gray-900 dark:text-gray-100";

  return (
    <div className="flex items-center gap-1.5 p-1 h-10 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-sm focus-within:ring-1 focus-within:ring-indigo-500 focus-within:border-indigo-500">
      <select 
        value={hour} 
        onChange={e => handleChange('h', e.target.value)} 
        // FIX: Replaced undefined 'time-select-style' with Tailwind classes
        className={selectClasses}
      >
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="text-gray-500 dark:text-gray-400 -ml-1">:</span>
      <select 
        value={minute} 
        onChange={e => handleChange('m', e.target.value)} 
        // FIX: Replaced undefined 'time-select-style' with Tailwind classes
        className={selectClasses}
      >
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select 
        value={period} 
        onChange={e => handleChange('p', e.target.value)} 
        // FIX: Replaced undefined 'time-select-style' with Tailwind classes
        className={selectClasses}
      >
        {periods.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
};

export default TimeInput;
