import { 
  FileCode, 
  Play, 
  ShieldCheck, 
  RotateCcw, 
  Settings,
  Database,
  BookOpen,
  Stamp,
  Library
} from "lucide-react";
import { cn } from "@/lib/utils";
import recanonIcon from "@/assets/recanon-icon.png";
import { AuthButton } from "@/components/AuthButton";

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
}

const navItems = [
  { id: 'guide', label: 'Start Here', icon: BookOpen },
  { id: 'claim', label: 'Create Claim', icon: Stamp },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'verify', label: 'Check & Test', icon: RotateCcw },
  { id: 'strategies', label: 'Strategies', icon: FileCode },
  { id: 'execute', label: 'Execute', icon: Play },
  { id: 'artifacts', label: 'Sealed Results', icon: ShieldCheck },
];

const bottomItems = [
  { id: 'datasets', label: 'Datasets', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ activeView, onViewChange }: SidebarProps) {
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

      {/* Auth Section */}
      <div className="p-3 border-t border-sidebar-border">
        <AuthButton />
      </div>
    </aside>
  );
}
