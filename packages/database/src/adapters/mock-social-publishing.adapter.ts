import type {
  SocialPublishingPort,
  PublishResult,
  PublishingPlatform,
} from '@v-gold/core';

export class MockSocialPublishingAdapter implements SocialPublishingPort {
  public publishedCalls: Array<{
    platform: PublishingPlatform;
    plainAccessToken: string;
    caption: string;
    mediaUrls: string[];
    accountId?: string | undefined;
  }> = [];

  public shouldFail = false;
  public failureErrorMessage = 'Mock social publishing service failure';

  async publishPost(params: {
    platform: PublishingPlatform;
    plainAccessToken: string;
    caption: string;
    mediaUrls: string[];
    accountId?: string | undefined;
  }): Promise<PublishResult> {
    this.publishedCalls.push(params);

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureErrorMessage,
      };
    }

    const externalId = `${params.platform.toLowerCase()}_post_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      externalPostId: externalId,
    };
  }
}
