/**
 * Audit Layout - Wrapper for audit pages with sidebar
 */

import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { MobileHeader } from '@/components/MobileHeader';
import { useNavigate } from 'react-router-dom';

interface AuditLayoutProps {
  children: React.ReactNode;
}

export function AuditLayout({ children }: AuditLayoutProps) {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('audit-log');

  const handleViewChange = (view: string) => {
    setActiveView(view);
    // Navigate to the appropriate route
    switch (view) {
      case 'guide':
        navigate('/');
        break;
      case 'claim':
      case 'library':
      case 'verify':
      case 'strategies':
      case 'execute':
      case 'artifacts':
      case 'datasets':
      case 'settings':
        navigate('/');
        // The Index component will handle the view state
        break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <MobileHeader activeView={activeView} onViewChange={handleViewChange} />
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        {children}
      </main>
    </div>
  );
}
