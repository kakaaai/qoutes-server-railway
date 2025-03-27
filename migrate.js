const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables (specifically DATABASE_URL)
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateData() {
  const client = await pool.connect();
  console.log('Connected to database for migration.');

  try {
    // Read quotes.json
    const quotesPath = path.join(__dirname, 'quotes.json');
    if (!fs.existsSync(quotesPath)) {
      console.error('Error: quotes.json not found!');
      return;
    }
    const quotesFile = fs.readFileSync(quotesPath, 'utf8');
    const quotesData = JSON.parse(quotesFile);

    console.log('Read quotes.json data.');

    // Start transaction
    await client.query('BEGIN');
    console.log('Starting transaction...');

    // Optional: Clear existing data if needed (be careful!)
    // await client.query('DELETE FROM quotes');
    // console.log('Cleared existing quotes data.');

    let insertedCount = 0;
    // Iterate through categories and quotes, inserting into DB
    for (const category in quotesData.categories) {
      const categoryQuotes = quotesData.categories[category];
      for (const quoteObj of categoryQuotes) {
        const queryText = 'INSERT INTO quotes(quote_text, author, category) VALUES($1, $2, $3)';
        const values = [quoteObj.quote, quoteObj.author, category];
        await client.query(queryText, values);
        insertedCount++;
      }
      console.log(`Inserted quotes for category: ${category}`);
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log(`Transaction committed. Successfully inserted ${insertedCount} quotes.`);

  } catch (error) {
    // Rollback transaction in case of error
    await client.query('ROLLBACK');
    console.error('Error during migration, transaction rolled back:', error);
    throw error; // Re-throw error to indicate failure
  } finally {
    // Release the client back to the pool
    client.release();
    console.log('Database client released.');
    // End the pool connection after migration
    await pool.end();
    console.log('Database pool closed.');
  }
}

// Run the migration
migrateData().catch(err => {
  console.error('Migration script failed:', err);
  process.exit(1); // Exit with error code
});