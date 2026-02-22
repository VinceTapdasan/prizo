import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { DrizzleService } from '../db/drizzle.service';
import { createMockDb, fixtures } from '../__test-utils__/mock-db';

describe('RewardsService', () => {
  let service: RewardsService;
  let mockDrizzle: { db: ReturnType<typeof createMockDb> };

  function setDb(overrides: Parameters<typeof createMockDb>[0] = {}) {
    mockDrizzle.db = createMockDb(overrides);
    (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;
  }

  beforeEach(async () => {
    mockDrizzle = { db: createMockDb() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RewardsService,
        { provide: DrizzleService, useValue: mockDrizzle },
      ],
    }).compile();
    service = module.get<RewardsService>(RewardsService);
  });

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and returns the reward', async () => {
      setDb({ insertReturning: [[fixtures.reward]] });

      const result = await service.create('biz-1', {
        name: 'Free Coffee',
        tier: 'common',
        probability: 25,
      });
      expect(result).toEqual(fixtures.reward);
    });

    it('stores probability as a string (numeric type)', async () => {
      setDb({ insertReturning: [[fixtures.reward]] });
      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');

      await service.create('biz-1', {
        name: 'Free Coffee',
        tier: 'common',
        probability: 25.5,
      });

      const valuesCall = (insertSpy.mock.results[0].value.values as jest.Mock)
        .mock.calls[0][0];
      expect(typeof valuesCall.probability).toBe('string');
      expect(valuesCall.probability).toBe('25.5');
    });

    it('passes optional fields (stock, expires_in_days, description)', async () => {
      setDb({
        insertReturning: [
          [{ ...fixtures.reward, stock: 10, expiresInDays: 30 }],
        ],
      });
      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');

      await service.create('biz-1', {
        name: 'Free Coffee',
        tier: 'common',
        probability: 25,
        stock: 10,
        expires_in_days: 30,
        description: 'A delicious coffee',
      });

      const valuesCall = (insertSpy.mock.results[0].value.values as jest.Mock)
        .mock.calls[0][0];
      expect(valuesCall.stock).toBe(10);
      expect(valuesCall.expiresInDays).toBe(30);
      expect(valuesCall.description).toBe('A delicious coffee');
    });

    it('omits optional fields when not provided', async () => {
      setDb({ insertReturning: [[fixtures.reward]] });
      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');

      await service.create('biz-1', {
        name: 'Free Coffee',
        tier: 'common',
        probability: 25,
      });

      const valuesCall = (insertSpy.mock.results[0].value.values as jest.Mock)
        .mock.calls[0][0];
      expect(valuesCall.stock).toBeUndefined();
      expect(valuesCall.expiresInDays).toBeUndefined();
    });
  });

  // ─── findByBusiness ───────────────────────────────────────────────────────

  describe('findByBusiness', () => {
    it('returns all rewards for the business', async () => {
      const rewards = [fixtures.reward, fixtures.rareReward];
      setDb({ selectResults: [rewards] });

      const result = await service.findByBusiness('biz-1');
      expect(result).toEqual(rewards);
    });

    it('returns an empty array when no rewards exist', async () => {
      setDb({ selectResults: [[]] });
      const result = await service.findByBusiness('biz-1');
      expect(result).toEqual([]);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the reward', async () => {
      const updated = { ...fixtures.reward, probability: '10.00', stock: 5 };
      setDb({ updateResult: [updated] });

      const result = await service.update('reward-1', {
        probability: 10,
        stock: 5,
      });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when reward not found', async () => {
      setDb({ updateResult: [] });
      await expect(
        service.update('missing-id', { probability: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('can set stock to null (unlimited)', async () => {
      const updated = { ...fixtures.reward, stock: null };
      setDb({ updateResult: [updated] });
      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');

      await service.update('reward-1', { stock: null });

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock
        .calls[0][0];
      expect(setArgs).toHaveProperty('stock', null);
    });

    it('can set expires_in_days to null (never expires)', async () => {
      const updated = { ...fixtures.reward, expiresInDays: null };
      setDb({ updateResult: [updated] });
      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');

      await service.update('reward-1', { expires_in_days: null });

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock
        .calls[0][0];
      expect(setArgs).toHaveProperty('expiresInDays', null);
    });

    it('can deactivate via update (is_active: false)', async () => {
      const updated = { ...fixtures.reward, isActive: false };
      setDb({ updateResult: [updated] });
      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');

      await service.update('reward-1', { is_active: false });

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock
        .calls[0][0];
      expect(setArgs).toHaveProperty('isActive', false);
    });

    it('only includes provided fields in the update set', async () => {
      setDb({ updateResult: [fixtures.reward] });
      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');

      await service.update('reward-1', { name: 'New Name' });

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock
        .calls[0][0];
      expect(setArgs).toHaveProperty('name', 'New Name');
      expect(setArgs).not.toHaveProperty('probability');
      expect(setArgs).not.toHaveProperty('stock');
    });
  });

  // ─── deactivate ───────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('sets isActive to false and returns the reward', async () => {
      const deactivated = { ...fixtures.reward, isActive: false };
      setDb({ updateResult: [deactivated] });

      const result = await service.deactivate('reward-1');
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException when reward not found', async () => {
      setDb({ updateResult: [] });
      await expect(service.deactivate('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('passes isActive=false in the update payload', async () => {
      setDb({ updateResult: [fixtures.reward] });
      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');

      await service.deactivate('reward-1');

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock
        .calls[0][0];
      expect(setArgs).toEqual({ isActive: false });
    });
  });
});
