import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Plus, Clock, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    {
      to: '/dashboard/scheduled',
      label: 'Scheduled',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      to: '/dashboard/sent',
      label: 'Sent',
      icon: <Send className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col h-[calc(100vh-3.5rem)] select-none">
      {/* User profile compact area */}
      <div className="p-4 border-b border-gray-100 flex items-center gap-3">
        {user?.avatar ? (
          <img src={user.avatar} alt="" className="w-8 h-8 rounded-full border border-gray-200 object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-semibold text-xs flex items-center justify-center border border-emerald-200">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
        )}
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-semibold text-gray-900 truncate">{user?.name || 'User'}</span>
          <span className="text-[11px] text-gray-500 truncate">{user?.email || 'user@reachinbox.ai'}</span>
        </div>
      </div>

      {/* Compose Action Button */}
      <div className="p-3">
        <button
          onClick={() => navigate('/dashboard/compose')}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 
            text-white text-xs font-semibold rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1"
        >
          <Plus className="w-4 h-4" />
          <span>Compose</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-800 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? 'text-emerald-700' : 'text-gray-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Quick Info */}
      <div className="p-3 border-t border-gray-100 text-[11px] text-gray-400 flex items-center justify-between">
        <span>ReachInbox v1.0</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="System Online"></span>
      </div>
    </aside>
  );
};
