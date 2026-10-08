import { hash, verify, argon2id } from 'argon2';

import type { PasswordVerifier } from './types.js';

const ARGON2_OPTIONS = Object.freeze({
  type: argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
});

export class Argon2PasswordVerifier implements PasswordVerifier {
  private readonly dummyHash = hash('hwsd-non-account-password', ARGON2_OPTIONS);

  public async verify(passwordHash: string | undefined, password: string): Promise<boolean> {
    const candidateHash = passwordHash ?? (await this.dummyHash);
    try {
      return await verify(candidateHash, password);
    } catch {
      return false;
    }
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}
