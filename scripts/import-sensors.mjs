import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sensorsPath = path.join(__dirname, '../sensors_formatted.json');

// Read formatted sensors
const sensorsData = JSON.parse(fs.readFileSync(sensorsPath, 'utf-8'));

// Get the API URL from environment or use default
const API_URL = process.env.API_URL || 'http://localhost:3000/api/trpc';
const JWT_TOKEN = process.env.JWT_TOKEN;

if (!JWT_TOKEN) {
  console.error('ERROR: JWT_TOKEN environment variable is required');
  console.error('Please set JWT_TOKEN to your authentication token');
  process.exit(1);
}

async function importSensors() {
  console.log(`Starting import of ${sensorsData.length} sensors...`);
  
  try {
    // Call the bulkCreate procedure
    const response = await fetch(`${API_URL}/sensors.bulkCreate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `session=${JWT_TOKEN}`,
      },
      body: JSON.stringify({
        json: sensorsData,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`API Error (${response.status}):`, error);
      process.exit(1);
    }

    const result = await response.json();
    console.log(`✓ Successfully imported sensors`);
    console.log(`Total sensors in database: ${result.result.data.length}`);
    
  } catch (error) {
    console.error('Import failed:', error.message);
    process.exit(1);
  }
}

importSensors();
