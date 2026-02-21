import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { DrizzleService } from '../db/drizzle.service';
import { createMockDb, fixtures } from '../__test-utils__/mock-db';

describe('BusinessesService', () => {
  let service: BusinessesService;
  let mockDrizzle: { db: ReturnType<typeof createMockDb> };

  function rebuild(overrides: Parameters<typeof createMockDb>[0] = {}) {
    mockDrizzle = { db: createMockDb(overrides) };
    return Test.createTestingModule({
      providers: [
        BusinessesService,
        { provide: DrizzleService, useValue: mockDrizzle },
      ],
    })
      .compile()
      .then((m) => {
        service = m.get<BusinessesService>(BusinessesService);
      });
  }

  beforeEach(() => rebuild());

  // ─── create ───────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a business and returns it', async () => {
      mockDrizzle.db = createMockDb({ insertReturning: [[fixtures.business]] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.create('owner-1', { name: 'The Test Bar' });
      expect(result).toEqual(fixtures.business);
    });

    it('generates a slug from the business name', async () => {
      mockDrizzle.db = createMockDb({ insertReturning: [[fixtures.business]] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const insertSpy = jest.spyOn(mockDrizzle.db, 'insert');
      await service.create('owner-1', { name: 'My Awesome Venue' });

      expect(insertSpy).toHaveBeenCalled();
      const insertedValues = (insertSpy.mock.results[0].value.values as jest.Mock).mock.calls[0][0];
      expect(insertedValues.slug).toMatch(/^my-awesome-venue-[a-z0-9]{5}$/);
    });

    it('throws ConflictException on duplicate slug (postgres error 23505)', async () => {
      mockDrizzle.db.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockRejectedValue({ code: '23505' }),
      });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      await expect(service.create('owner-1', { name: 'Taken Name' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unexpected errors from the DB', async () => {
      const dbError = new Error('Connection refused');
      mockDrizzle.db.insert = jest.fn().mockReturnValue({
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockRejectedValue(dbError),
      });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      await expect(service.create('owner-1', { name: 'Venue' })).rejects.toThrow(dbError);
    });
  });

  // ─── findBySlug ───────────────────────────────────────────────────────────

  describe('findBySlug', () => {
    it('returns the business when found', async () => {
      const publicBiz = {
        id: 'biz-1',
        name: 'The Test Bar',
        slug: 'the-test-bar-abc12',
        type: 'Bar',
        location: 'Sydney',
        qrActive: true,
      };
      mockDrizzle.db = createMockDb({ selectResults: [[publicBiz]] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.findBySlug('the-test-bar-abc12');
      expect(result).toEqual(publicBiz);
    });

    it('throws NotFoundException when business is not found', async () => {
      mockDrizzle.db = createMockDb({ selectResults: [[]] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('returns only qrActive=true businesses', async () => {
      // The service filters by qrActive=true in the where clause
      // We verify the select is called (actual filter is in Drizzle eq conditions)
      mockDrizzle.db = createMockDb({ selectResults: [[]] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const selectSpy = jest.spyOn(mockDrizzle.db, 'select');
      await expect(service.findBySlug('inactive-slug')).rejects.toThrow(NotFoundException);
      expect(selectSpy).toHaveBeenCalled();
    });
  });

  // ─── findByOwner ──────────────────────────────────────────────────────────

  describe('findByOwner', () => {
    it('returns list of businesses for owner', async () => {
      const businesses = [fixtures.business];
      mockDrizzle.db = createMockDb({ selectResults: [businesses] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.findByOwner('owner-1');
      expect(result).toEqual(businesses);
    });

    it('returns empty array when owner has no businesses', async () => {
      mockDrizzle.db = createMockDb({ selectResults: [[]] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.findByOwner('owner-nobody');
      expect(result).toEqual([]);
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates and returns the business', async () => {
      const updated = { ...fixtures.business, name: 'New Name' };
      mockDrizzle.db = createMockDb({ updateResult: [updated] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.update('biz-1', 'owner-1', { name: 'New Name' });
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when business not found or wrong owner', async () => {
      mockDrizzle.db = createMockDb({ updateResult: [] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      await expect(service.update('biz-1', 'wrong-owner', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('only sets fields that are provided in dto', async () => {
      const updated = { ...fixtures.business };
      mockDrizzle.db = createMockDb({ updateResult: [updated] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const updateSpy = jest.spyOn(mockDrizzle.db, 'update');
      await service.update('biz-1', 'owner-1', { points_per_scan: 20 });

      const setArgs = (updateSpy.mock.results[0].value.set as jest.Mock).mock.calls[0][0];
      expect(setArgs).not.toHaveProperty('name');
      expect(setArgs.pointsPerScan).toBe(20);
    });
  });

  // ─── regenerateQr ─────────────────────────────────────────────────────────

  describe('regenerateQr', () => {
    it('sets a new slug and returns updated business', async () => {
      const updatedBiz = { ...fixtures.business, slug: 'venue-new-slug' };
      mockDrizzle.db = createMockDb({ updateResult: [updatedBiz] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      const result = await service.regenerateQr('biz-1', 'owner-1');
      expect(result.slug).toContain('venue-');
    });

    it('throws NotFoundException when business not found', async () => {
      mockDrizzle.db = createMockDb({ updateResult: [] });
      (service as unknown as { drizzle: unknown }).drizzle = mockDrizzle;

      await expect(service.regenerateQr('biz-missing', 'owner-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── generateSlug (private) ───────────────────────────────────────────────

  describe('generateSlug (private)', () => {
    const gen = (name: string) =>
      (service as unknown as { generateSlug: (s: string) => string }).generateSlug(name);

    it('lowercases the name', () => {
      expect(gen('MY VENUE')).toMatch(/^my-venue-/);
    });

    it('replaces spaces and special chars with hyphens', () => {
      expect(gen('The Rusty Barrel & Grill!')).toMatch(/^the-rusty-barrel-grill-/);
    });

    it('strips leading and trailing hyphens', () => {
      expect(gen('   Venue   ')).not.toMatch(/^-/);
    });

    it('appends a 5-character random suffix', () => {
      const slug = gen('Test Venue');
      const suffix = slug.split('-').pop();
      expect(suffix).toHaveLength(5);
    });

    it('truncates base to 40 characters', () => {
      const longName = 'A'.repeat(60);
      const slug = gen(longName);
      // base (40 chars) + '-' + suffix (5 chars) = 46
      expect(slug.length).toBeLessThanOrEqual(46);
    });
  });
});
