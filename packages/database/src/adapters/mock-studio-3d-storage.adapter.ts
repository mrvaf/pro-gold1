import type {
  Studio3DStoragePort,
  Signed3DAssetUrlOptions,
} from '@v-gold/core';

export class MockStudio3DStorageAdapter implements Studio3DStoragePort {
  private readonly baseUrl: string;

  constructor(baseUrl = 'https://assets.vgold.test/3d') {
    this.baseUrl = baseUrl;
  }

  async generateSignedDownloadUrl(
    storageKey: string,
    options: Signed3DAssetUrlOptions = {}
  ): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 900);
    return `${this.baseUrl}/${storageKey}?token=mock_download_token_${expires}&expires=${expires}`;
  }

  async generateSignedUploadUrl(
    storageKey: string,
    mimeType: string,
    options: Signed3DAssetUrlOptions = {}
  ): Promise<{
    uploadUrl: string;
    storageKey: string;
    expiresAt: Date;
  }> {
    const expiresIn = options.expiresInSeconds ?? 900;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    return {
      uploadUrl: `${this.baseUrl}/upload/${storageKey}?token=mock_upload_token&mime=${encodeURIComponent(mimeType)}`,
      storageKey,
      expiresAt,
    };
  }

  async deleteAsset(_storageKey: string): Promise<void> {
    // mock delete: no-op
  }
}
