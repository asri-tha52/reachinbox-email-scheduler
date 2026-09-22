import React from 'react';
import { Clock, Sliders, ShieldAlert, User } from 'lucide-react';
import { Sender } from '../../types';

interface ScheduleControlsProps {
  startTime: string;
  onStartTimeChange: (time: string) => void;
  delayMs: number;
  onDelayChange: (delay: number) => void;
  hourlyLimit: number;
  onHourlyLimitChange: (limit: number) => void;
  senders: Sender[];
  selectedSenderId: string;
  onSenderChange: (senderId: string) => void;
}

export const ScheduleControls: React.FC<ScheduleControlsProps> = ({
  startTime,
  onStartTimeChange,
  delayMs,
  onDelayChange,
  hourlyLimit,
  onHourlyLimitChange,
  senders,
  selectedSenderId,
  onSenderChange,
}) => {
  return (
    <div className="bg-gray-50/70 border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
      {/* Sender Selector */}
      <div className="space-y-1">
        <label className="flex items-center gap-1 font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
          <User className="w-3.5 h-3.5 text-gray-400" />
          <span>From (Sender)</span>
        </label>
        <select
          value={selectedSenderId}
          onChange={(e) => onSenderChange(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          {senders.length === 0 ? (
            <option value="">Default Account Sender</option>
          ) : (
            senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.email})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Start Time Picker */}
      <div className="space-y-1">
        <label className="flex items-center gap-1 font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>Start Sending At</span>
        </label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>

      {/* Delay Between Emails */}
      <div className="space-y-1">
        <label className="flex items-center gap-1 font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
          <Sliders className="w-3.5 h-3.5 text-gray-400" />
          <span>Delay Between (ms)</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1000"
            step="500"
            value={delayMs}
            onChange={(e) => onDelayChange(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <span className="text-gray-400 font-medium">ms</span>
        </div>
      </div>

      {/* Hourly Sending Limit */}
      <div className="space-y-1">
        <label className="flex items-center gap-1 font-semibold text-gray-700 uppercase tracking-wider text-[11px]">
          <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
          <span>Hourly Limit</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="1"
            max="10000"
            value={hourlyLimit}
            onChange={(e) => onHourlyLimitChange(Number(e.target.value))}
            className="w-full px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <span className="text-gray-400 font-medium">/hr</span>
        </div>
      </div>
    </div>
  );
};
