/**
 * Vitest setup file - Initialize test database once at startup
 */

import { vi } from 'vitest';
import { testDb } from './src/test/testDatabase';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-vitest';

// Initialize database at startup
testDb.resetAll();

// Mock QR code generation
vi.mock('./src/services/qrService', () => ({
  generateMissionQR: vi.fn(async (missionId: string) => ({
    token: 'test-qr-token-' + missionId,
    qrDataUrl: 'data:image/png;base64,iVBORw0KG', // Mock base64 PNG
  })),
  verifyQRPayload: vi.fn((payload: string, missionId: string) => {
    return payload.startsWith(missionId + ':');
  }),
}));

// Mock S3 upload
vi.mock('./src/services/uploadService', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  uploadToS3: vi.fn(async (_buffer: Buffer, _mimetype: string) => {
    return 'https://s3.mock/uploads/test-image-' + Date.now() + '.jpg';
  }),
  uploadFilter: vi.fn((_req: unknown, _file: unknown, cb: (err: null, accept: boolean) => void) => cb(null, true)),
  uploadLimits: { fileSize: 5242880 },
}));

// Mock the database pool
vi.mock('./src/config/db', () => {
  return {
    pool: {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        const sqlLower = sql.toLowerCase().trim();
        
        // INSERT INTO users
        if (sqlLower.startsWith('insert into users')) {
          const [id, email, password_hash, role, first_name, last_name, phone, address_lat, address_lng, stripe_account_id] = params;
          const user = {
            id: id as string,
            email: email as string,
            password_hash: password_hash as string,
            role: role as string,
            first_name: first_name as string,
            last_name: last_name as string,
            phone: (phone as string | null) || null,
            address_lat: (address_lat as number | null) || null,
            address_lng: (address_lng as number | null) || null,
            stripe_account_id: (stripe_account_id as string | null) || null,
            verified: false,
            created_at: new Date(),
            updated_at: new Date(),
          };
          testDb.insertUser(user);
          return { rows: [user], rowCount: 1 };
        }

        // SELECT * FROM users WHERE id = $1
        if (sqlLower.startsWith('select * from users where id')) {
          const user = testDb.getUserById(params[0] as string);
          return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
        }

        // SELECT * FROM users WHERE LOWER(email)
        if (sqlLower.includes('select *') && sqlLower.includes('from users') && sqlLower.includes('lower(email)')) {
          const user = testDb.getUserByEmail(params[0] as string);
          return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
        }

        // UPDATE users SET ... WHERE id = $
        if (sqlLower.startsWith('update users set')) {
          const userId = params[params.length - 1] as string; // Last param is always the ID
          const updates: Record<string, unknown> = {};
          const paramsWithoutId = params.slice(0, -1); // All but last
          
          // Parse each field from SQL and assign params in order
          let paramIdx = 0;
          
          if (sql.includes('first_name =')) {
            updates.first_name = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('last_name =')) {
            updates.last_name = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('phone =')) {
            updates.phone = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('address =')) {
            updates.address = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('address_lat =')) {
            updates.address_lat = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('address_lng =')) {
            updates.address_lng = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('verified =')) {
            updates.verified = paramsWithoutId[paramIdx++];
          }
          if (sql.includes('stripe_account_id =')) {
            updates.stripe_account_id = paramsWithoutId[paramIdx++];
          }
          
          const user = testDb.updateUser(userId, updates);
          return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
        }

        // INSERT INTO missions
        if (sqlLower.startsWith('insert into missions')) {
          const [id, client_id, package_photo_url, package_title, package_size, pickup_address, pickup_lat, pickup_lng, 
                  delivery_address, delivery_lat, delivery_lng, pickup_time_slot, price, commission, qr_code] = params;
          const mission = {
            id: id as string,
            client_id: client_id as string,
            package_photo_url: (package_photo_url as string | null) || null,
            package_title: package_title as string,
            package_size: package_size as string,
            pickup_address: pickup_address as string,
            pickup_lat: pickup_lat as number,
            pickup_lng: pickup_lng as number,
            delivery_address: delivery_address as string,
            delivery_lat: delivery_lat as number,
            delivery_lng: delivery_lng as number,
            pickup_time_slot: pickup_time_slot as string,
            price: price as number,
            commission: commission as number,
            qr_code: (qr_code as string | null) || null,
            status: 'pending' as const,
            created_at: new Date(),
            partner_id: null,
            accepted_at: null,
            collected_at: null,
            delivered_at: null,
            completed_at: null,
            cancelled_at: null,
            updated_at: new Date(),
          };
          testDb.insertMission(mission);
          return { rows: [mission], rowCount: 1 };
        }

        // SELECT * FROM missions WHERE id = $1 (with LEFT JOINs for users)
        if ((sqlLower.includes('select m.*') || sqlLower.includes('select *')) && 
            sqlLower.includes('from missions m') && 
            sqlLower.includes('where m.id')) {
          const mission = testDb.getMissionById(params[0] as string);
          if (mission) {
            // Add client and partner user info from testDb
            const client = mission.client_id ? testDb.getUserById(mission.client_id) : null;
            const partner = mission.partner_id ? testDb.getUserById(mission.partner_id) : null;
            const enrichedMission = {
              ...mission,
              client_first_name: client?.first_name || null,
              client_last_name: client?.last_name || null,
              partner_first_name: partner?.first_name || null,
              partner_last_name: partner?.last_name || null,
            };
            return { rows: [enrichedMission], rowCount: 1 };
          }
          return { rows: [], rowCount: 0 };
        }

        // SELECT * FROM missions WHERE client_id = $1 (with LEFT JOINs for users)
        if ((sqlLower.includes('select m.*') || sqlLower.includes('select *')) && 
            sqlLower.includes('from missions m') && 
            sqlLower.includes('where m.client_id')) {
          const missions = testDb.getMissionsByClientId(params[0] as string);
          return { rows: missions.map(m => ({
            ...m,
            client_first_name: testDb.getUserById(m.client_id)?.first_name || null,
            client_last_name: testDb.getUserById(m.client_id)?.last_name || null,
            partner_first_name: m.partner_id ? testDb.getUserById(m.partner_id)?.first_name || null : null,
            partner_last_name: m.partner_id ? testDb.getUserById(m.partner_id)?.last_name || null : null,
          })), rowCount: missions.length };
        }

        // SELECT nearby missions
        if (sqlLower.includes('select *') && sqlLower.includes('from missions') && (sqlLower.includes('st_') || sqlLower.includes('where'))) {
          // Try to extract lat, lng, radius from params
          const missions = testDb.getNearbyMissions((params[0] as number) || 0, (params[1] as number) || 0, (params[2] as number) || 5000);
          return { rows: missions, rowCount: missions.length };
        }

        // UPDATE missions SET ...
        if (sqlLower.startsWith('update missions set')) {
          const missionId = params[0] as string; // First param is always the ID
          const updates: Record<string, unknown> = {};
          
          // Handle status = $2, partner_id = $3, etc.
          if (sql.includes('status = $')) {
            updates.status = params[1];
          }
          if (sql.includes('partner_id = $')) {
            // Find where partner_id is
            const partnerIdx = sql.split(',').findIndex(part => part.includes('partner_id = $'));
            if (partnerIdx >= 0) {
              // Extract the parameter index
              const match = sql.match(/partner_id = \$(\d+)/);
              if (match) {
                const paramIdx = parseInt(match[1]) - 1;
                updates.partner_id = params[paramIdx];
              }
            }
          }
          if (sql.includes('qr_code =')) {
            const match = sql.match(/qr_code = \$(\d+)/);
            if (match) {
              const paramIdx = parseInt(match[1]) - 1;
              updates.qr_code = params[paramIdx];
            }
          }
          if (sql.includes('accepted_at')) updates.accepted_at = new Date();
          if (sql.includes('collected_at')) updates.collected_at = new Date();
          if (sql.includes('delivered_at')) updates.delivered_at = new Date();
          if (sql.includes('completed_at')) {
            const match = sql.match(/completed_at = \$(\d+)/);
            if (match) {
              const paramIdx = parseInt(match[1]) - 1;
              updates.completed_at = params[paramIdx];
            }
          }
          if (sql.includes('cancelled_at')) updates.cancelled_at = new Date();
          
          const mission = testDb.updateMission(missionId, updates);
          return { rows: mission ? [mission] : [], rowCount: mission ? 1 : 0 };
        }

        // SELECT 1 (health check)
        if (sqlLower.includes('select 1')) {
          return { rows: [{ '?column?': 1 }], rowCount: 1 };
        }

        // CREATE EXTENSION  
        if (sqlLower.includes('create extension')) {
          return { rows: [], rowCount: 0 };
        }

        // Default - return empty
        return { rows: [], rowCount: 0 };
      }),
      connect: vi.fn(async () => ({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        query: vi.fn(async (_sql: string, _params?: unknown[]) => {
          return { rows: [], rowCount: 0 };
        }),
        release: vi.fn(),
      })),
      on: vi.fn(),
      end: vi.fn(async () => {}),
    },
    testConnection: vi.fn(async () => {}),
    default: vi.fn(),
  };
});
