// Configuration from environment variables
export const INFLUXDB_URL = process.env.INFLUXDB_URL || "http://localhost:8086";
export const INFLUXDB_TOKEN = process.env.INFLUXDB_TOKEN;
export const DEFAULT_ORG = process.env.INFLUXDB_ORG;

// Check required environment variables
export function validateEnvironment() {
  if (!INFLUXDB_TOKEN) {
    throw new Error("INFLUXDB_TOKEN environment variable is required");
  }
  if (!INFLUXDB_URL) {
    throw new Error("INFLUXDB_URL environment variable is required");
  }
}
