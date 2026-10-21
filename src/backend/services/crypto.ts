import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 12

/**
 * Hash password using bcrypt (secure)
 * @param plain - Plain text password
 * @returns Bcrypt hashed password
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS)
}

/**
 * Verify password against bcrypt hash
 * @param plain - Plain text password
 * @param hash - Bcrypt hash
 * @returns True if password matches
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Encrypt password using SHA1 (legacy - for backward compatibility ONLY)
 * @deprecated Use hashPassword instead. This is maintained ONLY for verifying old passwords during migration.
 */
export function encryptPassword(plain: string): string {
  // SECURITY: SHA1 is no longer safe for new passwords. 
  // This function is only kept to support one-time migration to bcrypt.
  return crypto.createHash('sha1').update(plain).digest('hex')
}

/**
 * Check if a hash is SHA1 format (40 hex characters)
 * @param hash - Hash to check
 * @returns True if SHA1 format
 */
export function isSHA1Hash(hash: string): boolean {
  return /^[a-f0-9]{40}$/i.test(hash)
}

/**
 * Encrypt sensitive data using AES-256-GCM with a random salt
 * @param text - Text to encrypt
 * @param key - Encryption key
 * @returns Encrypted text prefixed with version info
 */
export function encryptData(text: string, key: string): string {
  const algorithm = 'aes-256-gcm'
  const salt = crypto.randomBytes(16)
  const iv = crypto.randomBytes(12) // GCM standard IV size is 12 bytes
  
  // Derive key using unique salt
  const keyBuffer = crypto.scryptSync(key, salt, 32)
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag()
  
  // Format: v2gcm:salt:iv:authTag:encrypted
  return `v2gcm:${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

/**
 * Decrypt data encrypted with encryptData (supports AES-256-GCM and legacy AES-256-CBC fallback)
 * @param encryptedText - Encrypted text
 * @param key - Decryption key
 * @returns Decrypted text
 */
export function decryptData(encryptedText: string, key: string): string {
  try {
    return decryptDataUnsafe(encryptedText, key)
  } catch {
    // A wrong key or a damaged payload must not crash the caller.
    return ''
  }
}

function decryptDataUnsafe(encryptedText: string, key: string): string {
  if (encryptedText.startsWith('v2gcm:')) {
    const parts = encryptedText.split(':')
    if (parts.length !== 5) {
      throw new Error('Format enkripsi v2gcm tidak valid')
    }
    
    const salt = Buffer.from(parts[1], 'hex')
    const iv = Buffer.from(parts[2], 'hex')
    const authTag = Buffer.from(parts[3], 'hex')
    const encrypted = parts[4]
    
    const algorithm = 'aes-256-gcm'
    const keyBuffer = crypto.scryptSync(key, salt, 32)
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  }

  // Legacy fallback: AES-256-CBC with static 'salt'
  const algorithm = 'aes-256-cbc'
  const keyBuffer = crypto.scryptSync(key, 'salt', 32)
  
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

