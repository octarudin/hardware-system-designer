import { describe, expect, it } from 'vitest';

import {
  validateComponentSchema,
  validateComponentSemantics,
  validateConnectionRuleResultSchema,
  validatePortInterfaceSchema,
  validateProjectFileSchema,
  validateProjectSemantics,
} from '@hwsd/shared';

import invalidComponentReference from '../../tests/fixtures/contracts/v1/invalid/component-semantic-dangling-function.json';
import invalidComponentSchema from '../../tests/fixtures/contracts/v1/invalid/component-schema-missing-identity.json';
import invalidProjectRevision from '../../tests/fixtures/contracts/v1/invalid/project-semantic-revision-order.json';
import minimalComponent from '../../tests/fixtures/contracts/v1/valid/component-minimal.json';
import representativeComponent from '../../tests/fixtures/contracts/v1/valid/component-representative.json';
import minimalPort from '../../tests/fixtures/contracts/v1/valid/port-interface-minimal.json';
import minimalProject from '../../tests/fixtures/contracts/v1/valid/project-minimal.json';
import minimalRuleResult from '../../tests/fixtures/contracts/v1/valid/rule-result-minimal.json';

describe('browser-safe contract runtime', () => {
  it('accepts every canonical valid fixture without Node APIs', () => {
    expect(validateComponentSchema(minimalComponent).valid).toBe(true);
    expect(validateComponentSchema(representativeComponent).valid).toBe(true);
    expect(validatePortInterfaceSchema(minimalPort).valid).toBe(true);
    expect(validateConnectionRuleResultSchema(minimalRuleResult).valid).toBe(true);
    expect(validateProjectFileSchema(minimalProject).valid).toBe(true);
  });

  it('produces the same stable structural issue as the Node runtime', () => {
    const result = validateComponentSchema(invalidComponentSchema);

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

  it('produces the same stable semantic issues as the Node runtime', () => {
    const component = validateComponentSchema(invalidComponentReference);
    const project = validateProjectFileSchema(invalidProjectRevision);

    expect(component.valid).toBe(true);
    expect(project.valid).toBe(true);
    if (component.valid && project.valid) {
      expect(validateComponentSemantics(component.value).issues[0]).toMatchObject({
        code: 'SEMANTIC_FUNCTION_PIN_MISMATCH',
        path: '/ports/0/bindings/0/function_id',
      });
      expect(validateProjectSemantics(project.value).issues[0]).toEqual({
        code: 'SEMANTIC_REVISION_ORDER',
        path: '/engineering_revision',
        message: 'engineering_revision exceeds document_revision',
      });
    }
  });
});
