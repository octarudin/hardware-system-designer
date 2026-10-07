import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const allowedWorkspaceDependencies: Record<string, readonly string[]> = {
  '@hwsd/shared': [],
  '@hwsd/rule-engine': ['@hwsd/shared'],
  '@hwsd/backend': ['@hwsd/rule-engine', '@hwsd/shared'],
  '@hwsd/frontend': ['@hwsd/rule-engine', '@hwsd/shared'],
  '@hwsd/ai': ['@hwsd/shared'],
};

interface PackageManifest {
  readonly name: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
}

async function loadManifest(directory: string): Promise<PackageManifest> {
  const content = await readFile(resolve(directory, 'package.json'), 'utf8');
  return JSON.parse(content) as PackageManifest;
}

describe('workspace architecture boundaries', () => {
  for (const directory of ['shared', 'rule-engine', 'backend', 'frontend', 'ai']) {
    it(`${directory} declares only allowed internal dependencies`, async () => {
      const manifest = await loadManifest(directory);
      const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
      const actualInternalDependencies = Object.keys(dependencies)
        .filter((dependency) => dependency.startsWith('@hwsd/'))
        .sort();
      const allowed = [...(allowedWorkspaceDependencies[manifest.name] ?? [])].sort();
      const forbidden = actualInternalDependencies.filter(
        (dependency) => !allowed.includes(dependency),
      );

      expect(forbidden).toEqual([]);
    });
  }
});
