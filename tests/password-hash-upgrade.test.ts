import { describe, expect, it } from 'vitest';
import {
  InMemoryUserRepository,
  InMemoryTenantRepository,
  InMemoryTenantMembershipRepository,
  InMemorySessionRepository,
  ScryptPasswordHasher,
} from '@v-gold/database';
import { Email } from '@v-gold/core';
import { AuthService } from '../apps/web/lib/auth/auth.service.js';

describe('Stage 8.2 — Transparent password-hash upgrade after successful login (ADR-0044)', () => {
  it('re-hashes legacy (N=2^14) hashes to the current policy (N=2^17) on login and keeps credentials valid', async () => {
    const userRepo = new InMemoryUserRepository();
    const tenantRepo = new InMemoryTenantRepository();
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const sessionRepo = new InMemorySessionRepository();

    const legacyHasher = new ScryptPasswordHasher({}, { N: 16384, r: 8, p: 1 });
    const currentHasher = new ScryptPasswordHasher();

    const legacyService = new AuthService(userRepo, tenantRepo, membershipRepo, sessionRepo, legacyHasher);
    const currentService = new AuthService(userRepo, tenantRepo, membershipRepo, sessionRepo, currentHasher);

    const plain = 'Legacy#Hash_Upgrade_2026';
    const email = Email.create('legacy@vgold.test').unwrap();

    // 1. Register while the legacy parameters are in force.
    const registered = await legacyService.register({
      email: 'legacy@vgold.test',
      password: plain,
      displayName: 'Legacy Hash Owner',
    });
    expect(registered.isOk).toBe(true);

    const storedBefore = (await userRepo.findByEmail(email))!;
    const hashBefore = storedBefore.passwordHash.value;
    expect(hashBefore).toContain('N=16384');
    expect(currentHasher.needsRehash(hashBefore)).toBe(true);

    // 2. First login under the hardened default must succeed AND upgrade the hash.
    const login1 = await currentService.login({ email: 'legacy@vgold.test', password: plain });
    expect(login1.isOk).toBe(true);

    const storedAfter = (await userRepo.findByEmail(email))!;
    const hashAfter = storedAfter.passwordHash.value;
    expect(hashAfter).toContain('N=131072');
    expect(hashAfter).not.toBe(hashBefore);
    expect(currentHasher.needsRehash(hashAfter)).toBe(false);

    // 3. The same password keeps working (and wrong passwords keep failing).
    const login2 = await currentService.login({ email: 'legacy@vgold.test', password: plain });
    expect(login2.isOk).toBe(true);

    const loginWrong = await currentService.login({ email: 'legacy@vgold.test', password: 'Wrong#Password_2026' });
    expect(loginWrong.isErr).toBe(true);
  });

  it('does not touch hashes already at the current parameters', async () => {
    const userRepo = new InMemoryUserRepository();
    const tenantRepo = new InMemoryTenantRepository();
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const sessionRepo = new InMemorySessionRepository();
    const hasher = new ScryptPasswordHasher();
    const service = new AuthService(userRepo, tenantRepo, membershipRepo, sessionRepo, hasher);

    const plain = 'Modern#Hash_Noop_2026';
    const email = Email.create('modern@vgold.test').unwrap();
    const registered = await service.register({
      email: 'modern@vgold.test',
      password: plain,
      displayName: 'Modern Hash Owner',
    });
    expect(registered.isOk).toBe(true);

    const before = (await userRepo.findByEmail(email))!;
    const hashBefore = before.passwordHash.value;

    const login = await service.login({ email: 'modern@vgold.test', password: plain });
    expect(login.isOk).toBe(true);

    const after = (await userRepo.findByEmail(email))!;
    expect(after.passwordHash.value).toBe(hashBefore);
  });
});
