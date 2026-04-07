const GA4_MEASUREMENT_ID = process.env.GA4_MEASUREMENT_ID;
const GA4_API_SECRET     = process.env.GA4_API_SECRET;

export async function trackEvent(
  eventName: string,
  params: Record<string, unknown>,
): Promise<void> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) return;
  try {
    await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: 'aeroreclaim-dashboard',
          events: [{ name: eventName, params }],
        }),
      },
    );
  } catch {
    // Non-critical — never throw
  }
}
