
import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  label, options, value, onChange, placeholder, required, disabled, inputRef, onKeyDown 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync internal search term with external value
  // Using a ref to prevent cyclic dependencies if options is not memoized in parent
  useEffect(() => {
    if (value) {
      const selectedOption = options.find(o => o.id === value);
      if (selectedOption) {
        setSearchTerm(selectedOption.label);
      }
    } else {
        // Only clear if user hasn't typed anything newly (this is a tricky balance)
        // For now, if value is empty, we assume reset
        if (!isOpen) setSearchTerm('');
    }
  }, [value, options, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        const selectedOption = options.find(o => o.id === value);
         if (selectedOption) {
           setSearchTerm(selectedOption.label);
         } else {
           setSearchTerm('');
         }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value, options]);

  // Optimize Filtering:
  // 1. Limit results to 50 to prevent DOM freeze with large lists
  // 2. Memoize to prevent recalc on every render if options haven't changed
  const filteredOptions = useMemo(() => {
     if (!isOpen && !searchTerm) return []; // Don't filter if closed and empty

     const lowerSearch = searchTerm.toLowerCase();
     let count = 0;
     const limit = 50;
     const result = [];

     for (const option of options) {
         if (
             option.label.toLowerCase().includes(lowerSearch) || 
             (option.subLabel && option.subLabel.toLowerCase().includes(lowerSearch))
         ) {
             result.push(option);
             count++;
             if (count >= limit) break;
         }
     }
     return result;
  }, [options, searchTerm, isOpen]);

  const handleSelect = (option: Option) => {
    onChange(option.id);
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isOpen) {
       // Auto-select logic for scanners
       // Exact match first
       const exactMatch = filteredOptions.find(o => o.label.toLowerCase() === searchTerm.toLowerCase());
       
       if (exactMatch) {
          handleSelect(exactMatch);
       } else if (filteredOptions.length === 1) {
          handleSelect(filteredOptions[0]);
       } else if (filteredOptions.length > 0) {
          // Select the first one if present
          handleSelect(filteredOptions[0]);
       }
    }
    
    if (onKeyDown) onKeyDown(e);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
            if (value) onChange(''); // Clear value while typing new search
          }}
          onFocus={() => !disabled && setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        {/* Chevron icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            <ul className="py-1">
              {filteredOptions.map((option) => (
                <li
                  key={option.id}
                  onClick={() => handleSelect(option)}
                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-gray-700 flex flex-col border-b border-gray-50 last:border-0"
                >
                  <span className="font-medium">{option.label}</span>
                  {option.subLabel && <span className="text-xs text-gray-400">{option.subLabel}</span>}
                </li>
              ))}
              {/* Show warning if results are truncated (we don't know total count here efficiently without recalc, but 50 is the limit) */}
              {filteredOptions.length === 50 && (
                  <li className="px-4 py-2 text-xs text-gray-400 italic text-center bg-gray-50">
                      Results limited. Keep typing to search...
                  </li>
              )}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
