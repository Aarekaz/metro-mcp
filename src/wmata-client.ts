import { WMATAStation, WMATAPrediction, WMATAIncident } from './types';
import { WMATAError } from './error-handler';

export class WMATAClient {
  private baseUrl = 'https://api.wmata.com';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest<T>(endpoint: string, cacheTtl: number = 60): Promise<T> {
    try {
      // In production, you'd use Cloudflare KV for caching with key: `wmata:${endpoint}`
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'api_key': this.apiKey,
          'Accept': 'application/json'
        },
        // Add cache headers for Cloudflare edge caching
        cf: {
          cacheTtl: cacheTtl,
          cacheEverything: true
        }
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new WMATAError(
          `API request failed: ${errorText}`,
          response.status
        );
      }

      const data = await response.json() as T;
      return data;
    } catch (error) {
      if (error instanceof WMATAError) {
        throw error;
      }
      throw new WMATAError(
        'Network error while connecting to WMATA API',
        undefined,
        error
      );
    }
  }

  async getStations(): Promise<WMATAStation[]> {
    // Station data changes rarely, cache for 1 hour
    const data = await this.makeRequest<{ Stations: WMATAStation[] }>('/Rail.svc/json/jStations', 3600);
    return data.Stations;
  }

  async getStationPredictions(stationCode: string): Promise<WMATAPrediction[]> {
    // Train predictions change frequently, cache for 30 seconds
    const data = await this.makeRequest<{ Trains: WMATAPrediction[] }>(`/StationPrediction.svc/json/GetPrediction/${stationCode}`, 30);
    return data.Trains;
  }

  async getIncidents(): Promise<WMATAIncident[]> {
    // Incidents change moderately, cache for 5 minutes
    const data = await this.makeRequest<{ Incidents: WMATAIncident[] }>('/Incidents.svc/json/Incidents', 300);
    return data.Incidents;
  }

  async getElevatorIncidents(): Promise<WMATAIncident[]> {
    // Elevator incidents change moderately, cache for 5 minutes
    const data = await this.makeRequest<{ ElevatorIncidents: WMATAIncident[] }>('/Incidents.svc/json/ElevatorIncidents', 300);
    return data.ElevatorIncidents;
  }

  async searchStation(query: string): Promise<WMATAStation[]> {
    const stations = await this.getStations();
    const queryLower = query.toLowerCase();
    
    return stations.filter(station => 
      station.Name.toLowerCase().includes(queryLower) ||
      station.Code.toLowerCase() === queryLower
    );
  }

  async getStationsByLine(lineCode: string): Promise<WMATAStation[]> {
    const stations = await this.getStations();
    const lineUpper = lineCode.toUpperCase();
    
    return stations.filter(station => 
      station.LineCode1 === lineUpper ||
      station.LineCode2 === lineUpper ||
      station.LineCode3 === lineUpper ||
      station.LineCode4 === lineUpper
    );
  }
}