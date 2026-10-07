import { describe, expect, it } from 'vitest';

import { API_VERSION, CONTRACT_VERSIONS } from './index.js';

describe('shared contract metadata', () => {
  it('publishes the V1 API and ruleset identifiers', () => {
    expect(API_VERSION).toBe('v1');
    expect(CONTRACT_VERSIONS.ruleset).toBe('hwsd.connection-rules/1');
  });

  it('cannot be mutated at runtime', () => {
    expect(Object.isFrozen(CONTRACT_VERSIONS)).toBe(true);
  });
});
