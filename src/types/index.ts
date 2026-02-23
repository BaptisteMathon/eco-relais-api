/**
 * Shared types for Eco-Relais API
 */

export type UserRole = 'client' | 'partner' | 'admin';

export type PackageSize = 'small' | 'medium' | 'large';

export type MissionStatus =
  | 'pending'
  | 'accepted'
  | 'collected'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  address_lat: number | null;
  address_lng: number | null;
  created_at: Date;
  verified: boolean;
  stripe_account_id: string | null;
}

export interface UserPayload {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  phone: string | null;
  address_lat: number | null;
  address_lng: number | null;
  verified: boolean;
}

export interface Mission {
  id: string;
  client_id: string;
  partner_id: string | null;
  package_photo_url: string | null;
  package_title: string;
  package_size: PackageSize;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  pickup_time_slot: string;
  status: MissionStatus;
  price: number;
  commission: number;
  qr_code: string | null;
  created_at: Date;
  completed_at: Date | null;
  // Joined fields (optional — present when queries JOIN users)
  client_first_name?: string;
  client_last_name?: string;
  partner_first_name?: string;
  partner_last_name?: string;
}

export interface Transaction {
  id: string;
  mission_id: string;
  partner_id: string;
  amount: number;
  stripe_payment_intent: string | null;
  status: TransactionStatus;
  created_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
