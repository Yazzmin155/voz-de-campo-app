import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearStoredAccount,
  createLocalAccount,
  getStoredAccount,
  hasStoredAccount,
  isValidEmail,
  passwordStrength,
  updateStoredAccountProfile,
  validateCip,
  validatePassword,
  verifyLogin
} from '@/lib/auth';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  }
});

beforeEach(() => {
  localStorage.clear();
});

describe('cuenta local del técnico', () => {
  it('crea una cuenta, guarda la contraseña con hash y permite entrar', async () => {
    const created = await createLocalAccount({
      name: 'Ing. Danny Cárdenas',
      email: 'danny@vozdecampo.mx',
      password: 'Surco-2026',
      cipCode: '84920'
    });

    expect(created.ok).toBe(true);
    expect(hasStoredAccount()).toBe(true);
    expect(getStoredAccount()?.hash).toBeTruthy();
    expect(getStoredAccount()?.hash).not.toContain('Surco-2026');

    const login = await verifyLogin('DANNY@vozdecampo.mx', 'Surco-2026');
    expect(login.ok).toBe(true);
    if (login.ok) {
      expect(login.identity.cipCode).toBe('CIP-84920');
      expect(login.identity.name).toBe('Ing. Danny Cárdenas');
    }
  });

  it('rechaza la contraseña incorrecta y avisa sin revelar cuál dato falló', async () => {
    await createLocalAccount({
      name: 'Ing. Danny Cárdenas',
      email: 'danny@vozdecampo.mx',
      password: 'Surco-2026',
      cipCode: '84920'
    });

    const wrongPassword = await verifyLogin('danny@vozdecampo.mx', 'otra-clave');
    expect(wrongPassword.ok).toBe(false);

    const unknownEmail = await verifyLogin('nadie@vozdecampo.mx', 'Surco-2026');
    expect(unknownEmail.ok).toBe(false);
    if (!wrongPassword.ok && !unknownEmail.ok) {
      expect(wrongPassword.error).toBe(unknownEmail.error);
    }
  });

  it('actualiza nombre y correo sin tocar la contraseña guardada', async () => {
    await createLocalAccount({
      name: 'Ing. Danny Cárdenas',
      email: 'danny@vozdecampo.mx',
      password: 'Surco-2026',
      cipCode: '84920'
    });
    const before = getStoredAccount();

    updateStoredAccountProfile({
      name: 'Ing. Daniel Cárdenas R.',
      email: 'daniel@vozdecampo.mx',
      cipCode: 'CIP-84920'
    });

    const after = getStoredAccount();
    expect(after?.name).toBe('Ing. Daniel Cárdenas R.');
    expect(after?.email).toBe('daniel@vozdecampo.mx');
    expect(after?.hash).toBe(before?.hash);

    const login = await verifyLogin('daniel@vozdecampo.mx', 'Surco-2026');
    expect(login.ok).toBe(true);
  });

  it('borra la cuenta local cuando el técnico elimina sus datos', async () => {
    await createLocalAccount({
      name: 'Ing. Danny Cárdenas',
      email: 'danny@vozdecampo.mx',
      password: 'Surco-2026',
      cipCode: '84920'
    });
    clearStoredAccount();
    expect(hasStoredAccount()).toBe(false);
  });
});

describe('validaciones de registro', () => {
  it('valida correo, cédula y contraseña con mensajes claros', () => {
    expect(isValidEmail('danny@vozdecampo.mx')).toBe(true);
    expect(isValidEmail('danny@vozdecampo')).toBe(false);

    expect(validateCip('84920')).toBeNull();
    expect(validateCip('123')).not.toBeNull();

    expect(validatePassword('Surco-2026')).toBeNull();
    expect(validatePassword('123')).not.toBeNull();

    expect(passwordStrength('Surco-2026').score).toBeGreaterThanOrEqual(2);
  });
});
