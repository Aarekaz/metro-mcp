import { MCPRequest, MCPResponse, MCPCapabilities } from './mcp-types';
import { MCP_TOOLS } from './mcp-tools';
import { WMATAClient } from './wmata-client';
import { Env } from './types';
import { validateStationCode, validateLineCode, validateSearchQuery, validateToolParameters, handleWMATAError } from './error-handler';

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
              protocolVersion: '2024-11-05',
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
    
    // Check if API key is available
    if (!env.WMATA_API_KEY || env.WMATA_API_KEY.trim() === '') {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'WMATA API key is not configured. Please check server configuration.'
        }
      };
    }
    
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
    
    const wmataClient = new WMATAClient(env.WMATA_API_KEY);
    
    try {
      let result;

      switch (toolName) {
        case 'get_station_predictions':
          const stationCode = validateStationCode(args.stationCode);
          const predictions = await wmataClient.getStationPredictions(stationCode);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  station: stationCode,
                  predictions: predictions.map(p => ({
                    line: p.Line,
                    destination: p.DestinationName,
                    minutes: p.Min === 'ARR' ? 'Arriving' : p.Min === 'BRD' ? 'Boarding' : `${p.Min} min`,
                    cars: p.Car === '' ? 'Unknown' : p.Car + ' cars',
                    group: p.Group
                  }))
                }, null, 2)
              }
            ]
          };
          break;

        case 'search_stations':
          const query = validateSearchQuery(args.query);
          const stations = await wmataClient.searchStation(query);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  query,
                  results: stations.map(s => ({
                    code: s.Code,
                    name: s.Name,
                    lines: [s.LineCode1, s.LineCode2, s.LineCode3, s.LineCode4].filter(line => line !== null && line !== ''),
                    address: s.Address
                  }))
                }, null, 2)
              }
            ]
          };
          break;

        case 'get_stations_by_line':
          const lineCode = validateLineCode(args.lineCode);
          const lineStations = await wmataClient.getStationsByLine(lineCode);
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  line: lineCode,
                  stations: lineStations.map(s => ({
                    code: s.Code,
                    name: s.Name,
                    address: s.Address
                  }))
                }, null, 2)
              }
            ]
          };
          break;

        case 'get_incidents':
          const incidents = await wmataClient.getIncidents();
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  incidents: incidents.map(i => ({
                    id: i.IncidentID,
                    description: i.Description,
                    linesAffected: i.LinesAffected,
                    lastUpdated: i.DateUpdated,
                    incidentType: i.IncidentType
                  }))
                }, null, 2)
              }
            ]
          };
          break;

        case 'get_elevator_incidents':
          const elevatorIncidents = await wmataClient.getElevatorIncidents();
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  elevatorIncidents: elevatorIncidents.map(i => ({
                    id: i.IncidentID,
                    description: i.Description,
                    stationName: i.StartLocationFullName || i.EndLocationFullName,
                    lastUpdated: i.DateUpdated
                  }))
                }, null, 2)
              }
            ]
          };
          break;

        case 'get_all_stations':
          const allStations = await wmataClient.getStations();
          result = {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  totalStations: allStations.length,
                  stations: allStations.map(s => ({
                    code: s.Code,
                    name: s.Name,
                    lines: [s.LineCode1, s.LineCode2, s.LineCode3, s.LineCode4].filter(line => line !== null && line !== ''),
                    coordinates: { lat: s.Lat, lon: s.Lon },
                    address: s.Address
                  }))
                }, null, 2)
              }
            ]
          };
          break;

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