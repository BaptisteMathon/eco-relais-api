/**
 * Seed script – test users, missions, notifications, transactions
 * Usage: npm run seed
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../config/db';
import * as UserModel from '../models/User';
import * as MissionModel from '../models/Mission';
import * as NotificationModel from '../models/Notification';
import * as TransactionModel from '../models/Transaction';
import { calculateMissionPricing } from '../utils/helpers';
import { generateMissionQR } from '../services/qrService';
import type { PackageSize } from '../types';

const SALT_ROUNDS = 12;
const PASSWORD = 'Password123!';

const PARIS = {
  rivoli: { address: '10 Rue de Rivoli, Paris', lat: 48.8566, lng: 2.3522 },
  champs: { address: '5 Avenue des Champs-Élysées, Paris', lat: 48.8698, lng: 2.3078 },
  marais: { address: '20 Rue du Temple, Paris', lat: 48.8594, lng: 2.3575 },
  bastille: { address: '12 Place de la Bastille, Paris', lat: 48.8532, lng: 2.3692 },
  montmartre: { address: '2 Rue Tardieu, Paris', lat: 48.8867, lng: 2.3406 },
};

async function ensureUser(
  email: string,
  role: 'client' | 'partner' | 'admin',
  data: { first_name: string; last_name: string; phone?: string; address_lat?: number; address_lng?: number }
) {
  const existing = await UserModel.getByEmail(email);
  if (existing) return existing;
  const password_hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);
  const user = await UserModel.createUser({
    email,
    password_hash,
    role,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    address_lat: data.address_lat,
    address_lng: data.address_lng,
  });
  console.log('Created', email);
  return user;
}

async function createMissionWithQr(
  clientId: string,
  opts: {
    package_title: string;
    package_size: PackageSize;
    pickup_address: string;
    pickup_lat: number;
    pickup_lng: number;
    delivery_address: string;
    delivery_lat: number;
    delivery_lng: number;
    pickup_time_slot?: string;
  }
) {
  const { price, commission } = calculateMissionPricing(opts.package_size);
  const mission = await MissionModel.createMission({
    client_id: clientId,
    package_title: opts.package_title,
    package_size: opts.package_size,
    pickup_address: opts.pickup_address,
    pickup_lat: opts.pickup_lat,
    pickup_lng: opts.pickup_lng,
    delivery_address: opts.delivery_address,
    delivery_lat: opts.delivery_lat,
    delivery_lng: opts.delivery_lng,
    pickup_time_slot: opts.pickup_time_slot ?? '14:00-16:00',
    price,
    commission,
  });
  const { qrDataUrl } = await generateMissionQR(mission.id);
  await MissionModel.updateMissionQr(mission.id, qrDataUrl);
  return mission;
}

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    const password_hash = await bcrypt.hash(PASSWORD, SALT_ROUNDS);

    // —— Users ——
    const alice = await ensureUser('client@eco-relais.test', 'client', {
      first_name: 'Alice',
      last_name: 'Client',
      phone: '+33600000001',
      address_lat: PARIS.rivoli.lat,
      address_lng: PARIS.rivoli.lng,
    });

    const bob = await ensureUser('partner@eco-relais.test', 'partner', {
      first_name: 'Bob',
      last_name: 'Partner',
      phone: '+33600000002',
      address_lat: 48.857,
      address_lng: 2.353,
    });

    await ensureUser('admin@eco-relais.test', 'admin', {
      first_name: 'Admin',
      last_name: 'User',
    });

    const clara = await ensureUser('clara@eco-relais.test', 'client', {
      first_name: 'Clara',
      last_name: 'Dupont',
      phone: '+33600000011',
      address_lat: PARIS.marais.lat,
      address_lng: PARIS.marais.lng,
    });

    const david = await ensureUser('david@eco-relais.test', 'partner', {
      first_name: 'David',
      last_name: 'Martin',
      phone: '+33600000012',
      address_lat: 48.86,
      address_lng: 2.36,
    });

    // —— Missions (client Alice) ——
    let missions = await MissionModel.listByClientId(alice.id);
    if (missions.length === 0) {
      const m1 = await createMissionWithQr(alice.id, {
        package_title: 'Test package',
        package_size: 'medium',
        pickup_address: PARIS.rivoli.address,
        pickup_lat: PARIS.rivoli.lat,
        pickup_lng: PARIS.rivoli.lng,
        delivery_address: PARIS.champs.address,
        delivery_lat: PARIS.champs.lat,
        delivery_lng: PARIS.champs.lng,
      });
      await MissionModel.setPartner(m1.id, bob.id);
      await MissionModel.updateMissionStatus(m1.id, 'collected', bob.id);
      await MissionModel.updateMissionStatus(m1.id, 'in_transit', bob.id);
      await MissionModel.updateMissionStatus(m1.id, 'delivered', bob.id, new Date());
      const { partnerAmount } = calculateMissionPricing('medium');
      await TransactionModel.createTransaction({
        mission_id: m1.id,
        partner_id: bob.id,
        amount: partnerAmount,
        status: 'completed',
      });
      console.log('Created mission 1 (delivered)');

      const m2 = await createMissionWithQr(alice.id, {
        package_title: 'Books and documents',
        package_size: 'small',
        pickup_address: PARIS.marais.address,
        pickup_lat: PARIS.marais.lat,
        pickup_lng: PARIS.marais.lng,
        delivery_address: PARIS.bastille.address,
        delivery_lat: PARIS.bastille.lat,
        delivery_lng: PARIS.bastille.lng,
        pickup_time_slot: '10:00-12:00',
      });
      await MissionModel.setPartner(m2.id, bob.id);
      await MissionModel.updateMissionStatus(m2.id, 'collected', bob.id);
      await MissionModel.updateMissionStatus(m2.id, 'in_transit', bob.id);
      console.log('Created mission 2 (in_transit)');

      const m3 = await createMissionWithQr(alice.id, {
        package_title: 'Gift parcel',
        package_size: 'large',
        pickup_address: PARIS.rivoli.address,
        pickup_lat: PARIS.rivoli.lat,
        pickup_lng: PARIS.rivoli.lng,
        delivery_address: PARIS.montmartre.address,
        delivery_lat: PARIS.montmartre.lat,
        delivery_lng: PARIS.montmartre.lng,
      });
      await MissionModel.setPartner(m3.id, david.id);
      await MissionModel.updateMissionStatus(m3.id, 'collected', david.id);
      console.log('Created mission 3 (collected)');

      const m4 = await createMissionWithQr(alice.id, {
        package_title: 'Urgent envelope',
        package_size: 'small',
        pickup_address: PARIS.champs.address,
        pickup_lat: PARIS.champs.lat,
        pickup_lng: PARIS.champs.lng,
        delivery_address: PARIS.marais.address,
        delivery_lat: PARIS.marais.lat,
        delivery_lng: PARIS.marais.lng,
      });
      await MissionModel.setPartner(m4.id, david.id);
      console.log('Created mission 4 (accepted)');

      const m5 = await createMissionWithQr(alice.id, {
        package_title: 'Pending pickup',
        package_size: 'medium',
        pickup_address: PARIS.bastille.address,
        pickup_lat: PARIS.bastille.lat,
        pickup_lng: PARIS.bastille.lng,
        delivery_address: PARIS.rivoli.address,
        delivery_lat: PARIS.rivoli.lat,
        delivery_lng: PARIS.rivoli.lng,
      });
      console.log('Created mission 5 (pending)');

      const m6 = await createMissionWithQr(alice.id, {
        package_title: 'Cancelled order',
        package_size: 'small',
        pickup_address: PARIS.montmartre.address,
        pickup_lat: PARIS.montmartre.lat,
        pickup_lng: PARIS.montmartre.lng,
        delivery_address: PARIS.bastille.address,
        delivery_lat: PARIS.bastille.lat,
        delivery_lng: PARIS.bastille.lng,
      });
      await MissionModel.updateMissionStatus(m6.id, 'cancelled');
      console.log('Created mission 6 (cancelled)');
    }

    // —— Missions (client Clara) ——
    missions = await MissionModel.listByClientId(clara.id);
    if (missions.length === 0) {
      await createMissionWithQr(clara.id, {
        package_title: 'Clara’s first delivery',
        package_size: 'medium',
        pickup_address: PARIS.marais.address,
        pickup_lat: PARIS.marais.lat,
        pickup_lng: PARIS.marais.lng,
        delivery_address: PARIS.champs.address,
        delivery_lat: PARIS.champs.lat,
        delivery_lng: PARIS.champs.lng,
      });
      await createMissionWithQr(clara.id, {
        package_title: 'Small box',
        package_size: 'small',
        pickup_address: PARIS.bastille.address,
        pickup_lat: PARIS.bastille.lat,
        pickup_lng: PARIS.bastille.lng,
        delivery_address: PARIS.montmartre.address,
        delivery_lat: PARIS.montmartre.lat,
        delivery_lng: PARIS.montmartre.lng,
      });
      console.log('Created 2 missions for Clara');
    }

    // —— Notifications ——
    await NotificationModel.create({
      user_id: alice.id,
      type: 'info',
      message: 'Welcome to Eco-Relais! Your first mission has been created.',
    });
    await NotificationModel.create({
      user_id: alice.id,
      type: 'mission_update',
      message: 'Mission delivered successfully. Thank you for using Eco-Relais!',
    });
    await NotificationModel.create({
      user_id: alice.id,
      type: 'reminder',
      message: 'You have a mission in progress. Track it in your dashboard.',
    });
    await NotificationModel.create({
      user_id: bob.id,
      type: 'mission_assigned',
      message: 'A new mission is available near you. Check the available missions.',
    });
    await NotificationModel.create({
      user_id: bob.id,
      type: 'earnings',
      message: 'You received €4.00 for a completed delivery.',
    });
    await NotificationModel.create({
      user_id: clara.id,
      type: 'info',
      message: 'Your account is ready. Create your first mission when you’re ready.',
    });
    console.log('Created notifications');
  } finally {
    client.release();
    await pool.end();
  }

  console.log('Seed completed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
