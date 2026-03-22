import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  type?: 'text' | 'email' | 'number' | 'password' | 'textarea' | 'select' | 'date';
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  options?: { value: string | number; label: string }[];
  min?: number;
  step?: string;
  icon?: ReactNode;
  disabled?: boolean;
  error?: string;
}

export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  options,
  min,
  step,
  icon,
  disabled,
  error,
}: FormFieldProps) {
  const baseClass = `w-full px-4 py-3 border border-gray-100 rounded-2xl text-sm text-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-900/5 focus:border-gray-900 transition-all bg-gray-50/50 hover:bg-white placeholder:text-gray-400 ${error ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' : ''} ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''}`;
  const paddingLeft = icon ? 'pl-11' : 'px-4';

  const inputId = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="mb-4">
      <label htmlFor={inputId} className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-gray-900 transition-colors">
            {icon}
          </div>
        )}
        {type === 'textarea' ? (
          <textarea
            id={inputId}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            rows={3}
            className={`${baseClass} ${paddingLeft} resize-none`}
          />
        ) : type === 'select' ? (
          <select
            id={inputId}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={disabled}
            className={`${baseClass} ${paddingLeft} appearance-none`}
          >
            <option value="">{placeholder || `Select ${label}`}</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : (
          <input
            id={inputId}
            type={type}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            min={min}
            step={step}
            disabled={disabled}
            className={`${baseClass} ${paddingLeft}`}
          />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
