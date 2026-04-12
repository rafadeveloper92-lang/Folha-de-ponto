/** Senha da área administrativa (restrita). */
export const ADMIN_PASSWORD = '19216811';

const SESSION_KEY = 'gsi_admin_session';

export function isAdminSession(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function setAdminSession(active: boolean): void {
  try {
    if (active) sessionStorage.setItem(SESSION_KEY, '1');
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function verifyAdminPassword(input: string): boolean {
  return input.replace(/\s/g, '') === ADMIN_PASSWORD;
}
