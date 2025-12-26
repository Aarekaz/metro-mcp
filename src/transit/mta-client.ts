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
} from './base';

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

/**
 * NYC Subway static station data
 * In production, this would be loaded from GTFS static data
 * For now, including key stations as examples
 */
const NYC_STATIONS: TransitStation[] = [
  {
    id: '127',
    name: 'Times Square-42nd St',
    city: 'nyc',
    latitude: 40.7549,
    longitude: -73.9872,
    lines: ['1', '2', '3', '7', 'N', 'Q', 'R', 'W', 'S'],
  },
  {
    id: '902',
    name: 'Grand Central-42nd St',
    city: 'nyc',
    latitude: 40.7516,
    longitude: -73.9768,
    lines: ['4', '5', '6', '7', 'S'],
  },
  {
    id: 'R16',
    name: 'Union Square-14th St',
    city: 'nyc',
    latitude: 40.7347,
    longitude: -73.9907,
    lines: ['4', '5', '6', 'L', 'N', 'Q', 'R', 'W'],
  },
  {
    id: 'A27',
    name: 'Penn Station-34th St',
    city: 'nyc',
    latitude: 40.7505,
    longitude: -73.9911,
    lines: ['A', 'C', 'E'],
  },
  {
    id: 'D14',
    name: 'Herald Square-34th St',
    city: 'nyc',
    latitude: 40.7494,
    longitude: -73.9878,
    lines: ['B', 'D', 'F', 'M', 'N', 'Q', 'R', 'W'],
  },
  {
    id: 'R01',
    name: 'Whitehall St-South Ferry',
    city: 'nyc',
    latitude: 40.7033,
    longitude: -74.0129,
    lines: ['R', 'W'],
  },
  {
    id: 'A41',
    name: 'Fulton St',
    city: 'nyc',
    latitude: 40.7105,
    longitude: -74.0068,
    lines: ['A', 'C', 'J', 'Z', '2', '3', '4', '5'],
  },
];

export class MTAClient extends TransitAPIClient {
  private feedCache: Map<keyof typeof MTA_FEEDS, CachedFeed>;
  private cacheTTL: number;

  constructor() {
    super('nyc'); // No API key needed for MTA public feeds
    this.feedCache = new Map();
    this.cacheTTL = 30000; // 30 seconds per GTFS-realtime spec
  }

  /**
   * Fetch and parse a GTFS-realtime feed
   */
  private async fetchFeed(
    feedKey: keyof typeof MTA_FEEDS
  ): Promise<GtfsRealtimeBindings.transit_realtime.FeedMessage> {
    // Check cache
    const cached = this.feedCache.get(feedKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
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
    this.feedCache.set(feedKey, {
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
    const predictions: TransitPrediction[] = [];

    // Determine which feeds to check based on the station
    // For now, we'll check all feeds (in production, optimize this)
    const feedsToCheck = Object.keys(MTA_FEEDS) as (keyof typeof MTA_FEEDS)[];

    for (const feedKey of feedsToCheck) {
      try {
        const feed = await this.fetchFeed(feedKey);

        for (const entity of feed.entity) {
          if (!entity.tripUpdate) continue;

          const tripUpdate = entity.tripUpdate;
          const trip = tripUpdate.trip;

          if (!trip || !tripUpdate.stopTimeUpdate) continue;

          // Find stop time updates for this station
          for (const stopTimeUpdate of tripUpdate.stopTimeUpdate) {
            // Match station ID (handling directional suffixes like "127N", "127S")
            const stopId = stopTimeUpdate.stopId || '';
            const baseStopId = stopId.replace(/[NS]$/, '');

            if (baseStopId === stationId || stopId === stationId) {
              const arrivalTime = stopTimeUpdate.arrival?.time;
              if (!arrivalTime) continue;

              // Calculate minutes away
              const arrivalDate = new Date(Number(arrivalTime) * 1000);
              const now = new Date();
              const minutesAway = Math.floor((arrivalDate.getTime() - now.getTime()) / 60000);

              // Determine direction from stop_id suffix
              const direction = stopId.endsWith('N') ? 'NORTH' : stopId.endsWith('S') ? 'SOUTH' : undefined;

              predictions.push({
                city: 'nyc',
                line: trip.routeId || '',
                destination: stopTimeUpdate.stopId || 'Unknown',
                arrivalTime: arrivalDate.toISOString(),
                minutesAway: minutesAway <= 0 ? 'ARR' : minutesAway,
                direction,
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching MTA feed ${feedKey}:`, error);
        // Continue with other feeds
      }
    }

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
   */
  async getIncidents(): Promise<TransitIncident[]> {
    const incidents: TransitIncident[] = [];

    // Service alerts are in the GTFS-realtime feeds
    const feedsToCheck = Object.keys(MTA_FEEDS) as (keyof typeof MTA_FEEDS)[];

    for (const feedKey of feedsToCheck) {
      try {
        const feed = await this.fetchFeed(feedKey);

        for (const entity of feed.entity) {
          if (!entity.alert) continue;

          const alert = entity.alert;

          // Extract affected lines
          const linesAffected: string[] = [];
          if (alert.informedEntity) {
            for (const informed of alert.informedEntity) {
              if (informed.routeId) {
                linesAffected.push(informed.routeId);
              }
            }
          }

          // Get description
          const description = alert.headerText?.translation?.[0]?.text || 'Service alert';

          incidents.push({
            city: 'nyc',
            incidentId: entity.id || `${feedKey}-${Date.now()}`,
            description,
            linesAffected: [...new Set(linesAffected)], // Remove duplicates
            severity: 'Unknown', // MTA doesn't provide severity in standard format
            incidentType: 'Alert',
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error(`Error fetching MTA alerts from ${feedKey}:`, error);
      }
    }

    return incidents;
  }

  /**
   * Search for stations by name or code
   */
  async searchStation(query: string): Promise<TransitStation[]> {
    const normalizedQuery = query.toLowerCase().trim();

    return NYC_STATIONS.filter(
      (station) =>
        station.name.toLowerCase().includes(normalizedQuery) ||
        station.id.toLowerCase() === normalizedQuery
    );
  }

  /**
   * Get stations on a specific line
   */
  async getStationsByLine(lineCode: string): Promise<TransitStation[]> {
    return NYC_STATIONS.filter((station) => station.lines.includes(lineCode.toUpperCase()));
  }
}
