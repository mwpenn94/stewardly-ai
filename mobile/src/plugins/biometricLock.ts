/**
 * §P1-1 Mobile-native shell — Biometric Lock
 * Wraps Capacitor biometric authentication for secure app access.
 * Supports Face ID, Touch ID, and Android fingerprint.
 */

interface BiometricResult {
  verified: boolean;
  type?: "face" | "fingerprint" | "iris";
  error?: string;
}

let _biometricAvailable: boolean | null = null;

/**
 * Check if biometric authentication is available on this device.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (_biometricAvailable !== null) return _biometricAvailable;

  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    const result = await NativeBiometric.isAvailable();
    _biometricAvailable = result.isAvailable;
    return result.isAvailable;
  } catch {
    _biometricAvailable = false;
    return false;
  }
}

/**
 * Prompt user for biometric verification.
 * Returns verified: true if authentication succeeds.
 */
export async function verifyBiometric(reason: string = "Verify your identity"): Promise<BiometricResult> {
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");

    const available = await isBiometricAvailable();
    if (!available) {
      return { verified: false, error: "Biometric not available" };
    }

    await NativeBiometric.verifyIdentity({
      reason,
      title: "WealthBridge AI",
      subtitle: "Secure Access",
      description: reason,
    });

    return { verified: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Biometric verification failed";
    return { verified: false, error: message };
  }
}

/**
 * Store credentials securely in the device keychain/keystore.
 */
export async function storeCredentials(server: string, username: string, password: string): Promise<boolean> {
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    await NativeBiometric.setCredentials({ server, username, password });
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieve stored credentials (requires biometric verification).
 */
export async function getCredentials(server: string): Promise<{ username: string; password: string } | null> {
  try {
    const { NativeBiometric } = await import("capacitor-native-biometric");
    const credentials = await NativeBiometric.getCredentials({ server });
    return { username: credentials.username, password: credentials.password };
  } catch {
    return null;
  }
}
