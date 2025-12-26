import { MCPRequest, MCPResponse, MCPCapabilities } from './mcp-types';
import { MCP_TOOLS } from './mcp-tools';
import { Env } from './types';
import { validateToolParameters, handleWMATAError } from './error-handler';
import { getTransitClient, isSupportedCity } from './transit/registry';
import { SupportedCity } from './transit/base';
import { WMATAClient } from './transit/wmata-client';

export class MCPHandler {
  async processMCPMethod(request: MCPRequest, env: Env): Promise<MCPResponse> {
    const { method, params = {}, id } = request;
    
    try {
      switch (method) {
        case 'initialize':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: {
                  listChanged: true
                }
              } as MCPCapabilities,
              serverInfo: {
                name: 'Metro MCP',
                version: '1.0.0'
              }
            }
          };

        case 'notifications/initialized':
          // Client is signaling it has processed the initialize response
          // Per JSON-RPC 2.0, notifications should not receive responses
          // Return a minimal response that the router will handle appropriately
          return {
            jsonrpc: '2.0',
            id: null,
            result: null
          } as MCPResponse;

        case 'tools/list':
          return {
            jsonrpc: '2.0',
            id,
            result: {
              tools: MCP_TOOLS
            }
          };

        case 'tools/call':
          return await this.handleToolCall(params, env, id);

        default:
          throw new Error(`Unknown method: ${method}`);
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async handleToolCall(params: any, env: Env, id: string | number): Promise<MCPResponse> {
    const { name: toolName, arguments: args = {} } = params;

    // Validate tool parameters
    try {
      validateToolParameters(toolName, args);
    } catch (validationError) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: validationError instanceof Error ? validationError.message : 'Invalid parameters'
        }
      };
    }

    // Validate city parameter
    const city = args.city as string;
    if (!city || !isSupportedCity(city)) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: `Unsupported city: ${city}. Supported cities: dc, nyc`
        }
      };
    }

    // Get transit client for the specified city
    let client;
    try {
      client = getTransitClient(city as SupportedCity, env);
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: error instanceof Error ? error.message : 'Failed to initialize transit client'
        }
      };
    }

    try {
      let result;

      switch (toolName) {
        case 'get_station_predictions': {
          const stationName = args.stationName as string;

          // Auto-convert station name to ID
          let stationId: string;
          // Check if it's already a station code (DC: letter + 2 digits, NYC: numeric)
          if (/^[A-Z]\d{2}$/i.test(stationName)) {
            // DC station code format
            stationId = stationName.toUpperCase();
          } else if (/^\d+[NS]?$/.test(stationName)) {
            // NYC station ID format
            stationId = stationName;
          } else {
            // Search for station by name
            const searchResults = await client.searchStation(stationName);
            if (searchResults.length === 0) {
              throw new Error(`No station found matching: ${stationName}`);
            }
            stationId = searchResults[0]!.id;
          }

          const predictions = await client.getStationPredictions(stationId);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  city,
                  station: stationId,
                  predictions: predictions.map(p => ({
                    line: p.line,
                    destination: p.destination,
                    minutes: typeof p.minutesAway === 'string'
                      ? p.minutesAway
                      : `${p.minutesAway} min`,
                    cars: p.cars,
                    direction: p.direction,
                    track: p.track
                  }))
                }, null, 2)
              }
            ]
          };
          break;
        }

        case 'search_stations': {
          const query = args.query as string;
          const stations = await client.searchStation(query);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  city,
                  query,
                  results: stations.map(s => ({
                    id: s.id,
                    name: s.name,
                    lines: s.lines,
                    coordinates: { lat: s.latitude, lon: s.longitude },
                    address: s.address
                  }))
                }, null, 2)
              }
            ]
          };
          break;
        }

        case 'get_stations_by_line': {
          const lineCode = args.lineCode as string;
          const lineStations = await client.getStationsByLine(lineCode);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  city,
                  line: lineCode,
                  stations: lineStations.map(s => ({
                    id: s.id,
                    name: s.name,
                    coordinates: { lat: s.latitude, lon: s.longitude },
                    address: s.address
                  }))
                }, null, 2)
              }
            ]
          };
          break;
        }

        case 'get_incidents': {
          const incidents = await client.getIncidents();
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  city,
                  incidents: incidents.map(i => ({
                    id: i.incidentId,
                    description: i.description,
                    linesAffected: i.linesAffected,
                    severity: i.severity,
                    type: i.incidentType,
                    lastUpdated: i.timestamp
                  }))
                }, null, 2)
              }
            ]
          };
          break;
        }

        case 'get_elevator_incidents': {
          // Elevator incidents only supported for DC
          if (city !== 'dc') {
            throw new Error('Elevator incidents are only supported for DC Metro');
          }
          const wmataClient = client as WMATAClient;
          const elevatorIncidents = await wmataClient.getElevatorIncidents();
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  city,
                  elevatorIncidents: elevatorIncidents.map(i => ({
                    id: i.incidentId,
                    description: i.description,
                    stationName: i.startLocation || i.endLocation,
                    lastUpdated: i.timestamp
                  }))
                }, null, 2)
              }
            ]
          };
          break;
        }

        case 'get_all_stations': {
          const allStations = await client.getStations();
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  city,
                  totalStations: allStations.length,
                  stations: allStations.map(s => ({
                    id: s.id,
                    name: s.name,
                    lines: s.lines,
                    coordinates: { lat: s.latitude, lon: s.longitude },
                    address: s.address
                  }))
                }, null, 2)
              }
            ]
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        jsonrpc: '2.0',
        id,
        result
      };
    } catch (error) {
      // Provide more specific error codes based on the error type
      let errorCode = -32603; // Default internal error
      let errorMessage = 'Internal error';

      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Access denied')) {
          errorCode = -32602;
          errorMessage = 'Invalid params';
        } else if (error.message.includes('400') || error.message.includes('Bad Request')) {
          errorCode = -32602;
          errorMessage = 'Invalid params';
        } else if (error.message.includes('404') || error.message.includes('Not Found')) {
          errorCode = -32601;
          errorMessage = 'Method not found';
        }
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: errorCode,
          message: errorMessage,
          data: handleWMATAError(error)
        }
      };
    }
  }
}