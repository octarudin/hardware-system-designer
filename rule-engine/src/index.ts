import { CONTRACT_VERSIONS } from '@hwsd/shared';

export interface RuleEngineDescriptor {
  readonly rulesetVersion: string;
  readonly implementationStatus: 'IMPLEMENTED';
  readonly deterministic: true;
  readonly ruleCount: number;
}

export { canonicalJson, sha256 } from './canonical.js';
export { evaluate, isDesignCheckCurrent, ProjectRevisionConflictError } from './engine.js';
export { RULE_REGISTRY } from './registry.js';
export type { EvaluationInput, EvaluationMode, RuleMetadata } from './types.js';

import { RULE_REGISTRY } from './registry.js';

export function getRuleEngineDescriptor(): RuleEngineDescriptor {
  return {
    rulesetVersion: CONTRACT_VERSIONS.ruleset,
    implementationStatus: 'IMPLEMENTED',
    deterministic: true,
    ruleCount: RULE_REGISTRY.length,
  };
}
