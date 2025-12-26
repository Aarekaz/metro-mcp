#!/usr/bin/env bun

/**
 * Parse NYC GTFS static data to generate station list for MTA client
 *
 * Usage: bun run scripts/parse-nyc-gtfs.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface GTFSStop {
  stop_id: string;
  stop_name: string;
  stop_lat: string;
  stop_lon: string;
  location_type: string;
  parent_station: string;
}

interface GTFSRoute {
  route_id: string;
  route_short_name: string;
}

interface StopTime {
  stop_id: string;
  trip_id: string;
}

interface Trip {
  trip_id: string;
  route_id: string;
}

interface Station {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lines: string[];
}

// Parse CSV file
function parseCSV<T>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0]!.split(',');

  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] || '';
    });
    return obj as T;
  });
}

console.log('📊 Parsing NYC GTFS data...\n');

const gtfsDir = join(process.cwd(), 'docs', 'gtfs_subway');

// 1. Load parent stations (location_type = 1)
console.log('1️⃣  Loading stations from stops.txt...');
const allStops = parseCSV<GTFSStop>(join(gtfsDir, 'stops.txt'));
const parentStations = allStops.filter(stop => stop.location_type === '1');
console.log(`   Found ${parentStations.length} parent stations`);

// 2. Load routes to get line names
console.log('\n2️⃣  Loading routes...');
const routes = parseCSV<GTFSRoute>(join(gtfsDir, 'routes.txt'));
const routeMap = new Map(routes.map(r => [r.route_id, r.route_short_name]));
console.log(`   Found ${routes.length} routes`);

// 3. Load trips to map route_id to trip_id
console.log('\n3️⃣  Loading trips...');
const trips = parseCSV<Trip>(join(gtfsDir, 'trips.txt'));
const tripToRoute = new Map(trips.map(t => [t.trip_id, t.route_id]));
console.log(`   Found ${trips.length} trips`);

// 4. Load stop_times to find which lines serve which parent stations
console.log('\n4️⃣  Loading stop times (this may take a moment)...');
const stopTimes = parseCSV<StopTime>(join(gtfsDir, 'stop_times.txt'));
console.log(`   Found ${stopTimes.length} stop time entries`);

// 5. Build station-to-lines mapping
console.log('\n5️⃣  Building station-to-lines mapping...');
const stationLines = new Map<string, Set<string>>();

for (const stopTime of stopTimes) {
  const stop = allStops.find(s => s.stop_id === stopTime.stop_id);
  if (!stop) continue;

  // Get parent station ID
  const parentId = stop.parent_station || stop.stop_id;

  // Get route for this trip
  const routeId = tripToRoute.get(stopTime.trip_id);
  if (!routeId) continue;

  const lineName = routeMap.get(routeId);
  if (!lineName) continue;

  // Map special route names to standard line codes
  let standardLine = lineName;
  if (lineName === 'S') {
    // There are multiple S shuttles, skip for now
    continue;
  }

  if (!stationLines.has(parentId)) {
    stationLines.set(parentId, new Set());
  }
  stationLines.get(parentId)!.add(standardLine);
}

console.log(`   Mapped lines for ${stationLines.size} stations`);

// 6. Generate station data
console.log('\n6️⃣  Generating station data...');
const stations: Station[] = parentStations.map(stop => ({
  id: stop.stop_id,
  name: stop.stop_name,
  latitude: parseFloat(stop.stop_lat),
  longitude: parseFloat(stop.stop_lon),
  lines: Array.from(stationLines.get(stop.stop_id) || []).sort()
})).filter(station => station.lines.length > 0); // Only include stations with known lines

console.log(`   Generated ${stations.length} stations with line info`);

// 7. Generate TypeScript code
console.log('\n7️⃣  Generating TypeScript code...');
const tsCode = `/**
 * NYC Subway static station data
 * Generated from GTFS static feed
 *
 * Source: MTA GTFS Static Data
 * Generated: ${new Date().toISOString()}
 * Total Stations: ${stations.length}
 */

import { TransitStation } from './base';

export const NYC_STATIONS: TransitStation[] = [
${stations.map(s => `  {
    id: '${s.id}',
    name: '${s.name.replace(/'/g, "\\'")}',
    city: 'nyc',
    latitude: ${s.latitude},
    longitude: ${s.longitude},
    lines: [${s.lines.map(l => `'${l}'`).join(', ')}],
  }`).join(',\n')}
];
`;

// 8. Write to file
const outputPath = join(process.cwd(), 'src', 'transit', 'nyc-stations.ts');
writeFileSync(outputPath, tsCode);
console.log(`\n✅ Generated ${outputPath}`);
console.log(`\n📊 Statistics:`);
console.log(`   Total stations: ${stations.length}`);
console.log(`   Lines covered: ${new Set(stations.flatMap(s => s.lines)).size}`);
console.log(`   Average lines per station: ${(stations.reduce((sum, s) => sum + s.lines.length, 0) / stations.length).toFixed(1)}`);

// Show top transfer hubs
const topHubs = stations
  .sort((a, b) => b.lines.length - a.lines.length)
  .slice(0, 10);

console.log(`\n🚇 Top 10 transfer hubs:`);
topHubs.forEach((station, i) => {
  console.log(`   ${i + 1}. ${station.name} - ${station.lines.length} lines (${station.lines.join(', ')})`);
});

console.log('\n✨ Done! Update mta-client.ts to import from nyc-stations.ts\n');
