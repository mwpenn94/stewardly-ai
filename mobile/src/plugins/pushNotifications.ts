/**
 * §P1-1 Mobile-native shell — Push Notification Handler
 * Wraps Capacitor Push Notifications plugin for iOS/Android.
 * Handles registration, token management, and notification routing.
 */

// Types for Capacitor Push Notifications (avoid direct import for web compat)
interface PushNotificationToken {
  value: string;
}

interface PushNotification {
  title?: string;
  body?: string;
  data: Record<string, unknown>;
  id: string;
}

interface PushNotificationActionPerformed {
  actionId: string;
  notification: PushNotification;
}

type TokenHandler = (token: PushNotificationToken) => void;
type NotificationHandler = (notification: PushNotification) => void;
type ActionHandler = (action: PushNotificationActionPerformed) => void;

let _tokenHandler: TokenHandler | null = null;
let _notificationHandler: NotificationHandler | null = null;
let _actionHandler: ActionHandler | null = null;

/**
 * Initialize push notifications.
 * Call this once at app startup (after Capacitor is ready).
 */
export async function initPushNotifications(): Promise<string | null> {
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Request permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.warn("[Push] Permission not granted:", permResult.receive);
      return null;
    }

    // Register with APNs/FCM
    await PushNotifications.register();

    // Listen for registration success
    PushNotifications.addListener("registration", (token: PushNotificationToken) => {
      console.log("[Push] Registered with token:", token.value.substring(0, 20) + "...");
      _tokenHandler?.(token);
    });

    // Listen for registration errors
    PushNotifications.addListener("registrationError", (error: unknown) => {
      console.error("[Push] Registration error:", error);
    });

    // Listen for incoming notifications (foreground)
    PushNotifications.addListener("pushNotificationReceived", (notification: PushNotification) => {
      console.log("[Push] Received:", notification.title);
      _notificationHandler?.(notification);
    });

    // Listen for notification taps
    PushNotifications.addListener("pushNotificationActionPerformed", (action: PushNotificationActionPerformed) => {
      console.log("[Push] Action:", action.actionId, action.notification.data);
      _actionHandler?.(action);
      // Route based on notification data
      routeNotification(action.notification);
    });

    return "initialized";
  } catch (err) {
    // Not running in Capacitor (web fallback)
    console.log("[Push] Not available (web environment)");
    return null;
  }
}

/** Set handler for token registration */
export function onTokenReceived(handler: TokenHandler): void {
  _tokenHandler = handler;
}

/** Set handler for foreground notifications */
export function onNotificationReceived(handler: NotificationHandler): void {
  _notificationHandler = handler;
}

/** Set handler for notification tap actions */
export function onNotificationAction(handler: ActionHandler): void {
  _actionHandler = handler;
}

/** Route notification to appropriate screen */
function routeNotification(notification: PushNotification): void {
  const data = notification.data;
  const route = data?.route as string | undefined;
  if (route && typeof window !== "undefined") {
    // Use history API for SPA routing
    window.history.pushState({}, "", route);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
