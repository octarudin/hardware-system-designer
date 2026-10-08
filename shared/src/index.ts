export const CONTRACT_VERSIONS = Object.freeze({
  component: 'hwsd.component/1',
  portInterface: 'hwsd.port-interface/1',
  project: 'hwsd.project/1',
  ruleResult: 'hwsd.connection-rule-result/1',
  ruleset: 'hwsd.connection-rules/1',
});

export const API_VERSION = 'v1';
export const SYSTEM_NAME = 'Hardware System Designer';

export interface ServiceStatus {
  readonly service: string;
  readonly status: 'ok' | 'ready';
  readonly version: string;
}

export * from './contracts/http.js';
export * from './contracts/auth.js';
export * from './contracts/schema-registry.js';
export * from './contracts/semantic-validation.js';
export type { HardwareSystemDesignerComponentSchemaV1 as ComponentSchemaV1 } from './generated/component-schema-v1.js';
export type { HardwareSystemDesignerConnectionRuleResultV1 as ConnectionRuleResultV1 } from './generated/connection-rule-result-v1.js';
export type { HardwareSystemDesignerPortInterfaceSchemaV1 as PortInterfaceSchemaV1 } from './generated/port-interface-schema-v1.js';
export type { HardwareSystemDesignerProjectFileV1 as ProjectFileV1 } from './generated/project-file-v1.js';
