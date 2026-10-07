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
