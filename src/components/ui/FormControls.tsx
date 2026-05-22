import React, { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, ChevronDown, Check } from 'lucide-react';
import { toArray } from '../../utils/arrayUtils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helperText?: string;
  error?: string;
}

export function Input({ label, helperText, error, className = '', type, ...props }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-content-primary">{label}</label>
      <div className="relative">
        <input
          type={inputType}
          className={`w-full px-3 py-2 rounded-lg border bg-input-bg text-input-text placeholder:text-content-muted text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all disabled:opacity-50 disabled:bg-muted ${
            error ? 'border-danger focus-visible:ring-danger focus-visible:border-danger' : 'border-input-border'
          } ${isPassword ? 'pr-10' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-content-secondary hover:text-content-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error ? (
        <span className="text-xs text-danger font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-content-secondary">{helperText}</span>
      ) : null}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  helperText?: string;
  error?: string;
  options: { label: string; value: string }[];
}

export function Select({ label, helperText, error, options, className = '', ...props }: SelectProps) {
  const safeOptions = toArray(options);
  
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-content-primary">{label}</label>
      <select
        className={`px-3 py-2 rounded-lg border bg-input-bg text-input-text text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all disabled:opacity-50 disabled:bg-muted ${
          error ? 'border-danger focus-visible:ring-danger focus-visible:border-danger' : 'border-input-border'
        } ${className}`}
        {...props}
      >
        {safeOptions.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-surface text-content-primary">
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-xs text-danger font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-content-secondary">{helperText}</span>
      ) : null}
    </div>
  );
}

interface ToggleProps {
  label: string;
  helperText?: string;
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
}

export function Toggle({ label, helperText, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className={`flex items-start gap-3 group ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <div className="relative flex items-center mt-0.5">
        <input type="checkbox" className="sr-only peer" checked={checked} onChange={onChange} disabled={disabled} />
        {/* Updated knob to use bg-primary-fg and shadow instead of surface/border to ensure it stays white and visible in dark mode */}
        <div className="w-9 h-5 bg-border peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-primary-fg after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-sm peer-checked:bg-primary group-hover:after:scale-95"></div>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-content-primary">{label}</span>
        {helperText && <span className="text-xs text-content-secondary">{helperText}</span>}
      </div>
    </label>
  );
}

export interface SearchableOption {
  label: string;
  value: string;
  description?: string;
}

interface SearchableSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  error?: string;
  helperText?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function SearchableSelect({ label, value, onChange, options, error, helperText, disabled, placeholder = 'Search...' }: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const safeOptions = toArray(options);
  const selectedOption = safeOptions.find(opt => opt.value === value);

  useEffect(() => {
    if (!isOpen) {
      setSearch(selectedOption ? selectedOption.label : '');
    }
  }, [isOpen, selectedOption]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = safeOptions.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase()) || 
    opt.value.toLowerCase().includes(search.toLowerCase())
  );

  const displayValue = isOpen ? search : (selectedOption ? selectedOption.label : (safeOptions.length === 0 ? value : ''));

  return (
    <div className="flex flex-col gap-1.5 relative" ref={wrapperRef}>
      <label className="text-sm font-medium text-content-primary">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full px-3 py-2 pr-10 rounded-lg border bg-input-bg text-input-text placeholder:text-content-muted text-sm focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all disabled:opacity-50 disabled:bg-muted ${
            error ? 'border-danger focus-visible:ring-danger focus-visible:border-danger' : 'border-input-border'
          }`}
        />
        <ChevronDown 
          size={16} 
          className={`absolute right-3 top-2.5 text-content-secondary transition-transform pointer-events-none ${isOpen ? 'rotate-180' : ''}`} 
        />
      </div>
      
      {isOpen && !disabled && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-surface border border-border rounded-lg shadow-lg py-1">
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-content-secondary text-center">No fields found</li>
          ) : (
            filteredOptions.map((opt) => (
              <li
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 text-sm cursor-pointer flex flex-col gap-0.5 transition-colors ${
                  opt.value === value ? 'bg-primary/10 text-primary' : 'text-content-primary hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{opt.label}</span>
                  {opt.value === value && <Check size={14} />}
                </div>
                {opt.description && (
                  <span className="text-xs text-content-secondary truncate">{opt.description}</span>
                )}
              </li>
            ))
          )}
        </ul>
      )}

      {error ? (
        <span className="text-xs text-danger font-medium">{error}</span>
      ) : helperText ? (
        <span className="text-xs text-content-secondary">{helperText}</span>
      ) : null}
    </div>
  );
}
