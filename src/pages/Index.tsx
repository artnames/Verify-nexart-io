import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { HowItWorksPanel } from "@/components/HowItWorksPanel";

const STORAGE_KEY_VIEW = 'recanon_active_view';

export default function Index() {
  // Load saved view from localStorage, default to 'guide' for new users
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VIEW);
    // Only allow 'guide' view on Index page now
    return 'guide';
  });

  // Persist active view to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, activeView);
  }, [activeView]);

  // Handle navigation
  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
  }, []);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-background">
      <MobileHeader activeView={activeView} onViewChange={handleViewChange} />
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <HowItWorksPanel />
        </div>
      </main>
    </div>
  );
}
