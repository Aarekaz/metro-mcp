import { MCPTool } from './mcp-types';

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'get_station_predictions',
    description: 'Get real-time train arrival predictions for a transit station. Supports DC Metro and NYC Subway.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          enum: ['dc', 'nyc'],
          description: 'Transit system: "dc" for Washington DC Metro, "nyc" for NYC Subway'
        },
        stationName: {
          type: 'string',
          description: 'Station name (e.g., "Metro Center", "Times Square") - will be auto-converted to station ID. For DC you can also use station codes like "A01".'
        }
      },
      required: ['city', 'stationName']
    }
  },
  {
    name: 'search_stations',
    description: 'Search for transit stations by name or code. Supports DC Metro and NYC Subway.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          enum: ['dc', 'nyc'],
          description: 'Transit system: "dc" for Washington DC Metro, "nyc" for NYC Subway'
        },
        query: {
          type: 'string',
          description: 'Search query (station name or code, e.g., "Union", "127", "Dupont")'
        }
      },
      required: ['city', 'query']
    }
  },
  {
    name: 'get_stations_by_line',
    description: 'Get all stations on a specific transit line. Supports DC Metro and NYC Subway.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          enum: ['dc', 'nyc'],
          description: 'Transit system: "dc" for Washington DC Metro, "nyc" for NYC Subway'
        },
        lineCode: {
          type: 'string',
          description: 'Line code - DC: RD, BL, YL, OR, GR, SV | NYC: 1, 2, 3, 4, 5, 6, 7, A, C, E, B, D, F, M, N, Q, R, W, J, Z, L, G, SI'
        }
      },
      required: ['city', 'lineCode']
    }
  },
  {
    name: 'get_incidents',
    description: 'Get current transit incidents and service advisories. Supports DC Metro and NYC Subway.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          enum: ['dc', 'nyc'],
          description: 'Transit system: "dc" for Washington DC Metro, "nyc" for NYC Subway'
        }
      },
      required: ['city']
    }
  },
  {
    name: 'get_elevator_incidents',
    description: 'Get current elevator and escalator outages. DC Metro only.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          enum: ['dc'],
          description: 'Transit system: only "dc" is supported for elevator incidents'
        }
      },
      required: ['city']
    }
  },
  {
    name: 'get_all_stations',
    description: 'Get complete list of all transit stations with coordinates. Supports DC Metro and NYC Subway.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          enum: ['dc', 'nyc'],
          description: 'Transit system: "dc" for Washington DC Metro, "nyc" for NYC Subway'
        }
      },
      required: ['city']
    }
  }
];