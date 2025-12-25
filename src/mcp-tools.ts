import { MCPTool } from './mcp-types';

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'get_station_predictions',
    description: 'Get real-time train arrival predictions for a Metro station',
    inputSchema: {
      type: 'object',
      properties: {
        stationCode: {
          type: 'string',
          description: 'Station code (e.g., A01, C05)'
        }
      },
      required: ['stationCode']
    }
  },
  {
    name: 'search_stations',
    description: 'Search for Metro stations by name or code',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (station name or code)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'get_stations_by_line',
    description: 'Get all stations on a specific Metro line',
    inputSchema: {
      type: 'object',
      properties: {
        lineCode: {
          type: 'string',
          description: 'Metro line code (RD, BL, YL, OR, GR, SV)',
          enum: ['RD', 'BL', 'YL', 'OR', 'GR', 'SV']
        }
      },
      required: ['lineCode']
    }
  },
  {
    name: 'get_incidents',
    description: 'Get current Metro rail incidents and service advisories',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_elevator_incidents',
    description: 'Get current elevator and escalator outages',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_all_stations',
    description: 'Get complete list of all Metro stations with coordinates',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];