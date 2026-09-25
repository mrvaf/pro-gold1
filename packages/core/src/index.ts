// Common primitives
export * from './common/result.js';
export * from './common/id.js';
export * from './common/id-generator.js';
export * from './common/entity.js';
export * from './common/value-object.js';
export * from './common/errors.js';

// Domain Ports
export * from './ports/repository.port.js';
export * from './ports/ai-gateway.port.js';
export * from './ports/tenant.repository.port.js';
export * from './ports/store.repository.port.js';
export * from './ports/user.repository.port.js';
export * from './ports/tenant-membership.repository.port.js';
export * from './ports/session.repository.port.js';
export * from './ports/password-hasher.port.js';
export * from './ports/id-generator.port.js';
export * from './ports/market-data-provider.port.js';
export * from './ports/market-observation.repository.port.js';
export * from './ports/market-instrument.repository.port.js';
export * from './ports/market-data-source.repository.port.js';
export * from './ports/fx-rate.repository.port.js';

// Domain Foundations (Stage 2)
export * from './domain/finance/currency.js';
export * from './domain/finance/money.js';
export * from './domain/finance/rounding-policy.js';
export * from './domain/finance/fx-rate.js';
export * from './domain/finance/currency-conversion.js';
export * from './domain/material/gold-purity.js';
export * from './domain/material/weight.js';
export * from './domain/identity/actor-reference.js';
export * from './domain/audit/audit-metadata.js';
export * from './domain/product/jewelry-identity.js';
export * from './domain/tenant/tenant.js';
export * from './domain/tenant/store.js';

// IAM Foundations (Stage 3)
export * from './domain/iam/email.js';
export * from './domain/iam/password-hash.js';
export * from './domain/iam/user.js';
export * from './domain/iam/permissions.js';
export * from './domain/iam/tenant-membership.js';
export * from './domain/iam/session.js';
export * from './domain/iam/authorization.service.js';

// Market Data Foundations (Stage 4)
export * from './domain/market-data/market-unit.js';
export * from './domain/market-data/market-data-types.js';
export * from './domain/market-data/market-data-source.js';
export * from './domain/market-data/market-instrument.js';
export * from './domain/market-data/market-price.js';
export * from './domain/market-data/market-observation.js';
export * from './domain/market-data/market-data-freshness.policy.js';
export * from './domain/market-data/market-data-ingestion.service.js';
export * from './domain/market-data/market-data-query.service.js';

// Authoritative Pricing Foundations (Stage 5)
export * from './domain/pricing/pricing-types.js';
export * from './domain/pricing/pricing-error.js';
export * from './domain/pricing/pricing-unit-converter.js';
export * from './domain/pricing/pricing-rule.js';
export * from './domain/pricing/pricing-breakdown.js';
export * from './domain/pricing/pricing-result.js';
export * from './domain/pricing/pricing-engine.js';
export * from './ports/pricing-rule.repository.port.js';
export * from './ports/pricing-result.repository.port.js';

// Catalog Foundations (Stage 6)
export * from './domain/catalog/sku.js';
export * from './domain/catalog/gemstone-specification.js';
export * from './domain/catalog/material-specification.js';
export * from './domain/catalog/jewelry-specification.js';
export * from './domain/catalog/product.js';
export * from './domain/catalog/product-variant.js';
export * from './domain/catalog/catalog-errors.js';
export * from './ports/product.repository.port.js';
export * from './ports/product-variant.repository.port.js';

// Inventory Foundations (Stage 6)
export * from './domain/inventory/inventory-location.js';
export * from './domain/inventory/inventory-status.js';
export * from './domain/inventory/inventory-movement.js';
export * from './domain/inventory/inventory-item.js';
export * from './domain/inventory/inventory-errors.js';
export * from './ports/inventory-location.repository.port.js';
export * from './ports/inventory-item.repository.port.js';
export * from './ports/inventory-movement.repository.port.js';
export * from './ports/inventory-unit-of-work.port.js';

// Seller Marketplace Foundations (Stage 7)
export * from './domain/marketplace/seller-errors.js';
export * from './domain/marketplace/seller-slug.js';
export * from './domain/marketplace/seller-status.js';
export * from './domain/marketplace/marketplace-presence.js';
export * from './domain/marketplace/seller-profile.js';
export * from './domain/marketplace/listing-status.js';
export * from './domain/marketplace/seller-listing.js';
export * from './ports/seller-profile.repository.port.js';
export * from './ports/seller-listing.repository.port.js';

// Seller OS Foundations (Stage 8)
export * from './domain/seller-os/seller-os-errors.js';
export * from './domain/seller-os/workspace-status.js';
export * from './domain/seller-os/seller-workspace.js';
export * from './domain/seller-os/seller-overview.js';
export * from './ports/seller-workspace.repository.port.js';



// AI Conversational Designer Foundations (Stage 9)
export * from './domain/ai-designer/ai-designer-errors.js';
export * from './domain/ai-designer/design-session-status.js';
export * from './domain/ai-designer/design-message.js';
export * from './domain/ai-designer/extracted-design-attributes.js';
export * from './domain/ai-designer/design-session.js';
export * from './ports/design-session.repository.port.js';

// AI Concept Generation Foundations (Stage 10)
export * from './domain/ai-designer/concept-errors.js';
export * from './domain/ai-designer/token-accounting.js';
export * from './domain/ai-designer/concept-status.js';
export * from './domain/ai-designer/design-concept.js';
export * from './ports/design-concept.repository.port.js';

// Visual Search Foundations (Stage 11)
export * from './domain/visual-search/visual-search-errors.js';
export * from './domain/visual-search/feature-vector.js';
export * from './domain/visual-search/visual-search-image.js';
export * from './domain/visual-search/visual-search-result.js';
export * from './ports/visual-search.port.js';

// Budget-Aware Design Engine (Stage 12)
export * from './domain/budget-engine/budget-errors.js';
export * from './domain/budget-engine/viable-configuration.js';
export * from './domain/budget-engine/budget-aware-pricing-engine.js';
