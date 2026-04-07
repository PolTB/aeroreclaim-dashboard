/**
 * GA4 Measurement Protocol client for server-side event tracking.
 * Docs: https://developers.google.com/analytics/devguides/collection/protocol/ga4
 */

const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const GA4_API_SECRET = process.env.GA4_API_SECRET;
const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

// Stable client_id for server-generated events (not tied to a browser session)
const SERVER_CLIENT_ID = 'aeroreclaim-dashboard-server';

export async function trackEvent(
  eventName: string,
  params: Record<string, unknown>,
): Promise<void> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) return;

  try {
    await fetch(
      `${GA4_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: SERVER_CLIENT_ID,
          events: [{ name: eventName, params }],
        }),
      },
    );
  } catch (err) {
    // Non-fatal: analytics must never break the main request
    console.error('[analytics] trackEvent failed:', eventName, err);
  }
}
