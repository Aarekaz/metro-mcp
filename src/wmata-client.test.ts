import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WMATAClient } from './wmata-client';
import { WMATAError } from './error-handler';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('WMATAClient', () => {
  let client: WMATAClient;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    client = new WMATAClient(mockApiKey);
    mockFetch.mockClear();
  });

  describe('getStations', () => {
    it('should fetch stations successfully', async () => {
      const mockStations = [
        { Code: 'A01', Name: 'Metro Center', Lat: 38.898, Lon: -77.028 }
      ];
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ Stations: mockStations })
      });

      const result = await client.getStations();
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.wmata.com/Rail.svc/json/jStations',
        expect.objectContaining({
          headers: expect.objectContaining({
            'api_key': mockApiKey
          })
        })
      );
      expect(result).toEqual(mockStations);
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      });

      await expect(client.getStations()).rejects.toThrow(WMATAError);
    });
  });

  describe('searchStation', () => {
    beforeEach(() => {
      const mockStations = [
        { Code: 'A01', Name: 'Metro Center', Lat: 38.898, Lon: -77.028 },
        { Code: 'B01', Name: 'Union Station', Lat: 38.897, Lon: -77.007 },
        { Code: 'C01', Name: 'Dupont Circle', Lat: 38.910, Lon: -77.044 }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ Stations: mockStations })
      });
    });

    it('should find station by exact code match', async () => {
      const result = await client.searchStation('A01');
      expect(result).toHaveLength(1);
      expect(result[0].Code).toBe('A01');
    });

    it('should find station by partial name match', async () => {
      const result = await client.searchStation('Metro');
      expect(result).toHaveLength(1);
      expect(result[0].Name).toBe('Metro Center');
    });

    it('should be case insensitive', async () => {
      const result = await client.searchStation('union station');
      expect(result).toHaveLength(1);
      expect(result[0].Name).toBe('Union Station');
    });

    it('should return empty array for no matches', async () => {
      const result = await client.searchStation('NonExistent');
      expect(result).toHaveLength(0);
    });
  });

  describe('getStationsByLine', () => {
    beforeEach(() => {
      const mockStations = [
        { Code: 'A01', Name: 'Metro Center', LineCode1: 'RD', LineCode2: 'BL' },
        { Code: 'B01', Name: 'Union Station', LineCode1: 'RD', LineCode2: null },
        { Code: 'C01', Name: 'Dupont Circle', LineCode1: 'RD', LineCode2: null }
      ];
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ Stations: mockStations })
      });
    });

    it('should filter stations by line code', async () => {
      const result = await client.getStationsByLine('RD');
      expect(result).toHaveLength(3);
      expect(result.every(station => 
        station.LineCode1 === 'RD' || 
        station.LineCode2 === 'RD' || 
        station.LineCode3 === 'RD' || 
        station.LineCode4 === 'RD'
      )).toBe(true);
    });

    it('should find stations with line in any position', async () => {
      const result = await client.getStationsByLine('BL');
      expect(result).toHaveLength(1);
      expect(result[0].Code).toBe('A01');
    });
  });

  describe('error handling', () => {
    it('should throw WMATAError for network failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getStations()).rejects.toThrow(WMATAError);
    });

    it('should throw WMATAError for non-ok responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(client.getStations()).rejects.toThrow(WMATAError);
    });
  });
});