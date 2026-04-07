/**
 * Demo seed — inserts four demo users with pre-defined credentials.
 *
 * Run:  npm run seed:demo
 *
 * Users created:
 *   super_admin      admin@test.com   / admin123
 *   onboarding_staff staff@test.com   / staff123
 *   salon_owner      owner@test.com   / owner123
 *   customer         customer@test.com / cust123
 *
 * Safe to re-run: existing rows (matched by email) are skipped via INSERT IGNORE.
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../data-source';

dotenv.config();

const SALT_ROUNDS = 12;

interface DemoUser {
  name: string;
  email: string;
  password: string;
  role: 'super_admin' | 'onboarding_staff' | 'salon_owner' | 'customer';
}

const DEMO_USERS: DemoUser[] = [
  {
    name: 'Super Admin',
    email: 'admin@test.com',
    password: 'admin123',
    role: 'super_admin',
  },
  {
    name: 'Onboarding Staff',
    email: 'staff@test.com',
    password: 'staff123',
    role: 'onboarding_staff',
  },
  {
    name: 'Salon Owner',
    email: 'owner@test.com',
    password: 'owner123',
    role: 'salon_owner',
  },
  {
    name: 'Customer',
    email: 'customer@test.com',
    password: 'cust123',
    role: 'customer',
  },
];

async function seed(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connected.');

  const now = new Date();

  for (const demo of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demo.password, SALT_ROUNDS);

    await AppDataSource.query(
      `INSERT IGNORE INTO users
         (id, name, email, password_hash, role, status, email_verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      [uuidv4(), demo.name, demo.email, passwordHash, demo.role, now, now, now],
    );

    console.log(`  [${demo.role}]  ${demo.email}  — seeded (or already exists)`);
  }

  await AppDataSource.destroy();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
