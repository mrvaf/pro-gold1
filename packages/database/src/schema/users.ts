import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRecord = typeof usersTable.$inferSelect;
export type InsertUserRecord = typeof usersTable.$inferInsert;
