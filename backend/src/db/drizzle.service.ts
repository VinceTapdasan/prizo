import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

@Injectable()
export class DrizzleService implements OnModuleInit {
  private _db: DrizzleDb;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.getOrThrow<string>('DATABASE_URL');
    // prepare: false is required for Supabase's PgBouncer transaction pooler
    const client = postgres(url, { prepare: false });
    this._db = drizzle(client, { schema });
  }

  get db(): DrizzleDb {
    return this._db;
  }
}
