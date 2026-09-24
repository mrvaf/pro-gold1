import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { Session, createEntityId, type UserId } from '@v-gold/core';
import { InMemorySessionRepository } from '@v-gold/database';

describe('Server-side Session Lifecycle', () => {
  const userId = createEntityId<UserId>('user-100');

  it('creates active session with cryptographically random token', () => {
    const randomId = crypto.randomBytes(32).toString('hex');
    const session = Session.create({
      id: randomId,
      userId,
      userAgent: 'Mozilla/5.0 TestBrowser',
      ipAddress: '127.0.0.1',
    }).unwrap();

    expect(session.id).toBe(randomId);
    expect(session.userId).toBe(userId);
    expect(session.isValid()).toBe(true);
    expect(session.isRevoked()).toBe(false);
    expect(session.isExpired()).toBe(false);
    expect(session.userAgent).toBe('Mozilla/5.0 TestBrowser');
    expect(session.ipAddress).toBe('127.0.0.1');
  });

  it('rejects predictable or excessively short session identifiers', () => {
    expect(Session.create({ id: 'short-id', userId }).isErr).toBe(true);
    expect(Session.create({ id: '', userId }).isErr).toBe(true);
  });

  it('handles explicit session revocation', () => {
    const randomId = crypto.randomBytes(32).toString('hex');
    const session = Session.create({ id: randomId, userId }).unwrap();

    expect(session.isValid()).toBe(true);
    session.revoke();

    expect(session.isRevoked()).toBe(true);
    expect(session.isValid()).toBe(false);
  });

  it('detects expired sessions based on expiration time', () => {
    const randomId = crypto.randomBytes(32).toString('hex');
    // TTL of 100ms
    const session = Session.create({ id: randomId, userId, ttlMs: 100 }).unwrap();

    expect(session.isExpired(new Date())).toBe(false);

    // Simulated future time (+1000ms)
    const future = new Date(Date.now() + 1000);
    expect(session.isExpired(future)).toBe(true);
    expect(session.isValid(future)).toBe(false);
  });

  it('persists sessions and purges expired entries via InMemorySessionRepository', async () => {
    const repo = new InMemorySessionRepository();
    const token1 = crypto.randomBytes(32).toString('hex');
    const token2 = crypto.randomBytes(32).toString('hex');

    const activeSession = Session.create({ id: token1, userId, ttlMs: 100000 }).unwrap();
    const expiredSession = Session.create({ id: token2, userId, ttlMs: -1000 }).unwrap();

    await repo.save(activeSession);
    await repo.save(expiredSession);

    const userSessions = await repo.findAllByUserId(userId);
    expect(userSessions).toHaveLength(2);

    // Purge expired sessions
    const purgedCount = await repo.deleteExpired(new Date());
    expect(purgedCount).toBe(1);

    expect(await repo.findById(activeSession.id)).not.toBeNull();
    expect(await repo.findById(expiredSession.id)).toBeNull();
  });
});
