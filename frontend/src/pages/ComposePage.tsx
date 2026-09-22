import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailService } from '../services/emailService';
import { RecipientUpload } from '../components/compose/RecipientUpload';
import { EmailEditor } from '../components/compose/EmailEditor';
import { ScheduleControls } from '../components/compose/ScheduleControls';
import { Button } from '../components/ui/Button';
import { ArrowLeft, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export const ComposePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedSenderId, setSelectedSenderId] = useState<string>('');

  // Scheduling State
  // Default startTime: now formatted for datetime-local (YYYY-MM-DDTHH:mm)
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 1); // 1 minute from now default
    return d.toISOString().slice(0, 16);
  });
  const [delayMs, setDelayMs] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  // Status & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Set default sender from user profile
  useEffect(() => {
    if (user?.senders && user.senders.length > 0 && !selectedSenderId) {
      setSelectedSenderId(user.senders[0].id);
    }
  }, [user, selectedSenderId]);

  const handleSendLater = async () => {
    setValidationError(null);

    // Validation
    if (recipients.length === 0) {
      setValidationError('Please specify at least one valid recipient or upload a CSV/TXT list.');
      return;
    }

    if (!subject.trim()) {
      setValidationError('Please enter an email subject.');
      return;
    }

    if (!body.trim() || body === '<p><br></p>') {
      setValidationError('Please compose your email message body.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await emailService.schedule({
        subject,
        body,
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayMs,
        hourlyLimit,
        senderId: selectedSenderId || undefined,
      });

      setSuccessToast(
        `Successfully scheduled ${response.totalScheduled} email(s) with ${response.effectiveDelayMs}ms delay!`
      );

      // Short delay for user to read success toast, then navigate
      setTimeout(() => {
        navigate('/dashboard/scheduled');
      }, 1200);
    } catch (err: any) {
      setValidationError(
        err.response?.data?.error?.message || err.message || 'Failed to schedule emails'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Compose Header Bar matching Figma */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/scheduled')}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600 transition-colors"
            title="Cancel and return"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Compose New Email</h1>
        </div>

        {/* Primary Action Button: Send Later */}
        <Button
          type="button"
          variant="primary"
          onClick={handleSendLater}
          isLoading={isSubmitting}
          className="shadow-sm"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send Later</span>
        </Button>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{successToast}</span>
        </div>
      )}

      {/* Validation Error Banner */}
      {validationError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Main Compose Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-card p-6 space-y-5">
        {/* Schedule Controls (From, Start Time, Delay, Hourly Limit) */}
        <ScheduleControls
          startTime={startTime}
          onStartTimeChange={setStartTime}
          delayMs={delayMs}
          onDelayChange={setDelayMs}
          hourlyLimit={hourlyLimit}
          onHourlyLimitChange={setHourlyLimit}
          senders={user?.senders || []}
          selectedSenderId={selectedSenderId}
          onSenderChange={setSelectedSenderId}
        />

        {/* Recipients (To) with CSV/TXT upload */}
        <RecipientUpload recipients={recipients} onChange={setRecipients} />

        {/* Subject */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Subject
          </label>
          <input
            type="text"
            placeholder="e.g. Quarterly Product Update & Feedback"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-md text-xs text-gray-900 
              placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>

        {/* Rich Email Body Editor */}
        <div className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
            Email Body
          </label>
          <EmailEditor value={body} onChange={setBody} />
        </div>
      </div>
    </div>
  );
};
