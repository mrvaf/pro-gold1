import { describe, expect, it } from 'vitest';
import {
  InMemoryUserRepository,
  InMemoryTenantRepository,
  InMemoryTenantMembershipRepository,
  InMemorySessionRepository,
  ScryptPasswordHasher,
} from '@v-gold/database';
import { AuthService } from '../apps/web/lib/auth/auth.service.js';
import {
  SESSION_COOKIE_NAME,
  createSessionCookieConfig,
  createClearSessionCookieConfig,
} from '../apps/web/lib/auth/session-cookie.js';

describe('IAM Authentication Application Service & Cookie Policy', () => {
  const setupService = () => {
    const userRepo = new InMemoryUserRepository();
    const tenantRepo = new InMemoryTenantRepository();
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const sessionRepo = new InMemorySessionRepository();
    const hasher = new ScryptPasswordHasher();

    const service = new AuthService(userRepo, tenantRepo, membershipRepo, sessionRepo, hasher);
    return { service, userRepo, tenantRepo, membershipRepo, sessionRepo };
  };

  it('registers a new user and sets up initial tenant ownership', async () => {
    const { service } = setupService();

    const result = await service.register({
      email: 'founder@vgold-store.ir',
      password: 'Strong#Password_2026',
      displayName: 'Tehran Gold Founder',
      tenantName: 'Tehran Gold Guild',
      tenantSlug: 'tehran-gold-guild',
    });

    expect(result.isOk).toBe(true);
    const { user, session, tenant, memberships } = result.unwrap();

    expect(user.email).toBe('founder@vgold-store.ir');
    expect(user.displayName).toBe('Tehran Gold Founder');
    expect((user as any).passwordHash).toBeUndefined();

    expect(session.isValid()).toBe(true);
    expect(session.id.length).toBe(64);

    expect(tenant).toBeDefined();
    expect(tenant?.slug).toBe('tehran-gold-guild');

    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe('OWNER');
    expect(memberships[0]?.tenantId).toBe(tenant?.id);
  });

  it('rejects duplicate email registrations with ConflictError', async () => {
    const { service } = setupService();

    await service.register({
      email: 'dup@v-gold.internal',
      password: 'Strong#Password_2026',
      displayName: 'User One',
    });

    const second = await service.register({
      email: 'DUP@V-GOLD.INTERNAL', // case-insensitive check
      password: 'Strong#Password_2026',
      displayName: 'User Two',
    });

    expect(second.isErr).toBe(true);
    if (second.isErr) {
      expect(second.error.code).toBe('CONFLICT');
      expect(second.error.httpStatus).toBe(409);
    }
  });

  it('authenticates user with correct credentials and returns safe DTO', async () => {
    const { service } = setupService();

    await service.register({
      email: 'member@v-gold.internal',
      password: 'Correct#Password_1',
      displayName: 'Active Member',
    });

    const loginResult = await service.login({
      email: 'member@v-gold.internal',
      password: 'Correct#Password_1',
    });

    expect(loginResult.isOk).toBe(true);
    const { user, session } = loginResult.unwrap();
    expect(user.displayName).toBe('Active Member');
    expect(session.isValid()).toBe(true);
    expect((user as any).passwordHash).toBeUndefined();
  });

  it('rejects invalid password with uniform UnauthorizedError (prevents enumeration)', async () => {
    const { service } = setupService();

    await service.register({
      email: 'secure@v-gold.internal',
      password: 'Correct#Password_1',
      displayName: 'Secure User',
    });

    const badPass = await service.login({
      email: 'secure@v-gold.internal',
      password: 'WrongPassword!',
    });
    expect(badPass.isErr).toBe(true);
    if (badPass.isErr) {
      expect(badPass.error.code).toBe('UNAUTHORIZED');
      expect(badPass.error.message).toBe('Invalid email or password.');
    }

    const badEmail = await service.login({
      email: 'nonexistent@v-gold.internal',
      password: 'AnyPassword!',
    });
    expect(badEmail.isErr).toBe(true);
    if (badEmail.isErr) {
      expect(badEmail.error.code).toBe('UNAUTHORIZED');
      // Uniform error message
      expect(badEmail.error.message).toBe('Invalid email or password.');
    }
  });

  it('revokes session on logout and denies subsequent authentication', async () => {
    const { service } = setupService();

    const reg = await service.register({
      email: 'logout-test@v-gold.internal',
      password: 'Password#2026',
      displayName: 'Logout User',
    });
    const { session } = reg.unwrap();

    expect(await service.authenticate(session.id)).not.toBeNull();

    // Logout
    await service.logout(session.id);

    // Subsequent authentication must fail
    expect(await service.authenticate(session.id)).toBeNull();
  });

  it('verifies secure HttpOnly SameSite cookie configuration', () => {
    const cookie = createSessionCookieConfig('random-session-token-1234567890');
    expect(cookie.name).toBe(SESSION_COOKIE_NAME);
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('lax');
    expect(cookie.path).toBe('/');
    expect(cookie.maxAge).toBe(7 * 24 * 60 * 60);

    const clearCookie = createClearSessionCookieConfig();
    expect(clearCookie.maxAge).toBe(0);
    expect(clearCookie.value).toBe('');
  });
});
