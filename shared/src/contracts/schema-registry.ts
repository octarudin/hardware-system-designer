import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import formatsPlugin from 'ajv-formats';

import { V1_SCHEMAS } from '../generated/v1-schema-bundle.js';
import type { HardwareSystemDesignerComponentSchemaV1 as ComponentSchemaV1 } from '../generated/component-schema-v1.js';
import type { HardwareSystemDesignerConnectionRuleResultV1 as ConnectionRuleResultV1 } from '../generated/connection-rule-result-v1.js';
import type { HardwareSystemDesignerPortInterfaceSchemaV1 as PortInterfaceSchemaV1 } from '../generated/port-interface-schema-v1.js';
import type { HardwareSystemDesignerProjectFileV1 as ProjectFileV1 } from '../generated/project-file-v1.js';

export const SCHEMA_IDS = Object.freeze({
  component: 'https://hardware-system-designer.local/schemas/component-schema-v1.schema.json',
  portInterface:
    'https://hardware-system-designer.local/schemas/port-interface-schema-v1.schema.json',
  project: 'https://hardware-system-designer.local/schemas/project-file-v1.schema.json',
  ruleResult:
    'https://hardware-system-designer.local/schemas/connection-rule-result-v1.schema.json',
});

export type SchemaId = (typeof SCHEMA_IDS)[keyof typeof SCHEMA_IDS];

export interface SchemaValidationIssue {
  readonly code: string;
  readonly path: string;
  readonly keyword: string;
  readonly message: string;
}

export type SchemaValidationResult<T> =
  | { readonly valid: true; readonly value: T; readonly issues: readonly [] }
  | { readonly valid: false; readonly issues: readonly SchemaValidationIssue[] };

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictRequired: false,
  strictTypes: false,
  validateFormats: true,
});

formatsPlugin.default(ajv);
for (const schema of V1_SCHEMAS) {
  ajv.addSchema(schema);
}

function escapePointerSegment(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function issuePath(error: ErrorObject): string {
  if (error.keyword === 'required') {
    const missingProperty = String(error.params['missingProperty']);
    return `${error.instancePath}/${escapePointerSegment(missingProperty)}`;
  }

  if (error.keyword === 'additionalProperties') {
    const property = String(error.params['additionalProperty']);
    return `${error.instancePath}/${escapePointerSegment(property)}`;
  }

  return error.instancePath || '/';
}

function normalizeErrors(errors: ErrorObject[] | null | undefined): SchemaValidationIssue[] {
  return (errors ?? [])
    .map((error) => ({
      code: `SCHEMA_${error.keyword.replaceAll('-', '_').toUpperCase()}`,
      path: issuePath(error),
      keyword: error.keyword,
      message: error.message ?? 'Schema validation failed',
    }))
    .sort((left, right) =>
      `${left.path}:${left.code}:${left.message}`.localeCompare(
        `${right.path}:${right.code}:${right.message}`,
      ),
    );
}

function validatorFor<T>(schemaId: SchemaId): ValidateFunction<T> {
  const validator = ajv.getSchema<T>(schemaId);
  if (!validator) {
    throw new Error(`Schema is not registered: ${schemaId}`);
  }
  return validator;
}

export function validateSchema<T>(schemaId: SchemaId, value: unknown): SchemaValidationResult<T> {
  const validator = validatorFor<T>(schemaId);
  if (validator(value)) {
    return { valid: true, value, issues: [] };
  }
  return { valid: false, issues: normalizeErrors(validator.errors) };
}

export const validateComponentSchema = (value: unknown) =>
  validateSchema<ComponentSchemaV1>(SCHEMA_IDS.component, value);

export const validatePortInterfaceSchema = (value: unknown) =>
  validateSchema<PortInterfaceSchemaV1>(SCHEMA_IDS.portInterface, value);

export const validateConnectionRuleResultSchema = (value: unknown) =>
  validateSchema<ConnectionRuleResultV1>(SCHEMA_IDS.ruleResult, value);

export const validateProjectFileSchema = (value: unknown) =>
  validateSchema<ProjectFileV1>(SCHEMA_IDS.project, value);
