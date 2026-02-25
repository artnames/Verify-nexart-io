/**
 * "What was recorded" — 3-panel enterprise layout.
 * Panel A: Input (hidden by default)
 * Panel B: How it was run (key-value table)
 * Panel C: Output (hidden by default)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SensitiveFieldViewer } from './SensitiveFieldViewer';
import type { BundleKind, InputFields, ExecutionConditions, OutputFields, MetadataFields } from './types';

interface Props {
  kind: BundleKind;
  inputs: InputFields;
  conditions: ExecutionConditions;
  outputs: OutputFields;
  metadata: MetadataFields;
}

function KVRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap text-xs">{label}</td>
      <td className="py-2 text-xs font-mono text-right">{String(value)}</td>
    </tr>
  );
}

function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some(v => v !== undefined && v !== null);
}

export function WhatWasRecorded({ kind, inputs, conditions, outputs, metadata }: Props) {
  const hasInputs = kind === 'ai-execution'
    ? (inputs.prompt !== undefined || inputs.input !== undefined)
    : (inputs.claim !== undefined || inputs.code !== undefined || inputs.source !== undefined);

  const hasOutputs = outputs.output !== undefined || outputs.result !== undefined || outputs.decision !== undefined;

  const hasMetadata = metadata.source || metadata.tags?.length || metadata.appId
    || metadata.conversationId || metadata.workflowId || metadata.executionId
    || Object.keys(metadata.extra).length > 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-1">What was recorded</h3>
        <p className="text-xs text-muted-foreground">
          The data below was locked at certification time. Private fields are hidden by default.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Panel A: Input */}
        <Card className="border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Input
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {!hasInputs ? (
              <p className="text-xs text-muted-foreground italic">No input data in this record.</p>
            ) : kind === 'ai-execution' ? (
              <SensitiveFieldViewer label="Prompt / input data" value={inputs.prompt ?? inputs.input} />
            ) : (
              <>
                {inputs.claim && <SensitiveFieldViewer label="Claim" value={inputs.claim} defaultHidden={false} />}
                {inputs.code && <SensitiveFieldViewer label="Code snapshot" value={inputs.code} defaultHidden={false} />}
                {inputs.source && <SensitiveFieldViewer label="Sources" value={inputs.source} defaultHidden={false} />}
                {inputs.seed !== undefined && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Seed: </span>
                    <code className="font-mono">{inputs.seed}</code>
                  </div>
                )}
                {inputs.vars && Object.keys(inputs.vars).length > 0 && (
                  <SensitiveFieldViewer label="Variables" value={inputs.vars} defaultHidden={false} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Panel B: How it was run */}
        <Card className="border">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              How it was run
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!hasAnyValue(conditions as unknown as Record<string, unknown>) ? (
              <p className="text-xs text-muted-foreground italic">No execution settings found.</p>
            ) : (
              <table className="w-full">
                <tbody>
                  {kind === 'ai-execution' ? (
                    <>
                      <KVRow label="Provider" value={conditions.provider} />
                      <KVRow label="Model" value={conditions.model} />
                      <KVRow label="Model version" value={conditions.modelVersion} />
                      <KVRow label="Temperature" value={conditions.temperature} />
                      <KVRow label="Max tokens" value={conditions.maxTokens} />
                      <KVRow label="Top P" value={conditions.topP} />
                      <KVRow label="Seed" value={conditions.seed} />
                      <KVRow label="Execution ID" value={conditions.executionId} />
                      <KVRow label="Execution surface" value={conditions.executionSurface} />
                      <KVRow label="Step index" value={conditions.stepIndex} />
                      <KVRow label="Workflow ID" value={conditions.workflowId} />
                      {conditions.parameters && Object.entries(conditions.parameters)
                        .filter(([k]) => !['temperature', 'maxTokens', 'max_tokens', 'topP', 'top_p', 'seed'].includes(k))
                        .map(([k, v]) => (
                          <KVRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : v} />
                        ))
                      }
                    </>
                  ) : (
                    <>
                      <KVRow label="Engine" value={conditions.engine} />
                      <KVRow label="Runtime" value={conditions.runtime} />
                      <KVRow label="Policy" value={conditions.policy} />
                      <KVRow label="Determinism" value={conditions.determinism} />
                      <KVRow label="Seed" value={conditions.seed} />
                      <KVRow label="Workflow ID" value={conditions.workflowId} />
                      <KVRow label="Run ID" value={conditions.runId} />
                      <KVRow label="Step" value={conditions.stepIndex} />
                    </>
                  )}
                </tbody>
              </table>
            )}

            {/* Metadata sub-section */}
            {hasMetadata && (
              <div className="mt-3 pt-3 border-t border-border">
                <table className="w-full">
                  <tbody>
                    {metadata.source && <KVRow label="Source" value={metadata.source} />}
                    {metadata.appId && <KVRow label="App ID" value={metadata.appId} />}
                    {metadata.executionId && <KVRow label="Execution ID" value={metadata.executionId} />}
                    {metadata.workflowId && <KVRow label="Workflow" value={metadata.workflowId} />}
                    {metadata.conversationId && <KVRow label="Conversation" value={metadata.conversationId} />}
                    {metadata.tags && metadata.tags.length > 0 && (
                      <KVRow label="Tags" value={metadata.tags.join(', ')} />
                    )}
                    {Object.entries(metadata.extra).map(([k, v]) => (
                      <KVRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : v} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel C: Output — spans full width */}
        <Card className="border lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Output
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {!hasOutputs ? (
              <p className="text-xs text-muted-foreground italic">No output data in this record.</p>
            ) : (
              <>
                {outputs.output !== undefined && (
                  <SensitiveFieldViewer label="Output" value={outputs.output} />
                )}
                {outputs.result !== undefined && (
                  <SensitiveFieldViewer label="Result" value={outputs.result} defaultHidden={false} />
                )}
                {outputs.decision !== undefined && (
                  <SensitiveFieldViewer label="Decision" value={outputs.decision} defaultHidden={false} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
