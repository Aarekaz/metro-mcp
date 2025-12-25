export interface Env {
  WMATA_API_KEY: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  JWT_SECRET?: string;
  OAUTH_REDIRECT_URI?: string;
}

export interface User {
  id: string;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export interface AuthSession {
  userId: string;
  userLogin: string;
  expiresAt: number;
}

export interface WMATAAddress {
  City: string;
  State: string;
  Street: string;
  Zip: string;
}

export interface WMATAStation {
  Address: WMATAAddress;
  Code: string;
  Lat: number;
  Lon: number;
  LineCode1: string;
  LineCode2: string | null;
  LineCode3: string | null;
  LineCode4: string | null;
  Name: string;
  StationTogether1: string;
  StationTogether2: string;
}

export interface WMATAPrediction {
  Car: string;
  Destination: string;
  DestinationCode: string;
  DestinationName: string;
  Group: string;
  Line: string;
  LocationCode: string;
  LocationName: string;
  Min: string;
}

export interface WMATAIncident {
  DateUpdated: string;
  DelaySeverity: string | null;
  Description: string;
  EmergencyText: string | null;
  EndLocationFullName: string | null;
  IncidentID: string;
  IncidentType: string;
  LinesAffected: string;
  PassengerDelay: number;
  StartLocationFullName: string | null;
}

export interface WMATAServiceAdvisory {
  DateUpdated: string;
  Description: string;
  IncidentID: string;
  IncidentType: string;
  LinesAffected: string;
}