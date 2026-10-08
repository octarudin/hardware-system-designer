import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compile } from 'json-schema-to-typescript';
import { format } from 'prettier';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaDirectory = resolve(repositoryRoot, 'docs/schemas');
const generatedDirectory = resolve(repositoryRoot, 'shared/src/generated');
const checkOnly = process.argv.includes('--check');

const contracts = [
  ['component-schema-v1.schema.json', 'ComponentSchemaV1', 'component-schema-v1.ts'],
  ['port-interface-schema-v1.schema.json', 'PortInterfaceSchemaV1', 'port-interface-schema-v1.ts'],
  [
    'connection-rule-result-v1.schema.json',
    'ConnectionRuleResultV1',
    'connection-rule-result-v1.ts',
  ],
  ['project-file-v1.schema.json', 'ProjectFileV1', 'project-file-v1.ts'],
];

const bannerComment = `/* eslint-disable */
/**
 * Generated from docs/schemas by scripts/generate-contracts.mjs.
 * Do not edit by hand.
 */`;

async function renderTypes(schemaName, typeName) {
  const schemaPath = resolve(schemaDirectory, schemaName);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));

  const output = await compile(schema, typeName, {
    bannerComment,
    cwd: schemaDirectory,
    format: false,
    style: { singleQuote: true },
    unknownAny: false,
  });
  return format(output, {
    parser: 'typescript',
    printWidth: 100,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
  });
}

async function renderSchemaBundle() {
  const schemas = await Promise.all(
    contracts.map(async ([schemaName]) =>
      JSON.parse(await readFile(resolve(schemaDirectory, schemaName), 'utf8')),
    ),
  );

  const output = `${bannerComment}\n\nexport const V1_SCHEMAS = ${JSON.stringify(schemas, null, 2)} as const;\n`;
  return format(output, {
    parser: 'typescript',
    printWidth: 100,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
  });
}

async function synchronize(relativePath, expected) {
  const outputPath = resolve(generatedDirectory, relativePath);

  if (checkOnly) {
    const actual = await readFile(outputPath, 'utf8').catch(() => '');
    if (actual !== expected) {
      throw new Error(
        `Generated contract drift detected in ${relativePath}. Run "pnpm contracts:generate".`,
      );
    }
    return;
  }

  await writeFile(outputPath, expected, 'utf8');
}

await mkdir(generatedDirectory, { recursive: true });

await Promise.all([
  ...contracts.map(async ([schemaName, typeName, outputName]) =>
    synchronize(outputName, await renderTypes(schemaName, typeName)),
  ),
  synchronize('v1-schema-bundle.ts', await renderSchemaBundle()),
]);

console.log(checkOnly ? 'Generated contracts are current.' : 'Generated contracts updated.');
