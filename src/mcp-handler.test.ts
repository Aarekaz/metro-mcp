import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MCPHandler } from './mcp-handler';
import { WMATAClient } from './wmata-client';
import { Env } from './types';

// Mock WMATAClient
vi.mock('./wmata-client');
const MockedWMATAClient = vi.mocked(WMATAClient);

describe('MCPHandler', () => {
  let handler: MCPHandler;
  let mockClient: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockClient = {
      getStationPredictions: vi.fn(),
      searchStation: vi.fn(),
      getStationsByLine: vi.fn(),
      getStations: vi.fn(),
      getIncidents: vi.fn(),
      getElevatorIncidents: vi.fn()
    };
    
    MockedWMATAClient.mockImplementation(() => mockClient);
    handler = new MCPHandler();
    mockEnv = {
      WMATA_API_KEY: 'test-api-key'
    };
  });

  describe('handleToolCall', () => {
    it('should handle get_station_predictions tool', async () => {
      const mockPredictions = [
        { DestinationName: 'Shady Grove', Min: '2', Line: 'RD', Car: '8', Group: '1' }
      ];
      mockClient.getStationPredictions.mockResolvedValue(mockPredictions);

      const result = await handler.handleToolCall({
        name: 'get_station_predictions',
        arguments: { stationCode: 'A01' }
      }, mockEnv, 1);

      expect(mockClient.getStationPredictions).toHaveBeenCalledWith('A01');
      expect(result.result?.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('A01')
      }]);
    });

    it('should handle search_stations tool', async () => {
      const mockStations = [
        { Code: 'A01', Name: 'Metro Center', Lat: 38.898, Lon: -77.028, Address: {} }
      ];
      mockClient.searchStation.mockResolvedValue(mockStations);

      const result = await handler.handleToolCall({
        name: 'search_stations',
        arguments: { query: 'Metro' }
      }, mockEnv, 1);

      expect(mockClient.searchStation).toHaveBeenCalledWith('Metro');
      expect(result.result?.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('Metro')
      }]);
    });

    it('should handle get_stations_by_line tool', async () => {
      const mockStations = [
        { Code: 'A01', Name: 'Metro Center', LineCode1: 'RD', Address: {} }
      ];
      mockClient.getStationsByLine.mockResolvedValue(mockStations);

      const result = await handler.handleToolCall({
        name: 'get_stations_by_line',
        arguments: { lineCode: 'RD' }
      }, mockEnv, 1);

      expect(mockClient.getStationsByLine).toHaveBeenCalledWith('RD');
      expect(result.result?.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('RD')
      }]);
    });

    it('should handle get_incidents tool', async () => {
      const mockIncidents = [
        { IncidentID: '1', Description: 'Delays expected', LinesAffected: 'RD', DateUpdated: '', IncidentType: 'delay' }
      ];
      mockClient.getIncidents.mockResolvedValue(mockIncidents);

      const result = await handler.handleToolCall({
        name: 'get_incidents',
        arguments: {}
      }, mockEnv, 1);

      expect(mockClient.getIncidents).toHaveBeenCalled();
      expect(result.result?.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('incidents')
      }]);
    });

    it('should handle get_elevator_incidents tool', async () => {
      const mockIncidents = [
        { IncidentID: '1', Description: 'Elevator out of service', StartLocationFullName: 'Union Station', DateUpdated: '' }
      ];
      mockClient.getElevatorIncidents.mockResolvedValue(mockIncidents);

      const result = await handler.handleToolCall({
        name: 'get_elevator_incidents',
        arguments: {}
      }, mockEnv, 1);

      expect(mockClient.getElevatorIncidents).toHaveBeenCalled();
      expect(result.result?.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('elevatorIncidents')
      }]);
    });

    it('should handle get_all_stations tool', async () => {
      const mockStations = [
        { Code: 'A01', Name: 'Metro Center', Lat: 38.898, Lon: -77.028, LineCode1: 'RD', Address: {} }
      ];
      mockClient.getStations.mockResolvedValue(mockStations);

      const result = await handler.handleToolCall({
        name: 'get_all_stations',
        arguments: {}
      }, mockEnv, 1);

      expect(mockClient.getStations).toHaveBeenCalled();
      expect(result.result?.content).toEqual([{
        type: 'text',
        text: expect.stringContaining('stations')
      }]);
    });

    it('should return error for missing API key', async () => {
      const envWithoutKey = { WMATA_API_KEY: '' };

      const result = await handler.handleToolCall({
        name: 'get_station_predictions',
        arguments: { stationCode: 'A01' }
      }, envWithoutKey, 1);

      expect(result.error?.code).toBe(-32602);
      expect(result.error?.data).toContain('WMATA API key');
    });

    it('should handle errors from WMATA client', async () => {
      mockClient.getStationPredictions.mockRejectedValue(new Error('API Error'));

      const result = await handler.handleToolCall({
        name: 'get_station_predictions',
        arguments: { stationCode: 'A01' }
      }, mockEnv, 1);

      expect(result.error?.code).toBe(-32603);
      expect(result.error?.data).toContain('API Error');
    });
  });

  describe('processMCPMethod', () => {
    it('should handle initialize method', async () => {
      const result = await handler.processMCPMethod({
        jsonrpc: '2.0',
        method: 'initialize',
        id: 1
      }, mockEnv);

      expect(result.result?.protocolVersion).toBe('2024-11-05');
      expect(result.result?.serverInfo?.name).toBe('Metro MCP');
    });

    it('should handle tools/list method', async () => {
      const result = await handler.processMCPMethod({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1
      }, mockEnv);

      expect(result.result?.tools).toBeDefined();
      expect(Array.isArray(result.result?.tools)).toBe(true);
    });

    it('should return error for unknown method', async () => {
      const result = await handler.processMCPMethod({
        jsonrpc: '2.0',
        method: 'unknown_method',
        id: 1
      }, mockEnv);

      expect(result.error?.code).toBe(-32603);
      expect(result.error?.data).toContain('Unknown method');
    });
  });
});