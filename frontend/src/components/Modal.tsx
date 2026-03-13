import { type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, maxWidth, wide }: ModalProps) {
  const width = maxWidth || (wide ? 'max-w-4xl' : 'max-w-md');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {}
      <div className={`relative bg-white border border-gray-200 rounded-lg shadow-lg w-full ${width} mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg cursor-pointer"
          >
            x
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
