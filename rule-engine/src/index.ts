import { CONTRACT_VERSIONS } from '@hwsd/shared';

export interface RuleEngineDescriptor {
  readonly rulesetVersion: string;
  readonly implementationStatus: 'NOT_IMPLEMENTED';
  readonly deterministic: true;
}

export function getRuleEngineDescriptor(): RuleEngineDescriptor {
  return {
    rulesetVersion: CONTRACT_VERSIONS.ruleset,
    implementationStatus: 'NOT_IMPLEMENTED',
    deterministic: true,
  };
}
