import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MTAClient } from '../../src/transit/mta-client';

function encodedFeed(stops: Array<{ stopId: string; arrival: number }>): Uint8Array {
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.create({
    header: { gtfsRealtimeVersion: '2.0' },
    entity: [{
      id: 'trip-1',
      tripUpdate: {
        trip: { routeId: 'A' },
        stopTimeUpdate: stops.map(stop => ({
          stopId: stop.stopId,
          arrival: { time: stop.arrival }
        }))
      }
    }]
  });
  return GtfsRealtimeBindings.transit_realtime.FeedMessage.encode(feed).finish();
}

describe('MTAClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('filters stale arrivals and reports the terminal station as destination', async () => {
    const now = Math.floor(Date.now() / 1000);
    const feed = encodedFeed([
      { stopId: '127N', arrival: now - 20 * 60 },
      { stopId: '127N', arrival: now + 5 * 60 },
      { stopId: '101N', arrival: now + 30 * 60 }
    ]);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(feed)));

    const predictions = await new MTAClient().getStationPredictions('127');

    expect(predictions).toHaveLength(8);
    expect(predictions.every(prediction => prediction.minutesAway === 5)).toBe(true);
    expect(predictions.every(prediction => prediction.destination !== '127N')).toBe(true);
    expect(predictions.every(prediction => prediction.destination === 'Van Cortlandt Park-242 St')).toBe(true);
  });

  it('throws when every real-time feed is unavailable', async () => {
    vi.advanceTimersByTime(31_000);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(new MTAClient().getStationPredictions('127')).rejects.toThrow(
      'All MTA real-time feeds are unavailable'
    );
  });

  it('surfaces alerts-feed failures instead of returning no incidents', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(new MTAClient().getIncidents()).rejects.toThrow('MTA alerts fetch failed: 503');
  });
});
