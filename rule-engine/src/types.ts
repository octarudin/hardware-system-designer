import type { ConnectionRuleResultV1, ProjectFileV1 } from '@hwsd/shared';

export type EvaluationMode = ConnectionRuleResultV1['mode'];
export type ProjectConnection = ProjectFileV1['connections'][number];
export type Finding = ConnectionRuleResultV1['findings'][number];
export type AllocationEffect = ConnectionRuleResultV1['allocation_effects'][number];

export interface EvaluationInput {
  readonly project: ProjectFileV1;
  readonly mode: EvaluationMode;
  readonly connection?: ProjectConnection;
  readonly expectedDocumentRevision?: number;
  readonly latestComponentRevisions?: Readonly<Record<string, number>>;
}

export interface RuleMetadata {
  readonly ruleId: string;
  readonly code: string;
  readonly category:
    'STRUCTURAL' | 'INTERFACE' | 'ELECTRICAL' | 'ALLOCATION' | 'BUS' | 'POWER' | 'COMPLETENESS';
  readonly phase: number;
  readonly defaultSeverity: 'INFO' | 'WARNING' | 'ERROR';
}
