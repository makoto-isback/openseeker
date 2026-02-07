import AsyncStorage from '@react-native-async-storage/async-storage';

const ALERTS_KEY = '@openseeker/alerts';

export interface PriceAlert {
  id: string;
  token: string;
  condition: 'above' | 'below';
  targetPrice: number;
  createdAt: number;
  triggered: boolean;
  triggeredAt?: number;
}

export async function getAlerts(): Promise<PriceAlert[]> {
  const value = await AsyncStorage.getItem(ALERTS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

export async function addAlert(
  token: string,
  condition: 'above' | 'below',
  targetPrice: number,
): Promise<PriceAlert> {
  const alerts = await getAlerts();
  const alert: PriceAlert = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    token: token.toUpperCase(),
    condition,
    targetPrice,
    createdAt: Date.now(),
    triggered: false,
  };
  alerts.push(alert);
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  return alert;
}

export async function removeAlert(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const filtered = alerts.filter((a) => a.id !== alertId);
  await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(filtered));
}

export async function markAlertTriggered(alertId: string): Promise<void> {
  const alerts = await getAlerts();
  const alert = alerts.find((a) => a.id === alertId);
  if (alert) {
    alert.triggered = true;
    alert.triggeredAt = Date.now();
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
  }
}

export async function checkAlerts(
  currentPrices: Record<string, { price: number }>,
): Promise<PriceAlert[]> {
  const alerts = await getAlerts();
  const triggered: PriceAlert[] = [];

  for (const alert of alerts) {
    if (alert.triggered) continue;
    const priceData = currentPrices[alert.token];
    if (!priceData) continue;

    const isTriggered =
      (alert.condition === 'above' && priceData.price >= alert.targetPrice) ||
      (alert.condition === 'below' && priceData.price <= alert.targetPrice);

    if (isTriggered) {
      triggered.push(alert);
    }
  }

  return triggered;
}
