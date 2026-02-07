import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Initialize notification system: request permissions and configure channels.
 */
export async function initializeNotifications(): Promise<boolean> {
  // Set notification handler for foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Create notification channel on Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('openseeker-alerts', {
      name: 'OpenSeeker Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return false;
  }

  return true;
}

/**
 * Send a local push notification immediately.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'openseeker-alerts' }),
      },
      trigger: null, // immediate
    });
  } catch (error) {
    console.log('[Notifications] Failed to send:', error);
  }
}

/**
 * Schedule a daily notification at a specific hour and minute.
 */
export async function scheduleDailyNotification(
  id: string,
  title: string,
  body: string,
  hour: number,
  minute: number,
  data?: Record<string, unknown>,
): Promise<void> {
  // Cancel existing schedule with same ID
  await cancelScheduledNotification(id);

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: {
        title,
        body,
        data: data || {},
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'openseeker-alerts' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (error) {
    console.log('[Notifications] Failed to schedule:', error);
  }
}

/**
 * Cancel a scheduled notification by identifier.
 */
export async function cancelScheduledNotification(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // ignore — notification may not exist
  }
}

/**
 * Cancel all scheduled notifications.
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Add a listener for notification responses (taps).
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void,
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
