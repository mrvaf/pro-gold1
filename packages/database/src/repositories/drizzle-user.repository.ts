import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  type UserRepositoryPort,
  User,
  createEntityId,
  type UserId,
  type UserStatus,
  Email,
  PasswordHash,
  AuditMetadata,
} from '@v-gold/core';
import { usersTable, type UserRecord } from '../schema/users.js';

export const toDomainUser = (record: UserRecord): User => {
  const email = Email.create(record.email).unwrap();
  const passwordHash = PasswordHash.create(record.passwordHash).unwrap();
  const audit = AuditMetadata.fromDates(record.createdAt, record.updatedAt);

  return User.reconstitute(
    createEntityId<UserId>(record.id),
    email,
    record.displayName,
    passwordHash,
    record.status as UserStatus,
    audit
  );
};

export const toDatabaseUser = (user: User): UserRecord => {
  return {
    id: user.id,
    email: user.email.value,
    displayName: user.displayName,
    passwordHash: user.passwordHash.value,
    status: user.status,
    createdAt: user.audit.createdAt,
    updatedAt: user.audit.updatedAt,
  };
};

export class DrizzleUserRepository implements UserRepositoryPort {
  constructor(private readonly db: PgDatabase<any, any, any>) {}

  async findById(id: UserId): Promise<User | null> {
    const results = await this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    const record = results[0];
    return record ? toDomainUser(record) : null;
  }

  async findByEmail(email: Email): Promise<User | null> {
    const results = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.value))
      .limit(1);
    const record = results[0];
    return record ? toDomainUser(record) : null;
  }

  async save(user: User): Promise<void> {
    const record = toDatabaseUser(user);
    await this.db
      .insert(usersTable)
      .values(record)
      .onConflictDoUpdate({
        target: usersTable.id,
        set: {
          email: record.email,
          displayName: record.displayName,
          passwordHash: record.passwordHash,
          status: record.status,
          updatedAt: record.updatedAt,
        },
      });
  }

  async delete(id: UserId): Promise<void> {
    await this.db.delete(usersTable).where(eq(usersTable.id, id));
  }
}
