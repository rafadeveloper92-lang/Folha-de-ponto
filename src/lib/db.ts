import Dexie, { type EntityTable } from 'dexie';

interface WorkEntry {
  id?: number;
  monthKey: string; // e.g. "03_2026"
  day: number;
  project: string;
  description: string;
  hours: string;
  marked?: boolean;
}

interface UserProfile {
  id: string; // singleton "current"
  name: string;
  role: string;
  hourlyRate: number;
  signature: string;
  theme?: 'dark' | 'light';
  defaultProject?: string;
  /** Data URL (JPEG/PNG) — foto de perfil */
  profilePhoto?: string;
  /** Cadastro inicial concluído */
  onboardingComplete?: boolean;
  /** Cargo bloqueado após cadastro */
  roleLocked?: boolean;
  /** PDF da ficha (base64) — obrigatório no onboarding */
  employeePdfBase64?: string;
  /** Código extraído do PDF (ex.: GF127855) */
  employeeCode?: string;
  /** Data URL PNG do QR mostrado ao lado da foto */
  qrDataUrl?: string;
}

const db = new Dexie('GSITrackerDB') as Dexie & {
  entries: EntityTable<WorkEntry, 'id'>;
  profile: EntityTable<UserProfile, 'id'>;
};

db.version(1).stores({
  entries: '++id, monthKey, day',
  profile: 'id',
});
db.version(2).stores({
  entries: '++id, monthKey, day',
  profile: 'id',
});

export type { WorkEntry, UserProfile };
export { db };
