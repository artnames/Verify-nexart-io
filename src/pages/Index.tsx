import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileHeader } from "@/components/MobileHeader";
import { HowItWorksPanel } from "@/components/HowItWorksPanel";
import { useSEO } from "@/hooks/useSEO";
import { useJsonLd, buildWebPage, buildBreadcrumbs } from "@/hooks/useJsonLd";

const STORAGE_KEY_VIEW = 'recanon_active_view';

export default function Index() {
  const [activeView, setActiveView] = useState(() => {
    return 'guide';
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VIEW, activeView);
  }, [activeView]);

  const handleViewChange = useCallback((view: string) => {
    setActiveView(view);
  }, []);

  useSEO({
    title: 'NexArt Verification Portal — Verify Certified Execution Records',
    description: 'Independently verify Certified Execution Records (CERs). Upload bundles, validate integrity, check node signatures, and inspect execution evidence.',
    path: '/',
  });

  useJsonLd([
    buildWebPage({
      name: 'NexArt Verification Portal',
      description: 'Public verification surface for Certified Execution Records (CERs) produced by the NexArt deterministic execution runtime.',
      path: '/',
    }),
    buildBreadcrumbs([
      { name: 'Verification Portal', path: '/' },
    ]),
  ]);

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
