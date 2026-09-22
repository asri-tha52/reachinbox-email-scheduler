import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Email } from '../../types';
import { Badge } from '../ui/Badge';
import { ExternalLink } from 'lucide-react';

interface EmailRowProps {
  email: Email;
  type?: 'scheduled' | 'sent';
}

export const EmailRow: React.FC<EmailRowProps> = ({ email, type = 'scheduled' }) => {
  const navigate = useNavigate();

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(type === 'sent' && email.sentAt ? email.sentAt : email.scheduledAt));

  // Strip HTML tags for preview snippet
  const previewText = email.body ? email.body.replace(/<[^>]*>?/gm, '').substring(0, 75) : '';

  return (
    <div
      onClick={() => navigate(`/dashboard/email/${email.id}`)}
      className="group flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50/80 
        border-b border-gray-100 cursor-pointer transition-colors text-xs select-none"
    >
      {/* Left: Recipient & Preview */}
      <div className="flex items-center gap-6 flex-1 min-w-0 pr-4">
        {/* Recipient */}
        <span className="font-semibold text-gray-900 w-44 truncate">{email.recipient}</span>

        {/* Subject & Preview */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-gray-800 truncate">{email.subject}</span>
          {previewText && (
            <>
              <span className="text-gray-300">-</span>
              <span className="text-gray-500 truncate font-normal">{previewText}</span>
            </>
          )}
        </div>
      </div>

      {/* Right: Preview link (if available) + Status Badge + Timestamp */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {email.previewUrl && (
          <a
            href={email.previewUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[11px] text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded"
            title="View live Ethereal test email"
          >
            <span>Preview</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <Badge status={email.status} />

        <span className="text-[11px] text-gray-500 w-28 text-right font-medium">{formattedDate}</span>
      </div>
    </div>
  );
};
