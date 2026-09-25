import { describe, it, expect } from 'vitest';
import {
  ContentAsset,
  ContentGroundingValidator,
  ContentGroundingViolationError,
  createEntityId,
  type ContentAssetId,
  type TenantId,
} from '@v-gold/core';

describe('Stage 18 AI Content Studio Domain Unit Tests', () => {
  const tenantId = createEntityId<TenantId>('tenant-content-unit');
  const assetId = createEntityId<ContentAssetId>('asset-1');

  it('verifies factual grounding validator passes matching attributes and rejects hallucinations', () => {
    const validText =
      'Experience the pinnacle of luxury with our 18K Yellow Gold Solitaire ring featuring a magnificent 1.5ct Emerald centerpiece.';
    const validRes = ContentGroundingValidator.validate(validText, {
      title: 'Solitaire Emerald Ring',
      metalType: 'GOLD',
      targetKarat: 18,
      gemstone: 'Emerald',
    });
    expect(validRes.isOk).toBe(true);

    // Hallucination 1: Missing gold karat
    const missingKarat =
      'Experience the pinnacle of luxury with our Gold Solitaire ring featuring an Emerald.';
    const missingKaratRes = ContentGroundingValidator.validate(missingKarat, {
      title: 'Solitaire Emerald Ring',
      metalType: 'GOLD',
      targetKarat: 18,
      gemstone: 'Emerald',
    });
    expect(missingKaratRes.isErr).toBe(true);
    if (missingKaratRes.isErr) {
      expect(missingKaratRes.error).toBeInstanceOf(ContentGroundingViolationError);
    }

    // Hallucination 2: Missing expected gemstone
    const missingGem =
      'Experience the pinnacle of luxury with our 18K Yellow Gold Solitaire ring with fine polish.';
    const missingGemRes = ContentGroundingValidator.validate(missingGem, {
      title: 'Solitaire Emerald Ring',
      metalType: 'GOLD',
      targetKarat: 18,
      gemstone: 'Emerald',
    });
    expect(missingGemRes.isErr).toBe(true);
  });

  it('creates ContentAsset aggregate when grounded and serializes safely', () => {
    const assetRes = ContentAsset.create(assetId, {
      tenantId,
      contentType: 'SOCIAL_CAPTION',
      language: 'fa-IR',
      headline: 'انگشتر زمرد سلطنتی طلا ۱۸ عیار',
      body: 'شاهکار دست‌ساز با طلا 18k و نگین زمرد اصل زامبیا، طراحی اختصاصی استودیو وی‌گلد.',
      tags: ['#طلا_۱۸_عیار', '#زمرد', '#جواهرات_دستساز'],
      groundingAttributes: {
        title: 'انگشتر زمرد سلطنتی',
        metalType: 'طلا',
        targetKarat: 18,
        gemstone: 'زمرد',
      },
    });

    expect(assetRes.isOk).toBe(true);
    const asset = assetRes.unwrap();
    expect(asset.id).toBe(assetId);
    expect(asset.contentType).toBe('SOCIAL_CAPTION');
    expect(asset.language).toBe('fa-IR');
    expect(asset.tags?.length).toBe(3);
  });
});
