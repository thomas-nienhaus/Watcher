// Uppercase letters + digits, excluding visually ambiguous chars (0, O, I, 1)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

export function generateRoomCode(): string {
  const array = new Uint8Array(CODE_LENGTH)

  if (typeof window !== 'undefined') {
    window.crypto.getRandomValues(array)
  } else {
    // Node.js server-side generation (used by server-side code at startup)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { randomBytes } = require('crypto') as typeof import('crypto')
    const bytes = randomBytes(CODE_LENGTH)
    array.set(bytes)
  }

  return Array.from(array)
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('')
}

export function isValidRoomCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code)
}

export function normalizeRoomCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, '')
    .slice(0, CODE_LENGTH)
}
