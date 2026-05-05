import { useRef } from 'react';
import { Image as ImageIcon, X, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from './Spinner';

export type ImageFileUploadProps = {
  inputId?: string;
  previewSrc: string | null;
  onFileChange: (file: File | null) => void;
  uploading?: boolean;
  disabled?: boolean;
  chooseButtonText?: string;
  className?: string;
  /** Layout: compact row (feed) vs stacked (profile) */
  variant?: 'compact' | 'stacked';
  /** Shows an extra control that closes the enclosing UI (parent should clear selection). */
  onCloseSection?: () => void;
};

export default function ImageFileUpload({
  inputId = 'image-file-input',
  previewSrc,
  onFileChange,
  uploading = false,
  disabled = false,
  chooseButtonText = 'Choose image',
  className = '',
  variant = 'compact',
  onCloseSection,
}: ImageFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    onFileChange(file);
  };

  const handleClear = () => {
    if (uploading) return;
    onFileChange(null);
  };

  const busy = disabled || uploading;

  return (
    <div className={className}>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        onChange={handleInputChange}
      />

      {variant === 'compact' && (
        <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
          <ImageIcon size={16} className="text-slate-400 flex-shrink-0" />
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="flex-1 text-left text-sm text-slate-700 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed font-medium truncate"
          >
            {uploading ? 'Uploading…' : previewSrc ? 'Change image' : chooseButtonText}
          </button>
          {uploading && <Spinner size="sm" />}
          {onCloseSection && (
            <button
              type="button"
              onClick={onCloseSection}
              className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {variant === 'stacked' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={pickFile}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Spinner size="sm" />
                Uploading…
              </>
            ) : (
              <>
                <Upload size={16} className="text-slate-500" />
                {previewSrc ? 'Change photo' : chooseButtonText}
              </>
            )}
          </button>
        </div>
      )}

      {previewSrc && (
        <div className={`relative ${variant === 'compact' ? 'mt-2' : 'mt-3'}`}>
          <img
            src={previewSrc}
            alt="Selected image preview"
            className="w-full rounded-xl object-cover max-h-48 border border-slate-200 bg-slate-50"
          />
          {uploading && (
            <div className="absolute inset-0 rounded-xl bg-white/70 flex items-center justify-center">
              <Spinner size="md" />
            </div>
          )}
          {!uploading && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
              aria-label="Remove preview"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
