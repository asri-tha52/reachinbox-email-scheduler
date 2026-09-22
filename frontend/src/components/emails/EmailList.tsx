import React from 'react';
import { Email } from '../../types';
import { EmailRow } from './EmailRow';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';
import { useNavigate } from 'react-router-dom';

interface EmailListProps {
  emails: Email[];
  loading: boolean;
  error?: string | null;
  type: 'scheduled' | 'sent';
  onRetry?: () => void;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  loading,
  error,
  type,
  onRetry,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 flex flex-col items-center justify-center">
        <Spinner size="md" />
        <p className="mt-3 text-xs text-gray-500">Loading {type} emails...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-8 text-center">
        <p className="text-xs text-red-600 font-medium mb-3">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <EmptyState
        title={type === 'scheduled' ? 'No scheduled emails' : 'No sent emails yet'}
        description={
          type === 'scheduled'
            ? 'Schedule your first email or bulk campaign to see them here.'
            : 'Emails that have been processed and dispatched will appear here.'
        }
        actionLabel={type === 'scheduled' ? 'Compose New Email' : undefined}
        onAction={type === 'scheduled' ? () => navigate('/dashboard/compose') : undefined}
      />
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-subtle overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/70 border-b border-gray-200 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <div className="flex items-center gap-6 flex-1 min-w-0 pr-4">
          <span className="w-44">Recipient</span>
          <span>Subject & Preview</span>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <span className="w-20 text-center">Status</span>
          <span className="w-28 text-right">{type === 'scheduled' ? 'Scheduled For' : 'Sent At'}</span>
        </div>
      </div>

      {/* List Items */}
      <div className="divide-y divide-gray-100">
        {emails.map((email) => (
          <EmailRow key={email.id} email={email} type={type} />
        ))}
      </div>
    </div>
  );
};
