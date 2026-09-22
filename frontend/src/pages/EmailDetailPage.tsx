import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { emailService } from '../services/emailService';
import { Email } from '../types';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { ArrowLeft, ExternalLink, Clock, AlertCircle } from 'lucide-react';

export const EmailDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState<Email | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    emailService
      .getById(id)
      .then((data) => setEmail(data))
      .catch((err) => setError(err.message || 'Failed to load email details'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-16 flex flex-col items-center justify-center">
        <Spinner size="md" />
        <p className="mt-3 text-xs text-gray-500">Loading email details...</p>
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-xs text-red-600 font-medium mb-3">{error || 'Email not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-md"
        >
          Go Back
        </button>
      </div>
    );
  }

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(new Date(email.sentAt || email.scheduledAt));

  return (
    <div className="space-y-4">
      {/* Top Bar with Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-md hover:bg-gray-50 transition-colors shadow-subtle"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-3">
          {email.previewUrl && (
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-md transition-colors"
            >
              <span>View in Ethereal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <Badge status={email.status} />
        </div>
      </div>

      {/* Main Email Container */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-subtle overflow-hidden">
        {/* Email Header Info */}
        <div className="p-6 border-b border-gray-100 space-y-4">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">{email.subject}</h1>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-gray-600 pt-2 border-t border-gray-50">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-medium w-12">From:</span>
                <span className="font-semibold text-gray-900">
                  {email.sender?.name} &lt;{email.sender?.email}&gt;
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-medium w-12">To:</span>
                <span className="font-medium text-gray-800">{email.recipient}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400 self-start sm:self-auto">
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        {/* Email Body */}
        <div className="p-6">
          <div
            className="prose prose-sm max-w-none text-gray-800 text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: email.body }}
          />
        </div>

        {/* Technical Diagnostics Footer */}
        <div className="px-6 py-4 bg-gray-50/70 border-t border-gray-100 grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] text-gray-500 font-mono">
          <div>
            <span className="text-gray-400 block font-sans">IDEMPOTENCY KEY</span>
            <span className="truncate block" title={email.idempotencyKey}>
              {email.idempotencyKey.substring(0, 16)}...
            </span>
          </div>
          <div>
            <span className="text-gray-400 block font-sans">BULL JOB ID</span>
            <span>{email.bullJobId || 'Pending'}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-sans">ATTEMPTS</span>
            <span>{email.attempts}</span>
          </div>
          <div>
            <span className="text-gray-400 block font-sans">ERROR REASON</span>
            <span className={email.error ? 'text-red-500 font-semibold' : 'text-gray-400'}>
              {email.error || 'None'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
