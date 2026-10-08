/* eslint-disable */
/**
 * Generated from docs/schemas by scripts/generate-contracts.mjs.
 * Do not edit by hand.
 */

/**
 * Deterministic evaluation result produced by Connection & Rule Engine V1.
 */
export type HardwareSystemDesignerConnectionRuleResultV1 = {
  ruleset_version: 'hwsd.connection-rules/1';
  mode: 'CONNECTION_PREVIEW' | 'CONNECTION_COMMIT' | 'DESIGN_CHECK';
  subject: Subject;
  verdict: 'VALID' | 'WARNING' | 'ERROR';
  allowed: boolean;
  requires_confirmation: boolean;
  findings: Finding[];
  allocation_effects: AllocationEffect[];
  summary?: Summary;
};
export type EntityId = string;
export type AllocationEffect = {
  action: 'ALLOCATE' | 'SHARE';
  component_instance_id: EntityId;
  resource_kind: 'PIN' | 'FUNCTION' | 'RESOURCE' | 'CHANNEL';
  resource_id: EntityId;
  channel?: string;
  connection_id: EntityId;
};

export interface Subject {
  project_id?: EntityId;
  connection_id?: EntityId;
  component_instance_id?: EntityId;
  bus_id?: EntityId;
}
export interface Finding {
  rule_id: string;
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  /**
   * @minItems 1
   */
  locations: [Location, ...Location[]];
  details: Detail[];
  suggested_actions: string[];
  fingerprint: string;
  acknowledged?: boolean;
}
export interface Location {
  entity_type: 'PROJECT' | 'CONNECTION' | 'BUS' | 'COMPONENT_INSTANCE';
  entity_id: EntityId;
  path?: string;
}
export interface Detail {
  key: string;
  value: string;
}
export interface Summary {
  checks_evaluated: number;
  passed: number;
  infos: number;
  warnings: number;
  errors: number;
}
