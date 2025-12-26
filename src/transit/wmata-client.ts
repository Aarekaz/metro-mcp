/**
 * WMATA (DC Metro) API Client
 *
 * Implements the Transit API abstraction for Washington DC Metro system.
 * Wraps WMATA REST API and normalizes data to common Transit interfaces.
 */

import {
  TransitAPIClient,
  TransitStation,
  TransitPrediction,
  TransitIncident,
} from './base';
import { WMATAStation, WMATAPrediction, WMATAIncident } from '../types';
import { WMATAError } from '../error-handler';

export class WMATAClient extends TransitAPIClient {
  private baseUrl = 'https://api.wmata.com';

  constructor(apiKey: string) {
    super('dc', apiKey);
  }

  /**
   * Make HTTP request to WMATA API with caching
   */
  private async makeRequest<T>(endpoint: string, cacheTtl: number = 60): Promise<T> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'api_key': this.apiKey!,
          'Accept': 'application/json',
        },
        // Cloudflare edge caching
        cf: {
          cacheTtl: cacheTtl,
          cacheEverything: true,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new WMATAError(`API request failed: ${errorText}`, response.status);
      }

      const data = (await response.json()) as T;
      return data;
    } catch (error) {
      if (error instanceof WMATAError) {
        throw error;
      }
      throw new WMATAError('Network error while connecting to WMATA API', undefined, error);
    }
  }

  /**
   * Normalize WMATA station to common Transit format
   */
  private normalizeStation(wmataStation: WMATAStation): TransitStation {
    return {
      id: wmataStation.Code,
      name: wmataStation.Name,
      city: 'dc',
      latitude: wmataStation.Lat,
      longitude: wmataStation.Lon,
      lines: [
        wmataStation.LineCode1,
        wmataStation.LineCode2,
        wmataStation.LineCode3,
        wmataStation.LineCode4,
      ].filter((code): code is string => code !== null && code !== ''),
      address: {
        street: wmataStation.Address.Street,
        city: wmataStation.Address.City,
        state: wmataStation.Address.State,
        zip: wmataStation.Address.Zip,
      },
    };
  }

  /**
   * Normalize WMATA prediction to common Transit format
   */
  private normalizePrediction(wmataPrediction: WMATAPrediction): TransitPrediction {
    return {
      city: 'dc',
      line: wmataPrediction.Line,
      destination: wmataPrediction.DestinationName,
      destinationCode: wmataPrediction.DestinationCode,
      arrivalTime: wmataPrediction.Min, // WMATA uses "ARR", "BRD", or minutes
      minutesAway: wmataPrediction.Min,
      cars: wmataPrediction.Car,
    };
  }

  /**
   * Normalize WMATA incident to common Transit format
   */
  private normalizeIncident(wmataIncident: WMATAIncident): TransitIncident {
    return {
      city: 'dc',
      incidentId: wmataIncident.IncidentID,
      description: wmataIncident.Description,
      linesAffected: wmataIncident.LinesAffected.split(';')
        .map((line) => line.trim())
        .filter((line) => line.length > 0),
      severity: wmataIncident.DelaySeverity || 'Unknown',
      incidentType: wmataIncident.IncidentType,
      timestamp: wmataIncident.DateUpdated,
      passengerDelay: wmataIncident.PassengerDelay,
      startLocation: wmataIncident.StartLocationFullName || undefined,
      endLocation: wmataIncident.EndLocationFullName || undefined,
    };
  }

  /**
   * Get all DC Metro stations
   */
  async getStations(): Promise<TransitStation[]> {
    // Station data changes rarely, cache for 1 hour
    const data = await this.makeRequest<{ Stations: WMATAStation[] }>(
      '/Rail.svc/json/jStations',
      3600
    );
    return data.Stations.map((station) => this.normalizeStation(station));
  }

  /**
   * Get real-time train predictions for a station
   */
  async getStationPredictions(stationCode: string): Promise<TransitPrediction[]> {
    // Train predictions change frequently, cache for 30 seconds
    const data = await this.makeRequest<{ Trains: WMATAPrediction[] }>(
      `/StationPrediction.svc/json/GetPrediction/${stationCode}`,
      30
    );
    return data.Trains.map((prediction) => this.normalizePrediction(prediction));
  }

  /**
   * Get current service incidents
   */
  async getIncidents(): Promise<TransitIncident[]> {
    // Incidents change moderately, cache for 5 minutes
    const data = await this.makeRequest<{ Incidents: WMATAIncident[] }>(
      '/Incidents.svc/json/Incidents',
      300
    );
    return data.Incidents.map((incident) => this.normalizeIncident(incident));
  }

  /**
   * Get elevator and escalator incidents
   * Note: This is DC Metro specific, not part of base Transit interface
   */
  async getElevatorIncidents(): Promise<TransitIncident[]> {
    // Elevator incidents change moderately, cache for 5 minutes
    const data = await this.makeRequest<{ ElevatorIncidents: WMATAIncident[] }>(
      '/Incidents.svc/json/ElevatorIncidents',
      300
    );
    return data.ElevatorIncidents.map((incident) => this.normalizeIncident(incident));
  }

  /**
   * Search for stations by name or code
   */
  async searchStation(query: string): Promise<TransitStation[]> {
    const stations = await this.getStations();
    const queryLower = query.toLowerCase();

    return stations.filter(
      (station) =>
        station.name.toLowerCase().includes(queryLower) ||
        station.id.toLowerCase() === queryLower
    );
  }

  /**
   * Get stations on a specific line
   */
  async getStationsByLine(lineCode: string): Promise<TransitStation[]> {
    const stations = await this.getStations();
    const lineUpper = lineCode.toUpperCase();

    return stations.filter((station) => station.lines.includes(lineUpper));
  }
}
