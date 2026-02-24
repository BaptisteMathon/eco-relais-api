/**
 * In-memory database for testing
 */

interface User {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  address_lat: number | null;
  address_lng: number | null;
  stripe_account_id: string | null;
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

interface Mission {
  id: string;
  client_id: string;
  package_title: string;
  package_size: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  pickup_time_slot: string;
  status: string;
  price: number;
  commission: number;
  partner_id: string | null;
  accepted_at: Date | null;
  collected_at: Date | null;
  delivered_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class TestDatabase {
  private users = new Map<string, User>();
  private usersByEmail = new Map<string, string>();
  private missions = new Map<string, Mission>();

  resetAll() {
    this.users.clear();
    this.usersByEmail.clear();
    this.missions.clear();
  }

  getUserCount() {
    return this.users.size;
  }

  getAllUserIds() {
    return Array.from(this.users.keys());
  }

  // User operations
  insertUser(user: User) {
    this.users.set(user.id, { ...user });
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
  }

  getUserById(id: string): User | null {
    return this.users.get(id) || null;
  }

  getUserByEmail(email: string): User | null {
    const id = this.usersByEmail.get(email.toLowerCase());
    if (!id) return null;
    return this.users.get(id) || null;
  }

  updateUser(id: string, data: Partial<User>): User | null {
    const user = this.users.get(id);
    if (!user) return null;
    const updated = { ...user, ...data, updated_at: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  // Mission operations
  insertMission(mission: Mission) {
    this.missions.set(mission.id, { ...mission });
  }

  getMissionById(id: string): Mission | null {
    return this.missions.get(id) || null;
  }

  getMissionsByClientId(clientId: string): Mission[] {
    return Array.from(this.missions.values()).filter(m => m.client_id === clientId);
  }

  updateMission(id: string, data: Partial<Mission>): Mission | null {
    const mission = this.missions.get(id);
    if (!mission) return null;
    const updated = { ...mission, ...data, updated_at: new Date() };
    this.missions.set(id, updated);
    return updated;
  }

  getNearbyMissions(lat: number, lng: number, radius: number): Mission[] {
    return Array.from(this.missions.values()).filter(m => {
      const dy = m.delivery_lat - lat;
      const dx = m.delivery_lng - lng;
      const distance = Math.sqrt(dx * dx + dy * dy) * 111000; // rough conversion to meters
      return distance <= radius && m.status === 'pending';
    });
  }
}

export const testDb = new TestDatabase();
