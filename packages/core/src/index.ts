// Common primitives
export * from './common/result.js';
export * from './common/id.js';
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

// Domain Foundations (Stage 2)
export * from './domain/finance/currency.js';
export * from './domain/finance/money.js';
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
