import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as channelsPost, GET as channelsGet } from '@/app/api/v1/social/channels/route';
import { POST as postsPost, GET as postsGet } from '@/app/api/v1/social/posts/route';
import { POST as publishPost } from '@/app/api/v1/social/posts/[id]/publish/route';
import * as authModule from '@/lib/auth/request-auth';
import { getSocialCommerceService } from '@/lib/social-commerce/social-commerce-container';

describe('Stage 19 — Social Commerce & Multi-Platform Publishing REST API', () => {
  it('connects a channel, schedules a post, and publishes it via mock social adapter', async () => {
    vi.spyOn(authModule, 'authenticateRequest').mockResolvedValue({
      ok: true,
      tenantId: 'tenant_soc_1',
      actorId: 'usr_soc_1',
      identity: {} as any,
      membership: {} as any,
    });

    // 1. Connect Channel
    const reqChannel = new NextRequest('http://localhost:3000/api/v1/social/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'INSTAGRAM',
        channelName: 'Tehran Gold Official IG',
        accessToken: 'EAAB_test_mock_oauth_token',
        accountId: 'ig_act_001',
      }),
    });

    const resChannel = await channelsPost(reqChannel);
    expect(resChannel.status).toBe(201);
    const channelJson = await resChannel.json();
    expect(channelJson.success).toBe(true);
    expect(channelJson.data.platform).toBe('INSTAGRAM');
    // Critical: plain access token must NOT be returned in response!
    expect(channelJson.data.accessToken).toBeUndefined();
    expect(channelJson.data.encryptedAccessToken).toBeUndefined();

    const channelId = channelJson.data.id;

    // 2. Schedule Post
    const reqSchedule = new NextRequest('http://localhost:3000/api/v1/social/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId,
        caption: 'New hand-crafted 18K Yellow Gold Bangle. #luxury #gold',
        mediaUrls: ['https://cdn.example.com/bangle1.png'],
        scheduledAt: new Date(Date.now() - 1000).toISOString(),
      }),
    });

    const resSchedule = await postsPost(reqSchedule);
    expect(resSchedule.status).toBe(201);
    const postJson = await resSchedule.json();
    expect(postJson.success).toBe(true);
    expect(postJson.data.status).toBe('SCHEDULED');

    const postId = postJson.data.id;

    // 3. Publish Post
    const reqPublish = new NextRequest(
      `http://localhost:3000/api/v1/social/posts/${postId}/publish`,
      {
        method: 'POST',
      }
    );

    const resPublish = await publishPost(reqPublish, {
      params: Promise.resolve({ id: postId }),
    });
    expect(resPublish.status).toBe(200);
    const publishJson = await resPublish.json();
    expect(publishJson.success).toBe(true);
    expect(publishJson.data.status).toBe('PUBLISHED');
    expect(publishJson.data.externalPostId).toContain('instagram_post_');
  });

  it('rejects forbidden identity inputs in request body with 400', async () => {
    vi.spyOn(authModule, 'authenticateRequest').mockResolvedValue({
      ok: true,
      tenantId: 'tenant_soc_1',
      actorId: 'usr_soc_1',
      identity: {} as any,
      membership: {} as any,
    });

    const reqChannel = new NextRequest('http://localhost:3000/api/v1/social/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: 'attacker_tenant', // Forbidden client identity spoofing
        platform: 'INSTAGRAM',
        channelName: 'Spoofed Channel',
        accessToken: 'EAAB_token',
      }),
    });

    const resChannel = await channelsPost(reqChannel);
    expect(resChannel.status).toBe(400);
    const body = await resChannel.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
