import React from 'react';
import { EmailStatus } from '../../types';

interface BadgeProps {
  status: EmailStatus | string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const styles: Record<string, string> = {
    scheduled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    processing: 'bg-amber-50 text-amber-700 border-amber-200',
    sent: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    failed: 'bg-red-50 text-red-700 border-red-200',
  };

  const statusStyle = styles[status.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${statusStyle} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {status}
    </span>
  );
};
