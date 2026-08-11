/**
 * MTA (NYC Subway) API Client
 *
 * Implements GTFS-realtime parsing for New York City subway system.
 * Uses Protocol Buffers to parse real-time train predictions from 8 separate feeds.
 */

import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import {
  TransitAPIClient,
  TransitStation,
  TransitPrediction,
  TransitIncident,
  TransitRoute,
  StationTransfer,
} from './base';
import { NYC_STATIONS } from './nyc-stations';
import { NYC_ROUTES } from './nyc-routes';

/**
 * MTA GTFS-Realtime feed URLs
 * Each feed serves specific subway lines
 */
const MTA_FEEDS = {
  'ACE': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace',
  'BDFM': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm',
  'G': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g',
  'JZ': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz',
  'NQRW': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw',
  'L': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l',
  '1234567': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs',
  'SIR': 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si',
} as const;

/**
 * Map subway lines to their corresponding feeds
 * TODO: Use this for optimized feed fetching based on line
 */
// const LINE_TO_FEED: Record<string, keyof typeof MTA_FEEDS> = {
//   'A': 'ACE', 'C': 'ACE', 'E': 'ACE',
//   'B': 'BDFM', 'D': 'BDFM', 'F': 'BDFM', 'M': 'BDFM',
//   'G': 'G',
//   'J': 'JZ', 'Z': 'JZ',
//   'N': 'NQRW', 'Q': 'NQRW', 'R': 'NQRW', 'W': 'NQRW',
//   'L': 'L',
//   '1': '1234567', '2': '1234567', '3': '1234567',
//   '4': '1234567', '5': '1234567', '6': '1234567', '7': '1234567',
//   'SI': 'SIR',
// };

interface CachedFeed {
  data: GtfsRealtimeBindings.transit_realtime.FeedMessage;
  timestamp: number;
}

// Module-scoped so cache entries survive the short-lived client objects created
// by individual MCP tool and resource handlers within the same Worker isolate.
const FEED_CACHE = new Map<keyof typeof MTA_FEEDS, CachedFeed>();
const FEED_CACHE_TTL_MS = 30_000;
const ARRIVAL_GRACE_SECONDS = 60;

export class MTAClient extends TransitAPIClient {
  constructor() {
    super('nyc'); // No API key needed for MTA public feeds
  }

  /**
   * Fetch and parse a GTFS-realtime feed
   */
  private async fetchFeed(
    feedKey: keyof typeof MTA_FEEDS
  ): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage> {
    // Check cache
    const cached = FEED_CACHE.get(feedKey);
    if (cached && Date.now() - cached.timestamp < FEED_CACHE_TTL_MS) {
      return cached.data;
    }

    // Fetch fresh data
    const feedUrl = MTA_FEEDS[feedKey];
    const response = await fetch(feedUrl);

    if (!response.ok) {
      throw new Error(`MTA feed fetch failed: ${response.status} ${response.statusText}`);
    }

    // Parse protobuf
    const buffer = await response.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
      new Uint8Array(buffer)
    );

    // Cache the parsed feed
    FEED_CACHE.set(feedKey, {
      data: feed,
      timestamp: Date.now(),
    });

    return feed;
  }

  /**
   * Get all stations in NYC subway system
   */
  async getStations(): Promise<TransitStation[]> {
    // In production, this would load from GTFS static data
    // For now, returning the sample stations
    return NYC_STATIONS;
  }

  /**
   * Get real-time train predictions for a station
   */
  async getStationPredictions(stationId: string): Promise<TransitPrediction[]> {
    const feedsToCheck = Object.keys(MTA_FEEDS) as (keyof typeof MTA_FEEDS)[];
    const nowSeconds = Math.floor(Date.now() / 1000);
    const requestedBaseId = stationId.replace(/[NS]$/, '');

    const feedResults = await Promise.allSettled(
      feedsToCheck.map(async feedKey => {
        const predictions: TransitPrediction[] = [];
        const feed = await this.fetchFeed(feedKey);

        for (const entity of feed.entity) {
          if (!entity.tripUpdate) continue;

          const tripUpdate = entity.tripUpdate;
          const trip = tripUpdate.trip;

          if (!trip || !tripUpdate.stopTimeUpdate) continue;

          const lastStopId = [...tripUpdate.stopTimeUpdate]
            .reverse()
            .find(update => update.stopId)?.stopId;
          const destinationId = lastStopId?.replace(/[NS]$/, '');
          const destination = destinationId
            ? NYC_STATIONS.find(station => station.id === destinationId)?.name || lastStopId || 'Unknown'
            : 'Unknown';

          for (const stopTimeUpdate of tripUpdate.stopTimeUpdate) {
            const stopId = stopTimeUpdate.stopId || '';
            const baseStopId = stopId.replace(/[NS]$/, '');
            const stationMatches = stationId === requestedBaseId
              ? baseStopId === requestedBaseId
              : stopId === stationId;

            if (stationMatches) {
              const arrivalTime = stopTimeUpdate.arrival?.time;
              if (!arrivalTime) continue;

              const arrivalSeconds = Number(arrivalTime);
              const secondsAway = arrivalSeconds - nowSeconds;
              if (secondsAway < -ARRIVAL_GRACE_SECONDS) continue;

              const arrivalDate = new Date(arrivalSeconds * 1000);
              const minutesAway = secondsAway <= ARRIVAL_GRACE_SECONDS
                ? 'ARR'
                : Math.floor(secondsAway / 60);

              const direction = stopId.endsWith('N') ? 'NORTH' : stopId.endsWith('S') ? 'SOUTH' : undefined;

              predictions.push({
                city: 'nyc',
                line: trip.routeId || '',
                destination,
                arrivalTime: arrivalDate.toISOString(),
                minutesAway,
                direction,
              });
            }
          }
        }

        return predictions;
      })
    );

    const successfulFeeds = feedResults.filter(
      (result): result is PromiseFulfilledResult<TransitPrediction[]> => result.status === 'fulfilled'
    );
    if (successfulFeeds.length === 0) {
      throw new Error('All MTA real-time feeds are unavailable');
    }

    const failedFeedCount = feedResults.length - successfulFeeds.length;
    if (failedFeedCount > 0) {
      console.warn(`MTA predictions are partial: ${failedFeedCount} feed(s) failed`);
    }

    const predictions = successfulFeeds.flatMap(result => result.value);

    // Sort by arrival time
    predictions.sort((a, b) => {
      if (a.minutesAway === 'ARR') return -1;
      if (b.minutesAway === 'ARR') return 1;
      return (a.minutesAway as number) - (b.minutesAway as number);
    });

    return predictions;
  }

  /**
   * Get current service alerts and incidents
   * Uses dedicated subway-alerts feed for better performance (1 call vs 8)
   */
  async getIncidents(): Promise<TransitIncident[]> {
    const incidents: TransitIncident[] = [];

    // Fetch from dedicated alerts feed (JSON format, faster than protobuf)
    const response = await fetch(
      'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json'
    );

    if (!response.ok) {
      throw new Error(`MTA alerts fetch failed: ${response.status}`);
    }

    const data = await response.json() as any;

    for (const entity of data.entity || []) {
      if (!entity.alert) continue;

      const alert = entity.alert;

      // Extract affected lines from informed_entity
      const linesAffected: string[] = [];
      if (alert.informed_entity) {
        for (const informed of alert.informed_entity) {
          if (informed.route_id) {
            linesAffected.push(informed.route_id);
          }
        }
      }

      // Get plain text description (prefer over HTML)
      const description =
        alert.header_text?.translation?.find((t: any) => t.language === 'en')?.text ||
        alert.header_text?.translation?.[0]?.text ||
        'Service alert';

      // Get alert type from mercury extensions
      const alertType = alert['transit_realtime.mercury_alert']?.alert_type || 'Alert';

      // Get timestamp from mercury extensions
      const updatedAt = alert['transit_realtime.mercury_alert']?.updated_at;
      const timestamp = updatedAt
        ? new Date(updatedAt * 1000).toISOString()
        : new Date().toISOString();

      incidents.push({
        city: 'nyc',
        incidentId: entity.id,
        description,
        linesAffected: [...new Set(linesAffected)], // Remove duplicates
        severity: alertType, // Use alert_type as severity (Delays, Service Change, etc.)
        incidentType: alertType,
        timestamp,
      });
    }

    return incidents;
  }

  /**
   * Search for stations by name or code
   * Handles common abbreviations (Square→Sq, Street→St, etc.)
   */
  async searchStation(query: string): Promise<TransitStation[]> {
    const normalizedQuery = query.toLowerCase().trim();

    // Common abbreviation mappings for fuzzy matching
    const fuzzyQuery = normalizedQuery
      .replace(/\bsquare\b/g, 'sq')
      .replace(/\bstreet\b/g, 'st')
      .replace(/\bavenue\b/g, 'av')
      .replace(/\bboulevard\b/g, 'blvd')
      .replace(/\broad\b/g, 'rd');

    return NYC_STATIONS.filter(
      (station) => {
        const stationName = station.name.toLowerCase();
        return (
          stationName.includes(normalizedQuery) ||
          stationName.includes(fuzzyQuery) ||
          station.id.toLowerCase() === normalizedQuery
        );
      }
    );
  }

  /**
   * Get stations on a specific line
   */
  async getStationsByLine(lineCode: string): Promise<TransitStation[]> {
    return NYC_STATIONS.filter((station) => station.lines.includes(lineCode.toUpperCase()));
  }

  /**
   * Get detailed route information
   */
  async getRouteInfo(routeId: string): Promise<TransitRoute | null> {
    const route = NYC_ROUTES.find((r) => r.routeId === routeId.toUpperCase());
    return route || null;
  }

  /**
   * Get transfer connections from a station
   */
  async getStationTransfers(stationId: string): Promise<StationTransfer[]> {
    const station = NYC_STATIONS.find((s) => s.id === stationId);
    return station?.transfers || [];
  }
}
