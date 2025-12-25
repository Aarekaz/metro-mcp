export class WMATAError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'WMATAError';
  }
}

export function handleWMATAError(error: unknown): string {
  if (error instanceof WMATAError) {
    return `WMATA API Error (${error.statusCode}): ${error.message}`;
  }
  
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  
  return 'Unknown error occurred while accessing WMATA API';
}

export function validateStationCode(code: string): string {
  const cleaned = code.trim().toUpperCase();
  
  if (!cleaned || cleaned.length !== 3) {
    throw new WMATAError('Station code must be exactly 3 characters (e.g., "A01", "C05")');
  }
  
  if (!/^[A-Z]\d{2}$/.test(cleaned)) {
    throw new WMATAError('Station code must be in format: Letter followed by 2 digits (e.g., "A01", "C05")');
  }
  
  return cleaned;
}

export function validateLineCode(code: string): string {
  const cleaned = code.trim().toUpperCase();
  const validLines = ['RD', 'BL', 'YL', 'OR', 'GR', 'SV'];
  
  if (!validLines.includes(cleaned)) {
    throw new WMATAError(`Invalid line code. Must be one of: ${validLines.join(', ')}`);
  }
  
  return cleaned;
}

export function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new WMATAError('Search query is required and must be a string');
  }
  
  const cleaned = query.trim();
  if (cleaned.length === 0) {
    throw new WMATAError('Search query cannot be empty');
  }
  
  if (cleaned.length > 50) {
    throw new WMATAError('Search query must be 50 characters or less');
  }
  
  // Basic XSS prevention
  if (/<[^>]*>/.test(cleaned)) {
    throw new WMATAError('Search query contains invalid characters');
  }
  
  return cleaned;
}

export function validateToolParameters(toolName: string, args: any): void {
  if (!args || typeof args !== 'object') {
    throw new WMATAError('Tool arguments must be an object');
  }
  
  switch (toolName) {
    case 'get_station_predictions':
      if (!args.stationCode) {
        throw new WMATAError('stationCode parameter is required');
      }
      break;
    case 'search_stations':
      if (!args.query) {
        throw new WMATAError('query parameter is required');
      }
      break;
    case 'get_stations_by_line':
      if (!args.lineCode) {
        throw new WMATAError('lineCode parameter is required');
      }
      break;
  }
}