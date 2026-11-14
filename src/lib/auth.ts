const ACCOUNT_KEY = 'voz-de-campo-account-v1';
const PBKDF2_ITERATIONS = 150_000;

export interface LocalAccount {
  name: string;
  email: string;
  cipCode: string;
  salt: string;
  hash: string;
  iterations: number;
  createdAt: string;
}

export interface AuthIdentity {
  name: string;
  email: string;
  cipCode: string;
}

export type AuthResult =
  | { ok: true; identity: AuthIdentity }
  | { ok: false; error: string };

export const DEMO_ACCOUNT: AuthIdentity = {
  name: 'Ing. Danny Cárdenas',
  email: 'danny@vozdecampo.mx',
  cipCode: 'CIP-84920'
};

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function subtleAvailable(): boolean {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

async function deriveHash(password: string, salt: string, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromBase64(salt) as unknown as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return toBase64(new Uint8Array(bits));
}

export function getStoredAccount(): LocalAccount | null {
  try {
    const raw = localStorage.getItem(ACCOUNT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalAccount;
    if (!parsed?.email || !parsed?.hash || !parsed?.salt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasStoredAccount(): boolean {
  return getStoredAccount() !== null;
}

export function clearStoredAccount(): void {
  localStorage.removeItem(ACCOUNT_KEY);
}

/**
 * Mantiene sincronizado el nombre y correo de la cuenta local cuando el técnico
 * edita su perfil, sin tocar la contraseña guardada.
 */
export function updateStoredAccountProfile(identity: AuthIdentity): void {
  const current = getStoredAccount();
  if (!current) return;
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify({
      ...current,
      name: identity.name.trim() || current.name,
      email: identity.email.trim().toLowerCase() || current.email,
      cipCode: identity.cipCode || current.cipCode
    })
  );
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}

export function normalizeCip(value: string): string {
  const digits = value.replace(/[^\d]/g, '').slice(0, 6);
  return digits ? `CIP-${digits}` : '';
}

export function validateCip(value: string): string | null {
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length < 4) return 'Ingresa tu cédula profesional (mínimo 4 dígitos).';
  if (digits.length > 6) return 'La cédula debe tener entre 4 y 6 dígitos.';
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Usa al menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(password)) return 'Incluye al menos una letra.';
  if (!/\d/.test(password)) return 'Incluye al menos un número.';
  return null;
}

export function passwordStrength(password: string): {
  score: number;
  label: string;
  tone: 'danger' | 'warning' | 'success';
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  score = Math.min(4, score);

  if (password.length === 0) return { score: 0, label: '', tone: 'danger' };
  if (score <= 1) return { score, label: 'Débil', tone: 'danger' };
  if (score === 2) return { score, label: 'Aceptable', tone: 'warning' };
  if (score === 3) return { score, label: 'Buena', tone: 'success' };
  return { score, label: 'Fuerte', tone: 'success' };
}

export async function createLocalAccount(input: {
  name: string;
  email: string;
  password: string;
  cipCode: string;
}): Promise<AuthResult> {
  if (!subtleAvailable()) {
    return {
      ok: false,
      error: 'Este navegador no permite guardar la cuenta de forma segura. Abre la app por HTTPS o instálala en el teléfono.'
    };
  }

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const cipCode = normalizeCip(input.cipCode);

  if (name.length < 3) return { ok: false, error: 'Escribe tu nombre completo.' };
  if (!isValidEmail(email)) return { ok: false, error: 'Ese correo no parece válido.' };
  const cipError = validateCip(input.cipCode);
  if (cipError) return { ok: false, error: cipError };
  const passwordError = validatePassword(input.password);
  if (passwordError) return { ok: false, error: passwordError };

  try {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    const salt = toBase64(saltBytes);
    const hash = await deriveHash(input.password, salt, PBKDF2_ITERATIONS);

    const account: LocalAccount = {
      name,
      email,
      cipCode,
      salt,
      hash,
      iterations: PBKDF2_ITERATIONS,
      createdAt: new Date().toISOString()
    };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
    return { ok: true, identity: { name, email, cipCode } };
  } catch {
    return { ok: false, error: 'No se pudo crear la cuenta en este dispositivo. Inténtalo otra vez.' };
  }
}

export async function verifyLogin(email: string, password: string): Promise<AuthResult> {
  const account = getStoredAccount();
  if (!account) {
    return {
      ok: false,
      error: 'Todavía no hay una cuenta en este teléfono. Crea la tuya o entra con los datos de ejemplo.'
    };
  }
  if (!isValidEmail(email)) {
    return { ok: false, error: 'Escribe un correo válido.' };
  }
  if (!subtleAvailable()) {
    return { ok: false, error: 'Este navegador no permite verificar la cuenta de forma segura.' };
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const hash = await deriveHash(password, account.salt, account.iterations);
    if (normalizedEmail !== account.email.trim().toLowerCase() || hash !== account.hash) {
      return { ok: false, error: 'La contraseña no coincide. Revísala o restablece la cuenta.' };
    }
    return {
      ok: true,
      identity: {
        name: account.name,
        email: account.email,
        cipCode: account.cipCode
      }
    };
  } catch {
    return { ok: false, error: 'No se pudo verificar la cuenta. Inténtalo otra vez.' };
  }
}
