import { describe, it, expect } from 'vitest';
import {
  SecureCredentialVault,
  PublishingChannel,
  PublishingPost,
  InvalidPublishingChannelError,
  PublishingPostValidationError,
  InvalidPostStateTransitionError,
  EncryptionError,
} from '@v-gold/core';

describe('Stage 19 — Social Commerce Domain & AES-256-GCM Vault', () => {
  it('encrypts and decrypts access tokens safely using AES-256-GCM', () => {
    const vault = new SecureCredentialVault();
    const token = 'EAAX_instagram_ultra_secret_access_token_1234567890';

    const encrypted = vault.encrypt(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted).toContain(':'); // iv:authTag:cipher

    const decrypted = vault.decrypt(encrypted);
    expect(decrypted).toBe(token);
  });

  it('fails to decrypt if payload has been tampered with or is corrupted', () => {
    const vault = new SecureCredentialVault();
    const token = 'telegram_bot_token_secret_abcdef';
    const encrypted = vault.encrypt(token);

    const parts = encrypted.split(':');
    // Tamper with encrypted bytes
    const tamperedCipher = parts[2]!.substring(0, parts[2]!.length - 2) + 'aa';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => vault.decrypt(tamperedPayload)).toThrow(EncryptionError);
  });

  it('rejects master keys with invalid length', () => {
    expect(() => new SecureCredentialVault('too_short_key')).toThrow(EncryptionError);
  });

  it('creates valid publishing channels and validates invariants', () => {
    const channel = PublishingChannel.create({
      id: 'chn_1',
      tenantId: 'tenant_gold_1' as any,
      platform: 'INSTAGRAM',
      channelName: 'Tehran Gold Official',
      encryptedAccessToken: 'iv:tag:ciphertext',
      accountId: 'act_insta_100',
    });

    expect(channel.id).toBe('chn_1');
    expect(channel.platform).toBe('INSTAGRAM');
    expect(channel.isActive).toBe(true);
    expect(channel.accountId).toBe('act_insta_100');

    expect(() =>
      PublishingChannel.create({
        id: '',
        tenantId: 'tenant_gold_1' as any,
        platform: 'INSTAGRAM',
        channelName: 'Channel',
        encryptedAccessToken: 'token',
      })
    ).toThrow(InvalidPublishingChannelError);
  });

  it('manages post lifecycle transitions strictly: SCHEDULED -> PUBLISHING -> PUBLISHED/FAILED', () => {
    const post = PublishingPost.create({
      id: 'post_1',
      tenantId: 'tenant_gold_1' as any,
      channelId: 'chn_1',
      caption: 'Exclusive 18K Yellow Gold Ring available now! #gold #jewelry',
      mediaUrls: ['https://cdn.example.com/ring.jpg'],
      scheduledAt: new Date(Date.now() + 3600000),
    });

    expect(post.status).toBe('SCHEDULED');

    // Transition to PUBLISHING
    post.markPublishing();
    expect(post.status).toBe('PUBLISHING');

    // Cannot transition directly back to SCHEDULED
    expect(() => post.markPublishing()).toThrow(InvalidPostStateTransitionError);

    // Transition to PUBLISHED
    post.markPublished('ext_ig_post_999');
    expect(post.status).toBe('PUBLISHED');
    expect(post.externalPostId).toBe('ext_ig_post_999');
    expect(post.publishedAt).toBeDefined();

    // Re-publishing or failing a published post is prohibited
    expect(() => post.markFailed('network error')).toThrow(InvalidPostStateTransitionError);
  });
});
