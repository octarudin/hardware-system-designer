import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const schemaDirectory = resolve('docs/schemas');
const draft202012 = 'https://json-schema.org/draft/2020-12/schema';

const expectedSchemas = [
  {
    file: 'component-schema-v1.schema.json',
    id: 'https://hardware-system-designer.local/schemas/component-schema-v1.schema.json',
  },
  {
    file: 'port-interface-schema-v1.schema.json',
    id: 'https://hardware-system-designer.local/schemas/port-interface-schema-v1.schema.json',
  },
  {
    file: 'connection-rule-result-v1.schema.json',
    id: 'https://hardware-system-designer.local/schemas/connection-rule-result-v1.schema.json',
  },
  {
    file: 'project-file-v1.schema.json',
    id: 'https://hardware-system-designer.local/schemas/project-file-v1.schema.json',
  },
] as const;

describe('V1 schema assets', () => {
  for (const expected of expectedSchemas) {
    it(`${expected.file} is valid JSON with its canonical identity`, async () => {
      const content = await readFile(resolve(schemaDirectory, expected.file), 'utf8');
      const schema = JSON.parse(content) as Record<string, unknown>;

      expect(schema.$schema).toBe(draft202012);
      expect(schema.$id).toBe(expected.id);
    });
  }

  it('uses unique schema identifiers', async () => {
    const schemas = await Promise.all(
      expectedSchemas.map(async ({ file }) => {
        const content = await readFile(resolve(schemaDirectory, file), 'utf8');
        return JSON.parse(content) as Record<string, unknown>;
      }),
    );
    const ids = schemas.map((schema) => schema.$id);

    expect(new Set(ids).size).toBe(expectedSchemas.length);
  });
});
