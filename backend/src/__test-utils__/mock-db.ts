// Shared mock utilities for Drizzle ORM query chain

// Creates a thenable query chain that resolves to `value` when awaited,
// and also exposes chainable builder methods (from, where, limit, etc.)
export function makeChain(value: unknown) {
  const chain: Record<string, unknown> = {};
  const asPromise = () => Promise.resolve(value);

  Object.assign(chain, {
    from: jest.fn(() => chain),
    where: jest.fn(() => chain),
    limit: jest.fn(() => Promise.resolve(value)),
    innerJoin: jest.fn(() => chain),
    orderBy: jest.fn(() => Promise.resolve(value)),
    set: jest.fn(() => chain),
    // PromiseLike — makes `await chain` resolve to value
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      asPromise().then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) => asPromise().catch(reject),
    finally: (fn: () => void) => asPromise().finally(fn),
  });

  return chain;
}

// Creates a mock DB that sequences `selectResults` across consecutive select() calls.
// Pass `insertReturning` as the rows returned by `.insert().values().returning()`.
export function createMockDb({
  selectResults = [] as unknown[],
  insertReturning = [] as unknown[],
  updateResult = [] as unknown[],
}: {
  selectResults?: unknown[];
  insertReturning?: unknown[];
  updateResult?: unknown[];
} = {}) {
  let selectIdx = 0;
  let insertIdx = 0;

  const mockDb = {
    select: jest.fn(() => makeChain(selectResults[selectIdx++] ?? [])),
    insert: jest.fn(() => ({
      values: jest.fn().mockReturnThis(),
      onConflictDoNothing: jest.fn(() => Promise.resolve(undefined)),
      returning: jest.fn(() => Promise.resolve(insertReturning[insertIdx++] ?? [])),
    })),
    update: jest.fn(() => ({
      set: jest.fn().mockReturnThis(),
      // where() is directly awaitable AND has .returning() for services that need it
      where: jest.fn(() => {
        const asPromise = Promise.resolve(updateResult);
        return {
          returning: jest.fn(() => Promise.resolve(updateResult)),
          then: asPromise.then.bind(asPromise),
          catch: asPromise.catch.bind(asPromise),
          finally: asPromise.finally.bind(asPromise),
        };
      }),
    })),
    transaction: jest.fn(),
  };

  return mockDb;
}

// Pre-built fixtures
export const fixtures = {
  business: {
    id: 'biz-1',
    ownerId: 'owner-1',
    name: 'The Test Bar',
    slug: 'the-test-bar-abc12',
    type: 'Bar',
    location: 'Sydney',
    resetTime: '05:00:00',
    qrActive: true,
    pointsPerScan: 10,
    pityThreshold: 7,
    pityMinTier: 'uncommon' as const,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  },
  customerBusiness: {
    id: 'cb-1',
    customerId: 'cust-1',
    businessId: 'biz-1',
    loyaltyPoints: 20,
    pityCounter: 3,
    lastSpinAt: null as string | null,
    createdAt: '2025-01-01T00:00:00Z',
  },
  reward: {
    id: 'reward-1',
    businessId: 'biz-1',
    name: 'Free Coffee',
    description: 'A delicious free coffee',
    tier: 'common' as const,
    probability: '25.00',
    stock: null,
    redeemedCount: 0,
    isActive: true,
    expiresInDays: 30,
    createdAt: '2025-01-01T00:00:00Z',
  },
  rareReward: {
    id: 'reward-2',
    businessId: 'biz-1',
    name: 'Free Bottle',
    description: null,
    tier: 'rare' as const,
    probability: '5.00',
    stock: 10,
    redeemedCount: 0,
    isActive: true,
    expiresInDays: null,
    createdAt: '2025-01-01T00:00:00Z',
  },
  spin: {
    id: 'spin-1',
    customerId: 'cust-1',
    businessId: 'biz-1',
    rewardId: null as string | null,
    spunAt: '2025-01-01T10:00:00Z',
    createdAt: '2025-01-01T10:00:00Z',
  },
  customer: {
    id: 'cust-1',
    userId: 'user-1',
    phoneNumber: '+61412345678',
    createdAt: '2025-01-01T00:00:00Z',
  },
  customerReward: {
    id: 'cr-1',
    customerId: 'cust-1',
    businessId: 'biz-1',
    rewardId: 'reward-1',
    spinId: 'spin-1',
    status: 'unclaimed' as const,
    redeemedAt: null as string | null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: '2025-01-01T00:00:00Z',
  },
};
