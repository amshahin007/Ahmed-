import React, { useState, useEffect, useRef } from 'react';

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
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  label, options, value, onChange, placeholder, required, disabled 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync internal search term with external value
  useEffect(() => {
    const selectedOption = options.find(o => o.id === value);
    if (selectedOption) {
      setSearchTerm(selectedOption.label);
    } else if (!value) {
      setSearchTerm('');
    }
  }, [value, options]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // If the current search term doesn't match a valid option label exactly, reset it to the selected value's label
        // or clear it if nothing is selected (enforcing selection from list)
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

  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (option.subLabel && option.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (option: Option) => {
    onChange(option.id);
    setSearchTerm(option.label);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
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