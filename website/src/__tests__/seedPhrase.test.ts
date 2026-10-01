// test functions in seedPhrase.ts

import { describe, it, expect } from '@jest/globals';
import { mnemonicToAccount } from 'viem/accounts';
import { generateSeedPhrase, verifyAndSanitizeSeedPhrase } from '~/utils/seedPhrase';

describe('seedPhrase', () => {
  const validSeedPhrase = 'pear stone nephew summer west purpose load anger robust circle addict memory';
  const invalidWordSeedPhrase = validSeedPhrase.replace('pear', '1nv4l1d');
  const invalidLengthSeedPhrase = validSeedPhrase.split(' ').slice(0, 11).join(' ');

  it('should generate a valid seed phrase', () => {
    const seedPhrase = generateSeedPhrase();

    expect(seedPhrase).toBeDefined();
    expect(seedPhrase.split(' ').length).toBe(12);
    expect(mnemonicToAccount(seedPhrase)).toBeDefined();
  });

  it('should verify and sanitize a seed phrase', () => {
    const seedPhraseWithCommas = validSeedPhrase.replace(' ', ',');
    const sanitizedSeedPhrase = verifyAndSanitizeSeedPhrase(seedPhraseWithCommas);

    expect(sanitizedSeedPhrase).toBe(validSeedPhrase);
  });

  it('should throw an error if the seed phrase is not 12 words', () => {
    const seedPhrase11Words = invalidLengthSeedPhrase;

    expect(() => verifyAndSanitizeSeedPhrase(seedPhrase11Words)).toThrow();
  });

  it('should throw an error if the seed phrase contains invalid words', () => {
    expect(() => verifyAndSanitizeSeedPhrase(invalidWordSeedPhrase)).toThrow();
  });
});
