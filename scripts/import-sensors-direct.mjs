import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sensorsPath = path.join(__dirname, '../sensors_formatted.json');

// Read formatted sensors
const sensorsData = JSON.parse(fs.readFileSync(sensorsPath, 'utf-8'));

async function importSensors() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'refrigerator_db',
  });

  try {
    console.log(`Starting import of ${sensorsData.length} sensors...`);
    
    let inserted = 0;
    let skipped = 0;

    for (const sensor of sensorsData) {
      try {
        await connection.execute(
          'INSERT INTO sensors (number, calibrationDate, nextCalibrationDate, status) VALUES (?, ?, ?, ?)',
          [sensor.number, sensor.calibrationDate, sensor.nextCalibrationDate, 'active']
        );
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`  Progress: ${inserted}/${sensorsData.length} sensors inserted`);
        }
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          skipped++;
        } else {
          console.error(`Error inserting sensor ${sensor.number}:`, err.message);
        }
      }
    }

    console.log(`\n✓ Import complete!`);
    console.log(`  Inserted: ${inserted}`);
    console.log(`  Skipped (duplicates): ${skipped}`);
    console.log(`  Total: ${inserted + skipped}`);

  } finally {
    await connection.end();
  }
}

importSensors().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
