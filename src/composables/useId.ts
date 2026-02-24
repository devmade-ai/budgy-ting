/**
 * UUID generation for record IDs.
 *
 * Requirement: All records use string UUIDs as primary keys
 * Approach: crypto.randomUUID() — available in all modern browsers and PWA contexts
 */

export function useId(): string {
  return crypto.randomUUID()
}
