import crypto from 'node:crypto';
import {
  type UserRepositoryPort,
  type TenantRepositoryPort,
  type TenantMembershipRepositoryPort,
  type SessionRepositoryPort,
  type PasswordHasherPort,
  User,
  type UserDto,
  Email,
  PasswordHash,
  Tenant,
  TenantMembership,
  Session,
  type SessionId,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
  type DomainError,
  err,
  ok,
  type Result,
  ActorReference,
} from '@v-gold/core';
import {
  InMemoryUserRepository,
  InMemoryTenantRepository,
  InMemoryTenantMembershipRepository,
  InMemorySessionRepository,
  ScryptPasswordHasher,
} from '@v-gold/database';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  tenantName?: string;
  tenantSlug?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface AuthSuccessResult {
  user: UserDto;
  session: Session;
  tenant?: Tenant;
  memberships: readonly TenantMembership[];
}

export interface AuthenticatedIdentity {
  user: UserDto;
  session: Session;
  memberships: readonly TenantMembership[];
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly tenantRepo: TenantRepositoryPort,
    private readonly membershipRepo: TenantMembershipRepositoryPort,
    private readonly sessionRepo: SessionRepositoryPort,
    private readonly passwordHasher: PasswordHasherPort
  ) {}

  async register(input: RegisterInput): Promise<Result<AuthSuccessResult, DomainError>> {
    // 1. Validate Email
    const emailResult = Email.create(input.email);
    if (emailResult.isErr) {
      return err(emailResult.error);
    }
    const email = emailResult.value;

    // 2. Check for duplicate email
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      return err(new ConflictError('A user with this email address already exists.'));
    }

    // 3. Hash password
    let hashString: string;
    try {
      hashString = await this.passwordHasher.hash(input.password);
    } catch (e) {
      return err(e instanceof Error ? (e as DomainError) : new ConflictError(String(e)));
    }
    const passwordHash = PasswordHash.create(hashString).unwrap();

    // 4. Create User entity
    const userResult = User.create({
      email,
      displayName: input.displayName,
      passwordHash,
    });
    if (userResult.isErr) {
      return err(userResult.error);
    }
    const user = userResult.value;
    await this.userRepo.save(user);

    const userActor = ActorReference.user(user.id).unwrap();
    let createdTenant: Tenant | undefined;
    const memberships: TenantMembership[] = [];

    // 5. Optional Initial Tenant Creation
    if (input.tenantName && input.tenantSlug) {
      const tenantResult = Tenant.create({
        name: input.tenantName,
        slug: input.tenantSlug,
        actor: userActor,
      });
      if (tenantResult.isErr) {
        return err(tenantResult.error);
      }
      createdTenant = tenantResult.value;
      await this.tenantRepo.save(createdTenant);

      // Create OWNER membership
      const membershipResult = TenantMembership.create({
        tenantId: createdTenant.id,
        userId: user.id,
        role: 'OWNER',
        actor: userActor,
      });
      if (membershipResult.isErr) {
        return err(membershipResult.error);
      }
      const membership = membershipResult.value;
      await this.membershipRepo.save(membership);
      memberships.push(membership);
    }

    // 6. Create Server-side Session
    const randomToken = crypto.randomBytes(32).toString('hex');
    const sessionResult = Session.create({
      id: randomToken,
      userId: user.id,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
    if (sessionResult.isErr) {
      return err(sessionResult.error);
    }
    const session = sessionResult.value;
    await this.sessionRepo.save(session);

    return ok({
      user: user.toDto(),
      session,
      tenant: createdTenant,
      memberships,
    });
  }

  async login(input: LoginInput): Promise<Result<AuthSuccessResult, DomainError>> {
    const emailResult = Email.create(input.email);
    if (emailResult.isErr) {
      // Use uniform error message to prevent user enumeration
      return err(new UnauthorizedError('Invalid email or password.'));
    }

    const user = await this.userRepo.findByEmail(emailResult.value);
    if (!user) {
      return err(new UnauthorizedError('Invalid email or password.'));
    }

    const isPasswordValid = await this.passwordHasher.verify(
      input.password,
      user.passwordHash.value
    );
    if (!isPasswordValid) {
      return err(new UnauthorizedError('Invalid email or password.'));
    }

    if (user.status !== 'ACTIVE') {
      return err(new ForbiddenError('User account is currently suspended.'));
    }

    // Stage 8.2 (ADR-0044): transparently upgrade legacy hash parameters
    // (e.g. scrypt N=2^14) to the current policy after successful login.
    if (this.passwordHasher.needsRehash?.(user.passwordHash.value)) {
      const upgradedHash = await this.passwordHasher.hash(input.password);
      user.changePassword(PasswordHash.create(upgradedHash).unwrap());
      await this.userRepo.save(user);
    }

    // Create fresh session (resisting session fixation)
    const randomToken = crypto.randomBytes(32).toString('hex');
    const sessionResult = Session.create({
      id: randomToken,
      userId: user.id,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
    if (sessionResult.isErr) {
      return err(sessionResult.error);
    }
    const session = sessionResult.value;
    await this.sessionRepo.save(session);

    const memberships = await this.membershipRepo.findAllByUser(user.id);

    return ok({
      user: user.toDto(),
      session,
      memberships,
    });
  }

  async logout(sessionId: SessionId | string): Promise<Result<void, DomainError>> {
    const session = await this.sessionRepo.findById(sessionId as SessionId);
    if (session) {
      session.revoke();
      await this.sessionRepo.save(session);
    }
    return ok(undefined);
  }

  async authenticate(sessionId: SessionId | string): Promise<AuthenticatedIdentity | null> {
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length < 32) {
      return null;
    }

    const session = await this.sessionRepo.findById(sessionId as SessionId);
    if (!session || !session.isValid()) {
      return null;
    }

    session.recordActivity();
    await this.sessionRepo.save(session);

    const user = await this.userRepo.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    const memberships = await this.membershipRepo.findAllByUser(user.id);

    return {
      user: user.toDto(),
      session,
      memberships,
    };
  }

  get userRepository(): UserRepositoryPort {
    return this.userRepo;
  }

  get tenantRepository(): TenantRepositoryPort {
    return this.tenantRepo;
  }

  get membershipRepository(): TenantMembershipRepositoryPort {
    return this.membershipRepo;
  }

  get sessionRepository(): SessionRepositoryPort {
    return this.sessionRepo;
  }
}

// Global default singleton service instance for web runtime
let defaultAuthServiceInstance: AuthService | null = null;

export const getDefaultAuthService = (): AuthService => {
  if (!defaultAuthServiceInstance) {
    const userRepo = new InMemoryUserRepository();
    const tenantRepo = new InMemoryTenantRepository();
    const membershipRepo = new InMemoryTenantMembershipRepository();
    const sessionRepo = new InMemorySessionRepository();
    const passwordHasher = new ScryptPasswordHasher();

    defaultAuthServiceInstance = new AuthService(
      userRepo,
      tenantRepo,
      membershipRepo,
      sessionRepo,
      passwordHasher
    );
  }
  return defaultAuthServiceInstance;
};
