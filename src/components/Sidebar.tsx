import { 
  FileCode, 
  Play, 
  ShieldCheck, 
  RotateCcw, 
  Settings,
  Database,
  BookOpen,
  Stamp,
  Library,
  FileSearch,
  ScrollText
} from "lucide-react";
import { cn } from "@/lib/utils";
import recanonIcon from "@/assets/recanon-icon.png";
import { ThemeToggle } from "@/components/ThemeToggle";

import { useNavigate } from "react-router-dom";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'guide', label: 'Start Here', icon: BookOpen },
  { id: 'audit-log', label: 'Audit Log', icon: ScrollText, route: '/audit-log' },
];

const bottomItems: typeof navItems = [];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
  const navigate = useNavigate();
  
  const handleNavClick = (item: typeof navItems[0]) => {
    if ('route' in item && item.route) {
      navigate(item.route);
    } else {
      onViewChange(item.id);
    }
  };
  
  return (
    <aside className="hidden md:flex w-56 h-screen bg-sidebar border-r border-sidebar-border flex-col sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={recanonIcon} alt="Recanon" className="h-8 w-8" />
          <div>
            <div className="font-semibold text-sm">Recanon</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Certified Backtests</div>
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
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
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
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
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

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Anonymous verification mode
        </p>
        <ThemeToggle className="h-7 w-7 text-muted-foreground" />
      </div>
    </aside>
  );
}
