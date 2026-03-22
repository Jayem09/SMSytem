import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface BaseInputProps {
  label?: string;
  error?: string;
  success?: boolean;
  hint?: string;
  required?: boolean;
}

type InputProps = BaseInputProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaProps = BaseInputProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
type SelectProps = BaseInputProps & SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string | number; label: string }[] };

const InputWrapper = ({ 
  children, 
  label, 
  error, 
  success, 
  hint, 
  required 
}: { 
  children: React.ReactNode; 
  label?: string; 
  error?: string; 
  success?: boolean;
  hint?: string;
  required?: boolean;
}) => {
  const inputId = `input-${label?.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).slice(2)}`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-xs font-semibold text-gray-700 uppercase tracking-wider"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {children}
        {success && !error && (
          <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
        )}
        {error && (
          <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
        )}
      </div>
      {error && <p className="text-xs text-red-600 flex items-center gap-1">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  );
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, success, hint, required, className = '', ...props }, ref) => {
    const inputId = `input-${label?.toLowerCase().replace(/\s+/g, '-') || ''}`;
    
    return (
      <InputWrapper label={label} error={error} success={success} hint={hint} required={required}>
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3 rounded-xl border text-sm text-gray-900 
            bg-white transition-all duration-200
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : success 
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                : 'border-gray-200 hover:border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20'
            }
            ${className}
          `}
          {...props}
        />
      </InputWrapper>
    );
  }
);

Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, success, hint, required, className = '', ...props }, ref) => {
    const inputId = `textarea-${label?.toLowerCase().replace(/\s+/g, '-') || ''}`;
    
    return (
      <InputWrapper label={label} error={error} success={success} hint={hint} required={required}>
        <textarea
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3 rounded-xl border text-sm text-gray-900 
            bg-white transition-all duration-200 resize-none
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-offset-0
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : success 
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                : 'border-gray-200 hover:border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20'
            }
            ${className}
          `}
          {...props}
        />
      </InputWrapper>
    );
  }
);

Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, success, hint, required, options, className = '', ...props }, ref) => {
    const inputId = `select-${label?.toLowerCase().replace(/\s+/g, '-') || ''}`;
    
    return (
      <InputWrapper label={label} error={error} success={success} hint={hint} required={required}>
        <select
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-3 rounded-xl border text-sm text-gray-900 
            bg-white transition-all duration-200 appearance-none
            bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%236b7280%22%3E%3Cpath%20d%3D%22M4.293%206.293a1%201%200%20011.414-1.414L8%207.586l2.293-2.293a1%201%200%200111.414%201.414l-3%203a1%201%200%2001-1.414%200l-3-3a1%201%200%20010-1.414z%22%2F%3E%3C%2Fsvg%3E')]
            bg-[length:16px] bg-[right_12px_center] bg-no-repeat
            disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
            ${error 
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' 
              : success 
                ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                : 'border-gray-200 hover:border-gray-300 focus:border-indigo-500 focus:ring-indigo-500/20'
            }
            ${className}
          `}
          {...props}
        >
          <option value="">Select {label || 'an option'}</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </InputWrapper>
    );
  }
);

Select.displayName = 'Select';
