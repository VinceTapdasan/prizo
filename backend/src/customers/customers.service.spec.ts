import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { DrizzleService } from '../db/drizzle.service';
import { createMockDb, makeChain, fixtures } from '../__test-utils__/mock-db';

describe('CustomersService', () => {
  let service: CustomersService;
  let mockDrizzle: { db: ReturnType<typeof createMockDb> };

  function setDb(overrides: Parameters<typeof createMockDb>[0] = {}) {
    mockDrizzle.db = createMockDb(overrides);
    (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;
  }

  beforeEach(async () => {
    mockDrizzle = { db: createMockDb() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: DrizzleService, useValue: mockDrizzle },
      ],
    }).compile();
    service = module.get<CustomersService>(CustomersService);
  });

  // ─── findOrCreateByPhone ──────────────────────────────────────────────────

  describe('findOrCreateByPhone', () => {
    it('returns the existing customer without creating', async () => {
      setDb({ selectResults: [[fixtures.customer]], insertReturning: [] });
      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');

      const result = await service.findOrCreateByPhone('+61412345678');

      expect(result).toEqual(fixtures.customer);
      expect(insertSpy).not.toHaveBeenCalled();
    });

    it('creates and returns a new customer when not found', async () => {
      setDb({ selectResults: [[]], insertReturning: [[fixtures.customer]] });

      const result = await service.findOrCreateByPhone('+61412345678', 'user-1');
      expect(result).toEqual(fixtures.customer);
    });

    it('passes userId when provided on creation', async () => {
      setDb({ selectResults: [[]], insertReturning: [[fixtures.customer]] });
      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');

      await service.findOrCreateByPhone('+61412345678', 'user-abc');

      const valuesCall = (insertSpy.mock.results[0].value.values as jest.Mock).mock.calls[0][0];
      expect(valuesCall.userId).toBe('user-abc');
    });

    it('passes null userId when not provided', async () => {
      setDb({ selectResults: [[]], insertReturning: [[fixtures.customer]] });
      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');

      await service.findOrCreateByPhone('+61400000000');

      const valuesCall = (insertSpy.mock.results[0].value.values as jest.Mock).mock.calls[0][0];
      expect(valuesCall.userId).toBeNull();
    });
  });

  // ─── getLoyaltyForBusiness ────────────────────────────────────────────────

  describe('getLoyaltyForBusiness', () => {
    it('returns loyalty data and rewards for existing customer', async () => {
      const cb = { loyaltyPoints: 40, pityCounter: 2, lastSpinAt: '2025-01-01T10:00:00Z' };
      const rewards = [
        {
          id: 'cr-1',
          status: 'unclaimed',
          redeemedAt: null,
          expiresAt: '2025-02-01',
          createdAt: '2025-01-01',
          rewardName: 'Free Coffee',
          rewardTier: 'common',
          rewardDescription: null,
        },
      ];

      // First select: customer_business, second select: customer_rewards join
      let callIdx = 0;
      mockDrizzle.db.select = jest.fn(() => {
        const results = [[cb], rewards];
        const value = results[callIdx++] ?? [];
        const chain: Record<string, unknown> = {
          from: jest.fn(() => chain),
          where: jest.fn(() => chain),
          limit: jest.fn(() => Promise.resolve(value)),
          innerJoin: jest.fn(() => chain),
          orderBy: jest.fn(() => Promise.resolve(value)),
          then: (resolve: (v: unknown) => unknown) => resolve(value),
        };
        return chain;
      });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.getLoyaltyForBusiness('cust-1', 'biz-1');

      expect(result.loyalty_points).toBe(40);
      expect(result.pity_counter).toBe(2);
      expect(result.last_spin_at).toBe('2025-01-01T10:00:00Z');
      expect(result.rewards).toEqual(rewards);
    });

    it('returns zero defaults when no customer_business record exists', async () => {
      let callIdx = 0;
      mockDrizzle.db.select = jest.fn(() => {
        const results: unknown[][] = [[], []];
        const value = results[callIdx++] ?? [];
        const chain: Record<string, unknown> = {
          from: jest.fn(() => chain),
          where: jest.fn(() => chain),
          limit: jest.fn(() => Promise.resolve(value)),
          innerJoin: jest.fn(() => chain),
          orderBy: jest.fn(() => Promise.resolve(value)),
          then: (resolve: (v: unknown) => unknown) => resolve(value),
        };
        return chain;
      });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.getLoyaltyForBusiness('new-cust', 'biz-1');
      expect(result.loyalty_points).toBe(0);
      expect(result.pity_counter).toBe(0);
      expect(result.last_spin_at).toBeNull();
      expect(result.rewards).toEqual([]);
    });
  });

  // ─── redeemReward ─────────────────────────────────────────────────────────

  describe('redeemReward', () => {
    it('redeems an unclaimed, non-expired reward', async () => {
      const redeemed = { ...fixtures.customerReward, status: 'redeemed', redeemedAt: new Date().toISOString() };
      setDb({ selectResults: [[fixtures.customerReward]], updateResult: [redeemed] });

      const result = await service.redeemReward('cr-1', 'cust-1');
      expect(result.status).toBe('redeemed');
    });

    it('throws NotFoundException when reward not found or already redeemed', async () => {
      setDb({ selectResults: [[]] });
      await expect(service.redeemReward('missing-id', 'cust-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException and marks expired when reward is past expiry', async () => {
      const expiredReward = {
        ...fixtures.customerReward,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // yesterday
      };
      setDb({ selectResults: [[expiredReward]], updateResult: [{ ...expiredReward, status: 'expired' }] });

      await expect(service.redeemReward('cr-1', 'cust-1')).rejects.toThrow(NotFoundException);
      // The update to set status='expired' should be called
      expect(mockDrizzle.db.update).toHaveBeenCalled();
    });

    it('sets redeemedAt timestamp on successful redemption', async () => {
      const redeemed = { ...fixtures.customerReward, status: 'redeemed', redeemedAt: new Date().toISOString() };
      setDb({ selectResults: [[fixtures.customerReward]], updateResult: [redeemed] });
      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');

      await service.redeemReward('cr-1', 'cust-1');

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock.calls[0][0];
      expect(setArgs.status).toBe('redeemed');
      expect(setArgs.redeemedAt).toBeDefined();
    });

    it('does not allow redemption after expiry date', async () => {
      const expiredReward = {
        ...fixtures.customerReward,
        expiresAt: '2020-01-01T00:00:00Z', // far in the past
      };
      setDb({ selectResults: [[expiredReward]], updateResult: [] });

      await expect(service.redeemReward('cr-1', 'cust-1')).rejects.toThrow('expired');
    });
  });

  // ─── getCustomersForBusiness ──────────────────────────────────────────────

  describe('getCustomersForBusiness', () => {
    it('returns enriched customer list ordered by loyalty points', async () => {
      const rows = [
        {
          id: 'cb-1',
          loyaltyPoints: 100,
          pityCounter: 0,
          lastSpinAt: '2025-01-10',
          createdAt: '2025-01-01',
          phoneNumber: '+61412345678',
          customerCreatedAt: '2025-01-01',
        },
      ];
      const chain: Record<string, unknown> = {
        from: jest.fn(() => chain),
        where: jest.fn(() => chain),
        innerJoin: jest.fn(() => chain),
        orderBy: jest.fn(() => Promise.resolve(rows)),
        then: (resolve: (v: unknown) => unknown) => resolve(rows),
      };
      mockDrizzle.db.select = jest.fn(() => chain);
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.getCustomersForBusiness('biz-1');
      expect(result).toEqual(rows);
    });

    it('returns empty array when no customers exist', async () => {
      const chain: Record<string, unknown> = {
        from: jest.fn(() => chain),
        where: jest.fn(() => chain),
        innerJoin: jest.fn(() => chain),
        orderBy: jest.fn(() => Promise.resolve([])),
        then: (resolve: (v: unknown) => unknown) => resolve([]),
      };
      mockDrizzle.db.select = jest.fn(() => chain);
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.getCustomersForBusiness('biz-empty');
      expect(result).toEqual([]);
    });
  });

  // ─── getAllRewards ─────────────────────────────────────────────────────────

  describe('getAllRewards', () => {
    it('returns customer rewards across all businesses with joins', async () => {
      const rows = [
        {
          id: 'cr-1',
          status: 'unclaimed',
          redeemedAt: null,
          expiresAt: '2025-06-01',
          createdAt: '2025-01-01',
          rewardName: 'Free Coffee',
          rewardTier: 'common',
          rewardDescription: null,
          businessName: 'The Test Bar',
          businessSlug: 'the-test-bar-abc12',
        },
      ];
      const chain: Record<string, unknown> = {
        from: jest.fn(() => chain),
        where: jest.fn(() => chain),
        innerJoin: jest.fn(() => chain),
        orderBy: jest.fn(() => Promise.resolve(rows)),
        then: (resolve: (v: unknown) => unknown) => resolve(rows),
      };
      mockDrizzle.db.select = jest.fn(() => chain);
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.getAllRewards('cust-1');
      expect(result).toEqual(rows);
      expect(result[0]).toHaveProperty('businessName');
      expect(result[0]).toHaveProperty('businessSlug');
    });
  });
});
