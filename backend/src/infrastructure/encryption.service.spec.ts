import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  const service = new EncryptionService();

  it('encrypts and decrypts a string', () => {
    const plaintext = 'my-secret-value';
    const encrypted = service.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext for same plaintext', () => {
    const a = service.encrypt('test');
    const b = service.encrypt('test');
    expect(a).not.toBe(b);
  });

  it('roundtrip works for empty string', () => {
    const encrypted = service.encrypt('');
    expect(service.decrypt(encrypted)).toBe('');
  });

  it('roundtrip works for special characters', () => {
    const plaintext = 'p@ssw0rd!@#$%^&*()';
    const encrypted = service.encrypt(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  describe('hash', () => {
    it('produces a 64-character hex sha256 digest', () => {
      const digest = service.hash('orbit_sat_abc');
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic for the same input', () => {
      expect(service.hash('same-value')).toBe(service.hash('same-value'));
    });

    it('produces different digests for different input', () => {
      expect(service.hash('value-a')).not.toBe(service.hash('value-b'));
    });
  });
});
