import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, BookOpen, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import nexartIcon from "@/assets/nexart-icon.png";
import { ThemeToggle } from "@/components/ThemeToggle";

interface MobileHeaderProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'guide', label: 'Start Here', icon: BookOpen },
  { id: 'audit-log', label: 'Verification Log', icon: ScrollText, route: '/audit-log' },
];

const bottomItems: typeof navItems = [];

export function MobileHeader({ activeView, onViewChange }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavClick = (item: typeof navItems[0]) => {
    if ('route' in item && item.route) {
      navigate(item.route);
    } else {
      onViewChange(item.id);
    }
    setOpen(false);
  };

  const currentItem = [...navItems, ...bottomItems].find(item => item.id === activeView);

  return (
    <header className="md:hidden sticky top-0 z-50 bg-sidebar border-b border-sidebar-border px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={recanonIcon} alt="NexArt" className="h-7 w-7" />
          <div>
            <div className="font-semibold text-sm">NexArt</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {currentItem?.label || 'Menu'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle className="h-8 w-8 text-muted-foreground" />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
          <SheetContent side="right" className="w-64 p-0 bg-sidebar">
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-sidebar-border">
                <div className="flex items-center gap-3">
                  <img src={recanonIcon} alt="NexArt" className="h-8 w-8" />
                  <div>
                    <div className="font-semibold text-sm">NexArt</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Verification Portal
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Nav */}
              <nav className="flex-1 p-3 overflow-auto">
                <div className="space-y-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                          activeView === item.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Bottom Nav */}
              <div className="p-3 border-t border-sidebar-border">
                <div className="space-y-1">
                  {bottomItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavClick(item as typeof navItems[0])}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                          activeView === item.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  );
}
