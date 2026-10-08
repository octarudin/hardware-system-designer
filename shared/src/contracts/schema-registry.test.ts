import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  validateComponentSchema,
  validateConnectionRuleResultSchema,
  validatePortInterfaceSchema,
  validateProjectFileSchema,
} from './schema-registry.js';
import { validateComponentSemantics, validateProjectSemantics } from './semantic-validation.js';

async function fixture(name: string, validity: 'valid' | 'invalid' = 'valid'): Promise<unknown> {
  const content = await readFile(resolve('tests/fixtures/contracts/v1', validity, name), 'utf8');
  return JSON.parse(content) as unknown;
}

describe('V1 schema registry', () => {
  it('resolves all external references offline', async () => {
    expect(validateComponentSchema(await fixture('component-minimal.json')).valid).toBe(true);
    expect(validateComponentSchema(await fixture('component-representative.json')).valid).toBe(
      true,
    );
    expect(validatePortInterfaceSchema(await fixture('port-interface-minimal.json')).valid).toBe(
      true,
    );
    expect(
      validateConnectionRuleResultSchema(await fixture('rule-result-minimal.json')).valid,
    ).toBe(true);
    expect(validateProjectFileSchema(await fixture('project-minimal.json')).valid).toBe(true);
  });

  it('returns stable codes and JSON Pointer paths for invalid input', async () => {
    const result = validateComponentSchema(
      await fixture('component-schema-missing-identity.json', 'invalid'),
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.issues).toContainEqual({
        code: 'SCHEMA_REQUIRED',
        keyword: 'required',
        path: '/identity',
        message: "must have required property 'identity'",
      });
    }
  });
});

describe('V1 semantic validators', () => {
  it('accepts representative components and minimal projects', async () => {
    const component = validateComponentSchema(await fixture('component-representative.json'));
    const project = validateProjectFileSchema(await fixture('project-minimal.json'));
    expect(component.valid && validateComponentSemantics(component.value).issues).toEqual([]);
    expect(project.valid && validateProjectSemantics(project.value).issues).toEqual([]);
  });

  it('reports a function that does not belong to its referenced pin', async () => {
    const schemaResult = validateComponentSchema(
      await fixture('component-semantic-dangling-function.json', 'invalid'),
    );
    expect(schemaResult.valid).toBe(true);
    if (schemaResult.valid) {
      expect(validateComponentSemantics(schemaResult.value).issues).toContainEqual({
        code: 'SEMANTIC_FUNCTION_PIN_MISMATCH',
        path: '/ports/0/bindings/0/function_id',
        message: 'Function FUNC-MISSING does not belong to pin PIN-1',
      });
    }
  });

  it('reports project revision ordering with a stable code and path', async () => {
    const schemaResult = validateProjectFileSchema(
      await fixture('project-semantic-revision-order.json', 'invalid'),
    );
    expect(schemaResult.valid).toBe(true);
    if (schemaResult.valid) {
      expect(validateProjectSemantics(schemaResult.value).issues).toContainEqual({
        code: 'SEMANTIC_REVISION_ORDER',
        path: '/engineering_revision',
        message: 'engineering_revision exceeds document_revision',
      });
    }
  });
});
