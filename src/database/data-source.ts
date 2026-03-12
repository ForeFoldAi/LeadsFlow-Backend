import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is not defined');

const urlPattern = /postgres(ql)?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/;
const match = databaseUrl.match(urlPattern);
if (!match) throw new Error('Invalid DATABASE_URL format');

const enableSsl = process.env.DATABASE_SSL === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: match[4],
  port: parseInt(match[5], 10),
  username: match[2],
  password: match[3],
  database: match[6],
  entities: [__dirname + '/../entities/*.entity.{ts,js}'],
  migrations: [__dirname + '/../migrations/*.{ts,js}'],
  synchronize: false,
  logging: true,
  ...(enableSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});
