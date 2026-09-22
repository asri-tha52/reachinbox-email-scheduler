import React, { useState, useRef } from 'react';
import { Upload, X, CheckCircle2 } from 'lucide-react';

interface RecipientUploadProps {
  recipients: string[];
  onChange: (recipients: string[]) => void;
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const RecipientUpload: React.FC<RecipientUploadProps> = ({ recipients, onChange }) => {
  const [manualInput, setManualInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ total: number; valid: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseAndAddEmails = (rawText: string) => {
    const tokens = rawText.split(/[\r\n,;\t\s]+/);
    const existingSet = new Set(recipients.map((r) => r.toLowerCase()));
    const newValidEmails: string[] = [];
    let totalFound = 0;

    for (const token of tokens) {
      const clean = token.trim().toLowerCase();
      if (!clean) continue;
      totalFound++;
      if (EMAIL_REGEX.test(clean) && !existingSet.has(clean)) {
        existingSet.add(clean);
        newValidEmails.push(clean);
      }
    }

    if (newValidEmails.length > 0) {
      onChange([...recipients, ...newValidEmails]);
    }

    setUploadFeedback({ total: totalFound, valid: newValidEmails.length });
    setTimeout(() => setUploadFeedback(null), 5000);
  };

  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      alert('Please upload a .csv or .txt file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        parseAndAddEmails(content);
      }
    };
    reader.readAsText(file);
  };

  const handleManualKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = manualInput.trim().toLowerCase();
      if (val && EMAIL_REGEX.test(val)) {
        if (!recipients.includes(val)) {
          onChange([...recipients, val]);
        }
        setManualInput('');
      }
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    onChange(recipients.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAll = () => {
    onChange([]);
  };

  // Figma style: display first 3-5 chips and +N for the rest
  const DISPLAY_LIMIT = 4;
  const visibleRecipients = recipients.slice(0, DISPLAY_LIMIT);
  const remainingCount = recipients.length - DISPLAY_LIMIT;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
          To (Recipients) {recipients.length > 0 && <span className="text-emerald-700 normal-case font-normal font-mono">({recipients.length} total)</span>}
        </label>
        {recipients.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-[11px] text-gray-400 hover:text-red-600 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Recipient Chips Container */}
      <div className="min-h-[44px] p-2 bg-white border border-gray-200 rounded-md focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-colors flex flex-wrap items-center gap-1.5">
        {visibleRecipients.map((email, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-medium border border-gray-200"
          >
            <span className="truncate max-w-[160px]">{email}</span>
            <button
              type="button"
              onClick={() => removeRecipient(idx)}
              className="text-gray-400 hover:text-gray-700 focus:outline-none"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {remainingCount > 0 && (
          <span
            className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-xs font-semibold border border-emerald-200"
            title={`${remainingCount} more recipients queued`}
          >
            +{remainingCount} more
          </span>
        )}

        {/* Inline Manual Input */}
        <input
          type="text"
          placeholder={recipients.length === 0 ? 'Type email and press Enter, or upload a CSV/TXT list below...' : 'Add another...'}
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={handleManualKeyDown}
          className="flex-1 min-w-[200px] border-none p-1 text-xs text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
        />
      </div>

      {/* Upload Dropzone / Action */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed rounded-md p-3 text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs select-none ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50/50 text-gray-600'
        }`}
      >
        <Upload className="w-3.5 h-3.5 text-gray-400" />
        <span>
          Upload recipient list (<strong className="font-semibold text-gray-700">.csv</strong> or <strong className="font-semibold text-gray-700">.txt</strong>)
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
              e.target.value = '';
            }
          }}
        />
      </div>

      {/* Upload Feedback Banner */}
      {uploadFeedback && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
          <span>
            Parsed <strong>{uploadFeedback.total}</strong> entries, added <strong>{uploadFeedback.valid}</strong> unique valid emails!
          </span>
        </div>
      )}
    </div>
  );
};
