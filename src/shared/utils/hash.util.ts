import * as bcrypt from 'bcrypt';

/**
 * The cost factor (work factor) passed to bcrypt when generating a salt.
 *
 * A value of `12` requires approximately 300 ms of computation on modern
 * hardware, providing a strong resistance to brute-force attacks while
 * remaining acceptable for real-time authentication flows.  Increasing this
 * value doubles the hashing time for each additional round.
 *
 * @internal
 */
const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt with a randomly generated salt.
 *
 * The resulting hash is safe to store in the database.  Because bcrypt embeds
 * the salt inside the hash string, no separate salt column is required.
 *
 * Always await this function; it is intentionally asynchronous to avoid
 * blocking the Node.js event loop during the CPU-intensive hashing operation.
 *
 * @param plain - The plain-text password supplied by the user at registration
 *   or password-change time.
 * @returns A promise that resolves to the bcrypt hash string (60 characters).
 *
 * @example
 * const hash = await hashPassword('MyS3cur3P@ss!');
 * // Store `hash` in the users table — never store `plain`.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/**
 * Compares a plain-text candidate password against a stored bcrypt hash.
 *
 * Internally bcrypt extracts the salt from the `hashed` string and re-hashes
 * `plain` with the same parameters before performing a timing-safe comparison,
 * making this function safe against timing attacks.
 *
 * @param plain  - The plain-text password provided by the user at login.
 * @param hashed - The bcrypt hash previously produced by {@link hashPassword}
 *   and retrieved from the database.
 * @returns A promise that resolves to `true` when the passwords match, or
 *   `false` when they do not.
 *
 * @example
 * const isValid = await comparePassword(loginDto.password, user.passwordHash);
 * if (!isValid) throw new UnauthorizedException('Invalid credentials');
 */
export async function comparePassword(
  plain: string,
  hashed: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}
