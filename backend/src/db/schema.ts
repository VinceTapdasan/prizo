import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  timestamp,
  time,
  unique,
  jsonb,
} from 'drizzle-orm/pg-core';

// ============================================================
// Enums
// ============================================================

export const rewardTierEnum = pgEnum('reward_tier', [
  'miss',
  'common',
  'uncommon',
  'rare',
  'epic',
]);

export const rewardStatusEnum = pgEnum('reward_status', [
  'unclaimed',
  'redeemed',
  'expired',
]);

export const userRoleEnum = pgEnum('user_role', [
  'business_owner',
  'customer',
  'superadmin',
]);

// ============================================================
// Tables
// ============================================================

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const businesses = pgTable('businesses', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type'),
  location: text('location'),
  resetTime: time('reset_time').notNull().default('05:00:00'),
  qrActive: boolean('qr_active').notNull().default(true),
  pointsPerScan: integer('points_per_scan').notNull().default(10),
  pityThreshold: integer('pity_threshold').notNull().default(7),
  pityMinTier: rewardTierEnum('pity_min_tier').notNull().default('uncommon'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  phoneNumber: text('phone_number').notNull().unique(),
  hasPassword: boolean('has_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const customerBusiness = pgTable(
  'customer_business',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    loyaltyPoints: integer('loyalty_points').notNull().default(0),
    pityCounter: integer('pity_counter').notNull().default(0),
    lastSpinAt: timestamp('last_spin_at', {
      withTimezone: true,
      mode: 'string',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique().on(t.customerId, t.businessId)],
);

export const rewards = pgTable('rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  tier: rewardTierEnum('tier').notNull(),
  probability: numeric('probability', { precision: 5, scale: 2 }).notNull(),
  stock: integer('stock'),
  redeemedCount: integer('redeemed_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  expiresInDays: integer('expires_in_days'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const spins = pgTable('spins', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  rewardId: uuid('reward_id').references(() => rewards.id, {
    onDelete: 'set null',
  }),
  spunAt: timestamp('spun_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const customerRewards = pgTable('customer_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  rewardId: uuid('reward_id')
    .notNull()
    .references(() => rewards.id, { onDelete: 'cascade' }),
  spinId: uuid('spin_id')
    .notNull()
    .references(() => spins.id, { onDelete: 'cascade' }),
  status: rewardStatusEnum('status').notNull().default('unclaimed'),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true, mode: 'string' }),
  expiresAt: timestamp('expires_at', {
    withTimezone: true,
    mode: 'string',
  }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customers.id, {
    onDelete: 'set null',
  }),
  actionType: text('action_type').notNull(), // 'SPIN' | 'REDEEM'
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

export const milestoneRewards = pgTable('milestone_rewards', {
  id: uuid('id').primaryKey().defaultRandom(),
  businessId: uuid('business_id')
    .notNull()
    .references(() => businesses.id, { onDelete: 'cascade' }),
  pointsRequired: integer('points_required').notNull(),
  rewardName: text('reward_name').notNull(),
  rewardDescription: text('reward_description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
});

// ============================================================
// Inferred types
// ============================================================

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type CustomerBusiness = typeof customerBusiness.$inferSelect;
export type Reward = typeof rewards.$inferSelect;
export type NewReward = typeof rewards.$inferInsert;
export type Spin = typeof spins.$inferSelect;
export type NewSpin = typeof spins.$inferInsert;
export type CustomerReward = typeof customerRewards.$inferSelect;
export type MilestoneReward = typeof milestoneRewards.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
