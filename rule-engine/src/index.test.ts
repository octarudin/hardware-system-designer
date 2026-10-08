import { describe, expect, it } from 'vitest';

import { getRuleEngineDescriptor } from './index.js';

describe('rule-engine descriptor', () => {
  it('declares the implemented immutable V1 registry', () => {
    expect(getRuleEngineDescriptor()).toEqual({
      rulesetVersion: 'hwsd.connection-rules/1',
      implementationStatus: 'IMPLEMENTED',
      deterministic: true,
      ruleCount: 38,
    });
  });
});
