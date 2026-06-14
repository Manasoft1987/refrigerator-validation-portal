import { getDb } from '../server/db.ts';
import fs from 'fs';
import path from 'path';

const sensorsPath = path.join(process.cwd(), 'sensors_formatted.json');
const sensorsData = JSON.parse(fs.readFileSync(sensorsPath, 'utf-8'));

async function main() {
  console.log(`Importing ${sensorsData.length} sensors...`);
  
  const db = await getDb();
  if (!db) {
    console.error('Database connection failed');
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;

  for (const sensor of sensorsData) {
    try {
      await db.insert(sensors).values({
        number: sensor.number,
        calibrationDate: sensor.calibrationDate,
        nextCalibrationDate: sensor.nextCalibrationDate,
        status: 'active',
      });
      inserted++;
      if (inserted % 50 === 0) {
        console.log(`  Progress: ${inserted}/${sensorsData.length}`);
      }
    } catch (err) {
      skipped++;
    }
  }

  console.log(`\n✓ Import complete! Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(console.error);
