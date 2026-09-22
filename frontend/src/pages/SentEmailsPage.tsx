import React, { useState, useEffect } from 'react';
import { emailService } from '../services/emailService';
import { Email } from '../types';
import { EmailList } from '../components/emails/EmailList';
import { RefreshCw, Send } from 'lucide-react';

export const SentEmailsPage: React.FC = () => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSent = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await emailService.getSent();
      setEmails(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load sent emails');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSent();
  }, []);

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-emerald-600" />
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Sent Emails</h1>
          <span className="text-xs text-gray-500 font-medium">({emails.length})</span>
        </div>

        <button
          onClick={fetchSent}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors shadow-subtle disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sent List */}
      <EmailList
        emails={emails}
        loading={loading}
        error={error}
        type="sent"
        onRetry={fetchSent}
      />
    </div>
  );
};
