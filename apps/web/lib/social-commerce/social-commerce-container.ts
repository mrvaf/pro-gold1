import { createPersistence } from '@v-gold/database';
import { SocialCommerceService } from './social-commerce-service';


let sharedSocialCommerceService: SocialCommerceService | null = null;

export function getSocialCommerceService(): SocialCommerceService {
  if (!sharedSocialCommerceService) {
    const persistence = createPersistence();
    sharedSocialCommerceService = new SocialCommerceService(
      persistence.socialCommerceRepository,
      persistence.socialPublishing
    );
  }
  return sharedSocialCommerceService;
}
