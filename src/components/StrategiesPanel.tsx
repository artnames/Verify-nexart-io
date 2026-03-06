import { useState } from "react";
import { Upload, Lock, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { StrategyCard } from "./StrategyCard";
import { HashDisplay } from "./HashDisplay";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import type { Strategy } from "@/types/backtest";

interface StrategiesPanelProps {
  strategies: Strategy[];
}

export function StrategiesPanel({ strategies }: StrategiesPanelProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Strategy List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Registered Strategies</h2>
          <div className="text-right">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Request Strategy Registration
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Strategy Registration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Strategies are immutable, sealed execution definitions.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    To register a new strategy, contact <span className="text-foreground font-medium">@arrotu</span> on X with:
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 pl-2">
                    <li>Strategy name</li>
                    <li>Short description</li>
                    <li>Intended use case</li>
                  </ul>
                  <p className="text-xs text-muted-foreground/80">
                    This helps ensure quality, clarity, and long-term verifiability.
                  </p>
                  <Button asChild className="w-full mt-4">
                    <a 
                      href="https://x.com/arrotu" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Contact @arrotu on X
                    </a>
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <p className="text-xs text-muted-foreground mt-1">
              Strategy registration is currently curated.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {strategies.map((strategy) => (
            <StrategyCard
              key={strategy.id}
              strategy={strategy}
              selected={selectedStrategy?.id === strategy.id}
              onSelect={() => setSelectedStrategy(strategy)}
            />
          ))}
        </div>
      </div>

      {/* Strategy Details */}
      <div>
        {selectedStrategy ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{selectedStrategy.name}</h3>
              <div className="flex items-center gap-2">
                {selectedStrategy.locked ? (
                  <span className="verified-badge">
                    <Lock className="w-3.5 h-3.5" />
                    Locked
                  </span>
                ) : (
                  <Button variant="outline" size="sm">
                    <Lock className="w-4 h-4 mr-2" />
                    Lock Strategy
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="section-header">Code Hash (SHA-256)</h4>
                <div className="p-3 rounded-md bg-card border border-border">
                  <HashDisplay 
                    hash={selectedStrategy.codeHash} 
                    truncate={false}
                  />
                </div>
              </div>

              <div>
                <h4 className="section-header">Registration</h4>
                <div className="text-sm">
                  {new Date(selectedStrategy.registeredAt).toLocaleString()}
                </div>
              </div>

              {selectedStrategy.description && (
                <div>
                  <h4 className="section-header">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedStrategy.description}
                  </p>
                </div>
              )}

              <div className="p-4 rounded-md bg-muted/50 border border-border">
                <h4 className="text-sm font-medium mb-2">Immutability Notice</h4>
                <p className="text-xs text-muted-foreground">
                  Once locked, this strategy's code cannot be modified. Any backtest 
                  executed against this strategy will reference this exact code hash, 
                  ensuring reproducibility across all future verifications.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <div className="text-center">
              <Upload className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Select a strategy to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
