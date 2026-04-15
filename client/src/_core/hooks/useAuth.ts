/**
 * Re-export useAuth from the centralized AuthContext.
 *
 * The AuthContext manages the full auth lifecycle including guest provisioning,
 * so `loading` is true until both auth.me AND guest provisioning have resolved.
 * This prevents pages from flashing "Please sign in" during the provisioning window.
 *
 * All 106+ imports across the codebase continue to work without changes.
 */
export { useAuth } from "@/contexts/AuthContext";
