import { WorkerEntrypoint } from 'cloudflare:workers';
import { WMATAClient } from './wmata-client';
import { Env } from './types';
import { validateStationCode, validateLineCode } from './error-handler';

export class MetroMCPServer extends WorkerEntrypoint<Env> {
  private wmataClient: WMATAClient;

  constructor(ctx: any, env: Env) {
    super(ctx, env);
    this.wmataClient = new WMATAClient(env.WMATA_API_KEY);
  }

  async getStationPredictions(stationCode: string) {
    const validatedCode = validateStationCode(stationCode);
    const predictions = await this.wmataClient.getStationPredictions(validatedCode);
    
    return {
      station: validatedCode,
      predictions: predictions.map(p => ({
        line: p.Line,
        destination: p.DestinationName,
        minutes: p.Min === 'ARR' ? 'Arriving' : p.Min === 'BRD' ? 'Boarding' : `${p.Min} min`,
        cars: p.Car === '' ? 'Unknown' : p.Car + ' cars'
      }))
    };
  }

  async searchStations(query: string) {
    const stations = await this.wmataClient.searchStation(query);
    
    return {
      query,
      results: stations.map(s => ({
        code: s.Code,
        name: s.Name,
        lines: [s.LineCode1, s.LineCode2, s.LineCode3, s.LineCode4].filter(line => line !== null && line !== ''),
        address: s.Address
      }))
    };
  }

  async getStationsByLine(lineCode: string) {
    const validatedLine = validateLineCode(lineCode);
    const stations = await this.wmataClient.getStationsByLine(validatedLine);
    
    return {
      line: validatedLine,
      stations: stations.map(s => ({
        code: s.Code,
        name: s.Name,
        address: s.Address
      }))
    };
  }

  async getIncidents() {
    const incidents = await this.wmataClient.getIncidents();
    
    return {
      incidents: incidents.map(i => ({
        id: i.IncidentID,
        description: i.Description,
        linesAffected: i.LinesAffected,
        lastUpdated: i.DateUpdated,
        incidentType: i.IncidentType
      }))
    };
  }

  async getElevatorIncidents() {
    const incidents = await this.wmataClient.getElevatorIncidents();
    
    return {
      elevatorIncidents: incidents.map(i => ({
        id: i.IncidentID,
        description: i.Description,
        stationName: i.StartLocationFullName || i.EndLocationFullName,
        lastUpdated: i.DateUpdated
      }))
    };
  }

  async getAllStations() {
    const stations = await this.wmataClient.getStations();
    
    return {
      totalStations: stations.length,
      stations: stations.map(s => ({
        code: s.Code,
        name: s.Name,
        lines: [s.LineCode1, s.LineCode2, s.LineCode3, s.LineCode4].filter(line => line !== null && line !== ''),
        coordinates: { lat: s.Lat, lon: s.Lon },
        address: s.Address
      }))
    };
  }

  async getRandomStationFact() {
    const stations = await this.wmataClient.getStations();
    
    if (stations.length === 0) {
      return {
        fact: 'No station data available at the moment.',
        station: null
      };
    }
    
    const randomStation = stations[Math.floor(Math.random() * stations.length)]!;
    const lines = [randomStation.LineCode1, randomStation.LineCode2, randomStation.LineCode3, randomStation.LineCode4].filter(line => line !== null && line !== '');
    
    return {
      fact: `Did you know? ${randomStation.Name} station (${randomStation.Code}) serves the ${lines.join(', ')} line${lines.length > 1 ? 's' : ''}.`,
      station: {
        code: randomStation.Code,
        name: randomStation.Name,
        lines: lines,
        coordinates: { lat: randomStation.Lat, lon: randomStation.Lon }
      }
    };
  }
}