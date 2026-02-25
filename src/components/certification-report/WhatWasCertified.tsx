/**
 * "What was certified" — tabbed panels for Inputs, Conditions, Outputs, Metadata.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileInput, Settings2, FileOutput, Tag } from 'lucide-react';
import { SensitiveFieldViewer } from './SensitiveFieldViewer';
import type { BundleKind, InputFields, ExecutionConditions, OutputFields, MetadataFields } from './types';

interface Props {
  kind: BundleKind;
  inputs: InputFields;
  conditions: ExecutionConditions;
  outputs: OutputFields;
  metadata: MetadataFields;
}

function ConditionRow({ label, value }: { label: string; value: unknown }) {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant="secondary" className="font-mono text-xs">
        {String(value)}
      </Badge>
    </div>
  );
}

function hasAnyValue(obj: Record<string, unknown>): boolean {
  return Object.values(obj).some(v => v !== undefined && v !== null);
}

export function WhatWasCertified({ kind, inputs, conditions, outputs, metadata }: Props) {
  const hasInputs = kind === 'ai-execution'
    ? (inputs.prompt !== undefined || inputs.input !== undefined)
    : (inputs.claim !== undefined || inputs.code !== undefined || inputs.source !== undefined);

  const hasOutputs = outputs.output !== undefined || outputs.result !== undefined || outputs.decision !== undefined;

  const hasMetadata = metadata.source || metadata.tags?.length || metadata.appId
    || metadata.conversationId || metadata.workflowId || metadata.executionId
    || Object.keys(metadata.extra).length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">What was certified</CardTitle>
        <CardDescription className="text-xs">
          Structured view of the certified record contents. Sensitive fields are hidden by default.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="inputs">
          <TabsList className="grid w-full grid-cols-4 h-9">
            <TabsTrigger value="inputs" className="text-xs gap-1">
              <FileInput className="w-3 h-3" />
              Inputs
            </TabsTrigger>
            <TabsTrigger value="conditions" className="text-xs gap-1">
              <Settings2 className="w-3 h-3" />
              Conditions
            </TabsTrigger>
            <TabsTrigger value="outputs" className="text-xs gap-1">
              <FileOutput className="w-3 h-3" />
              Outputs
            </TabsTrigger>
            <TabsTrigger value="metadata" className="text-xs gap-1">
              <Tag className="w-3 h-3" />
              Metadata
            </TabsTrigger>
          </TabsList>

          {/* Inputs */}
          <TabsContent value="inputs" className="mt-4 space-y-3">
            {!hasInputs ? (
              <p className="text-xs text-muted-foreground italic">No input fields found in this bundle.</p>
            ) : kind === 'ai-execution' ? (
              <>
                <SensitiveFieldViewer label="Prompt / Input" value={inputs.prompt ?? inputs.input} />
              </>
            ) : (
              <>
                {inputs.claim && (
                  <SensitiveFieldViewer label="Claim" value={inputs.claim} defaultHidden={false} />
                )}
                {inputs.code && (
                  <SensitiveFieldViewer label="Code" value={inputs.code} defaultHidden={false} />
                )}
                {inputs.source && (
                  <SensitiveFieldViewer label="Sources" value={inputs.source} defaultHidden={false} />
                )}
                {inputs.seed !== undefined && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Seed:</span>
                    <code className="font-mono">{inputs.seed}</code>
                  </div>
                )}
                {inputs.vars && Object.keys(inputs.vars).length > 0 && (
                  <SensitiveFieldViewer label="Variables" value={inputs.vars} defaultHidden={false} />
                )}
              </>
            )}
          </TabsContent>

          {/* Conditions */}
          <TabsContent value="conditions" className="mt-4">
            <div className="space-y-0.5">
              {kind === 'ai-execution' ? (
                <>
                  <ConditionRow label="Provider" value={conditions.provider} />
                  <ConditionRow label="Model" value={conditions.model} />
                  <ConditionRow label="Model Version" value={conditions.modelVersion} />
                  <ConditionRow label="Temperature" value={conditions.temperature} />
                  <ConditionRow label="Max Tokens" value={conditions.maxTokens} />
                  <ConditionRow label="Top P" value={conditions.topP} />
                  <ConditionRow label="Seed" value={conditions.seed} />
                  <ConditionRow label="Execution ID" value={conditions.executionId} />
                  {/* Extra parameters not captured above */}
                  {conditions.parameters && Object.entries(conditions.parameters)
                    .filter(([k]) => !['temperature', 'maxTokens', 'max_tokens', 'topP', 'top_p', 'seed'].includes(k))
                    .map(([k, v]) => (
                      <ConditionRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : v} />
                    ))
                  }
                </>
              ) : (
                <>
                  <ConditionRow label="Engine" value={conditions.engine} />
                  <ConditionRow label="Runtime" value={conditions.runtime} />
                  <ConditionRow label="Policy" value={conditions.policy} />
                  <ConditionRow label="Determinism" value={conditions.determinism} />
                  <ConditionRow label="Seed" value={conditions.seed} />
                  <ConditionRow label="Workflow ID" value={conditions.workflowId} />
                  <ConditionRow label="Run ID" value={conditions.runId} />
                  <ConditionRow label="Step Index" value={conditions.stepIndex} />
                  <ConditionRow label="Prev Step Hash" value={conditions.prevStepHash} />
                </>
              )}
              {!hasAnyValue(conditions as unknown as Record<string, unknown>) && (
                <p className="text-xs text-muted-foreground italic py-2">No execution condition fields found.</p>
              )}
            </div>
          </TabsContent>

          {/* Outputs */}
          <TabsContent value="outputs" className="mt-4 space-y-3">
            {!hasOutputs ? (
              <p className="text-xs text-muted-foreground italic">No output fields found in this bundle.</p>
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
          </TabsContent>

          {/* Metadata */}
          <TabsContent value="metadata" className="mt-4">
            {!hasMetadata ? (
              <p className="text-xs text-muted-foreground italic">No metadata found in this bundle.</p>
            ) : (
              <div className="space-y-0.5">
                <ConditionRow label="Source" value={metadata.source} />
                <ConditionRow label="App ID" value={metadata.appId} />
                <ConditionRow label="Conversation ID" value={metadata.conversationId} />
                <ConditionRow label="Workflow ID" value={metadata.workflowId} />
                <ConditionRow label="Execution ID" value={metadata.executionId} />
                {metadata.tags && metadata.tags.length > 0 && (
                  <div className="flex items-center gap-2 py-1.5 border-b border-border/50">
                    <span className="text-xs text-muted-foreground">Tags</span>
                    <div className="flex gap-1 flex-wrap">
                      {metadata.tags.map((t, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {Object.entries(metadata.extra).map(([k, v]) => (
                  <ConditionRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : v} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
