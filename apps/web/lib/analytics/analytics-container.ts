import { createPersistence } from '@v-gold/database';
import { AnalyticsService } from './analytics-service';

let sharedAnalyticsService: AnalyticsService | null = null;

export function getAnalyticsService(): AnalyticsService {
  if (!sharedAnalyticsService) {
    const persistence = createPersistence();
    sharedAnalyticsService = new AnalyticsService(persistence.analyticsRepository);
  }
  return sharedAnalyticsService;
}
