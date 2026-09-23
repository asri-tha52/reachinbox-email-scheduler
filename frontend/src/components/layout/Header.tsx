import React, { useState, useEffect, useRef } from 'react';
import { Search, LogOut, MessageSquare, ChevronDown, CheckCircle2, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { emailService } from '../../services/emailService';
import { slackService } from '../../services/slackService';
import { Email } from '../../types';
import { useNavigate } from 'react-router-dom';

// Derive the Bull Board URL from the API base URL.
// VITE_API_URL is e.g. https://backend.railway.app/api
// We need                 https://backend.railway.app/admin/queues
const BULL_BOARD_URL: string = (() => {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (apiUrl) {
    // Strip trailing /api (or /api/) segment to get the backend root
    const backendRoot = apiUrl.replace(/\/api\/?$/, '');
    return `${backendRoot}/admin/queues`;
  }
  // Fallback for local dev (Vite proxy forwards /admin to localhost:5000)
  return '/admin/queues';
})();

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Email[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResultsDropdown, setShowResultsDropdown] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [slackConnected, setSlackConnected] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Check Slack status
  useEffect(() => {
    slackService
      .getStatus()
      .then((status) => setSlackConnected(status.connected))
      .catch(() => setSlackConnected(false));
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      if (!q) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const data = await emailService.search(q);
        setSearchResults(data.results || []);
        setShowResultsDropdown(true);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowResultsDropdown(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Branding */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard/scheduled')}>
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
          ONB
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900 tracking-tight leading-none">ReachInbox</span>
          <span className="text-[10px] text-gray-500 font-medium leading-tight">Email Scheduler</span>
        </div>
      </div>

      {/* Center: Search Field */}
      <div className="flex-1 max-w-md mx-8 relative" ref={searchContainerRef}>
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by recipient, subject, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim() && setShowResultsDropdown(true)}
            className="w-full pl-9 pr-4 py-1.5 bg-gray-50 hover:bg-gray-100/70 focus:bg-white border border-gray-200 
              rounded-md text-xs text-gray-900 placeholder-gray-400 transition-colors focus:outline-none focus:ring-1 
              focus:ring-emerald-500 focus:border-emerald-500"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResultsDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto z-50 divide-y divide-gray-100">
            {searchResults.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setShowResultsDropdown(false);
                  navigate(`/dashboard/email/${item.id}`);
                }}
                className="p-3 hover:bg-gray-50 cursor-pointer flex flex-col gap-0.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-900 truncate">{item.recipient}</span>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      item.status === 'sent'
                        ? 'bg-emerald-50 text-emerald-700'
                        : item.status === 'scheduled'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <span className="text-xs text-gray-600 truncate">{item.subject}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Slack Status + Bull Board Link + User Profile */}
      <div className="flex items-center gap-3">
        {/* Bull Board Link */}
        <a
          href={BULL_BOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden md:inline-flex items-center gap-1 text-xs text-gray-600 hover:text-emerald-700 bg-gray-50 hover:bg-emerald-50 px-2.5 py-1.5 rounded-md border border-gray-200 transition-colors"
          title="Open Bull Board Queue Metrics"
        >
          <span>Bull Board</span>
          <ExternalLink className="w-3 h-3 text-gray-400" />
        </a>

        {/* Slack Connection Status */}
        {slackConnected ? (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Slack Connected</span>
          </div>
        ) : (
          <a
            href={slackService.getConnectUrl()}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-medium transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
            <span>Connect Slack</span>
          </a>
        )}

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none"
          >
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center border border-emerald-200">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            )}
            <span className="text-xs font-medium text-gray-700 hidden lg:inline-block max-w-[120px] truncate">
              {user?.name || 'User'}
            </span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
              </div>

              <div className="py-1">
                <a
                  href={BULL_BOARD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>Queue Dashboard</span>
                  <ExternalLink className="w-3 h-3 text-gray-400" />
                </a>

                {!slackConnected ? (
                  <a
                    href={slackService.getConnectUrl()}
                    className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-gray-500" />
                    <span>Connect Slack</span>
                  </a>
                ) : (
                  <button
                    onClick={async () => {
                      await slackService.disconnect();
                      setSlackConnected(false);
                      setShowUserMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-red-500" />
                    <span>Disconnect Slack</span>
                  </button>
                )}
              </div>

              <div className="border-t border-gray-100 py-1">
                <button
                  onClick={logout}
                  className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5 text-gray-400" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
