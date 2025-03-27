// quote-service.js
// Complete Quote Notification Service with Random Gradients

const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg'); // Add pg Pool

// Load environment variables
dotenv.config();

// --- Database Pool Setup ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false // Required for some cloud DBs like Heroku/Railway
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
// --- End Database Pool Setup ---

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for POST requests
app.use(express.json());

// Your Bark API endpoint
const BARK_API_URL = process.env.BARK_API_URL;
// Base URL for serving gradients (use Railway URL when deployed)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// Directory for storing temporary gradient images
const GRADIENTS_DIR = path.join(__dirname, 'temp_gradients');

// Create gradients directory if it doesn't exist
if (!fs.existsSync(GRADIENTS_DIR)) {
  fs.mkdirSync(GRADIENTS_DIR, { recursive: true });
}

// ==================== QUOTE FUNCTIONS (DB Version) ====================

// Function to fetch a random quote from the database for a specific category
async function getRandomQuoteFromDB(category) {
  try {
    const result = await pool.query(
      'SELECT quote_text, author FROM quotes WHERE category = $1 ORDER BY RANDOM() LIMIT 1',
      [category]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      return `${row.quote_text} - ${row.author}`;
    } else {
      console.warn(`No quotes found in DB for category: ${category}`);
      // Fallback or default quote if needed
      return "Default quote if category is empty or not found."; // Consider a better fallback
    }
  } catch (error) {
    console.error('Error fetching quote from DB:', error);
    throw error; // Re-throw to be caught by calling function
  }
}

// ==================== GRADIENT FUNCTIONS ====================

// Function to generate a random color
function randomColor() {
  const r = Math.floor(Math.random() * 256);
  const g = Math.floor(Math.random() * 256);
  const b = Math.floor(Math.random() * 256);
  return `rgb(${r},${g},${b})`;
}

// Function to generate a random gradient SVG
function generateGradientSVG() {
  // Generate random colors for the gradient
  const color1 = randomColor();
  const color2 = randomColor();
  const color3 = randomColor();
  
  // Random gradient angle (0-360 degrees)
  const angle = Math.floor(Math.random() * 360);
  
  // Create SVG content with linear gradient
  const svgContent = `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%" gradientTransform="rotate(${angle} 0.5 0.5)">
        <stop offset="0%" stop-color="${color1}" />
        <stop offset="50%" stop-color="${color2}" />
        <stop offset="100%" stop-color="${color3}" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" rx="64" ry="64" />
  </svg>`;
  
  // Generate a unique filename
  const filename = `gradient-${crypto.randomBytes(8).toString('hex')}.svg`;
  const filePath = path.join(GRADIENTS_DIR, filename);
  
  // Write SVG to file
  fs.writeFileSync(filePath, svgContent);
  
  return {
    filename,
    filePath,
    url: `${BASE_URL}/gradients/${filename}` // Gradient URL still uses BASE_URL
  };
}

// Function to delete a gradient file
function deleteGradient(filePath) {
  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Deleted gradient: ${filePath}`);
      } catch (error) {
        console.error(`Error deleting gradient: ${error.message}`);
      }
    }
  }, 10000); // Delete after 10 seconds
}

// Function to create a static error gradient
function createErrorGradient() {
  const svgContent = `
  <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <defs>
      <linearGradient id="errorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#FF3B30" />
        <stop offset="100%" stop-color="#990000" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#errorGrad)" rx="64" ry="64" />
  </svg>`;
  
  const filePath = path.join(GRADIENTS_DIR, 'error-gradient.svg');
  fs.writeFileSync(filePath, svgContent);
  console.log('Created error gradient');
}

// ==================== NOTIFICATION FUNCTIONS ====================

// Function to send a random quote notification (Needs update if kept)
async function sendRandomQuote() {
  // This function needs review. Should it pick a random category first?
  console.warn("sendRandomQuote needs review for DB implementation");
  // Example: Pick a random category then call sendQuoteFromCategory
  // const categories = ['naval', 'marcusAurelius', 'creativeAct', 'goggins'];
  // const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  // await sendQuoteFromCategory(randomCategory);
}

// Function to send an error notification
async function sendErrorNotification(errorMessage) {
  try {
    await axios.post(BARK_API_URL, {
      title: 'Quote Service Error',
      body: `Error: ${errorMessage}`,
      badge: 1,
      sound: 'default', // Use default sound
      group: 'error-alerts',
      icon: `${BASE_URL}/gradients/error-gradient.svg`
    }, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
    console.log('Error notification sent successfully');
  } catch (error) {
    console.error('Failed to send error notification:', error.message);
  }
}

// ==================== SERVER SETUP ====================

// Schedule 4 notifications per day
const notificationSchedule = [
  { time: '0 6 * * *', category: 'marcusAurelius' },
  { time: '0 9 * * *', category: 'naval' },
  { time: '0 14 * * *', category: 'creativeAct' },
  { time: '0 20 * * *', category: 'goggins' }
];

notificationSchedule.forEach(({time, category}) => {
  cron.schedule(time, () => {
    console.log(`Sending ${category} quote notification...`);
    sendQuoteFromCategory(category); // This now uses the DB version indirectly
  });
});

// Updated function to use the DB query
async function sendQuoteFromCategory(category) {
  try {
    const quote = await getRandomQuoteFromDB(category); // Use DB function
    if (!quote || quote.startsWith("Default quote")) {
      // Error handled within getRandomQuoteFromDB, but double-check logic
      console.error(`Could not get a valid quote for ${category}`);
      // Optionally send an error notification if the fallback is used or no quote found
      if (quote && quote.startsWith("Default quote")) {
         sendErrorNotification(`Using fallback for category ${category}`);
      }
      return; // Exit if no valid quote found
    }

    const [quoteText, author] = quote.split(' - '); // Assumes format from DB function
    const gradient = generateGradientSVG();

    const barkData = {
      title: author,
      body: quoteText,
      icon: gradient.url, // Still uses BASE_URL for gradient path
      sound: 'default', // Use default sound
      group: 'daily-quotes'
    };

    const response = await axios.post(BARK_API_URL, barkData);
    console.log('Notification sent successfully:', response.data);
    deleteGradient(gradient.filePath);

  } catch (error) {
    console.error(`Error sending ${category} notification:`, error);
    sendErrorNotification(error.message); // Send error notification
  }
}

// Serve gradient files statically
app.use('/gradients', express.static(GRADIENTS_DIR));

// Set up routes
app.get('/', (req, res) => {
  res.send('Quote notification service is running!');
});

// Endpoint to manually trigger a notification
app.post('/send-quote', (req, res) => {
  const { category } = req.body;
  if (category) {
    sendQuoteFromCategory(category); // Uses DB indirectly
    res.send(`Quote notification triggered for category: ${category}`);
  } else {
    sendRandomQuote(); // Uses DB indirectly (needs review)
    res.send('Quote notification triggered!');
  }
});

// ==================== STARTUP ====================

// Initialize server
app.listen(PORT, async () => { // Make async for DB check
  console.log(`Server running on port ${PORT}`);

  // Optional: Test DB connection on startup
  try {
    const client = await pool.connect();
    console.log('Database connected successfully.');
    client.release();
  } catch (err) {
    console.error('Failed to connect to the database:', err);
    process.exit(1); // Exit if DB connection fails
  }

  // Clean gradients and create error gradient
  fs.readdir(GRADIENTS_DIR, (err, files) => {
    if (err) return console.error('Error reading gradients directory:', err);
    
    for (const file of files) {
      if (file !== 'error-gradient.svg') { // Keep the error gradient
        fs.unlink(path.join(GRADIENTS_DIR, file), err => {
          if (err) console.error(`Error deleting file ${file}:`, err);
        });
      }
    }
    console.log(`Cleaned ${files ? files.length : 0} gradient files from previous session`);
  });
  
  createErrorGradient();
});

// ==================== QUOTE DATA (Sample - No longer used by app) ====================
// const sampleQuotesData = { ... }; // Removed as it's not used
