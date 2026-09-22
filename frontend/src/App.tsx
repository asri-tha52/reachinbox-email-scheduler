import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { ScheduledEmailsPage } from './pages/ScheduledEmailsPage';
import { SentEmailsPage } from './pages/SentEmailsPage';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { ComposePage } from './pages/ComposePage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Application Shell */}
          <Route path="/dashboard" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard/scheduled" replace />} />
            <Route path="scheduled" element={<ScheduledEmailsPage />} />
            <Route path="sent" element={<SentEmailsPage />} />
            <Route path="email/:id" element={<EmailDetailPage />} />
            <Route path="compose" element={<ComposePage />} />
          </Route>

          {/* Default fallback */}
          <Route path="*" element={<Navigate to="/dashboard/scheduled" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
