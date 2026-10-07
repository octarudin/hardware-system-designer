import { describe, expect, it } from 'vitest';

import { getRuleEngineDescriptor } from './index.js';

describe('rule-engine M0 boundary', () => {
  it('declares the approved ruleset without claiming an implementation', () => {
    expect(getRuleEngineDescriptor()).toEqual({
      rulesetVersion: 'hwsd.connection-rules/1',
      implementationStatus: 'NOT_IMPLEMENTED',
      deterministic: true,
    });
  });
});
