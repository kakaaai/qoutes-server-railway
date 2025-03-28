// quote-service.js
// Complete Quote Notification Service with Random Gradients

const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createCanvas, createImageData } = require('canvas');

// Load environment variables
dotenv.config();

// Canvas dimensions
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 512;

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parsing for POST requests
app.use(express.json());

// Your Bark API endpoint
const BARK_API_URL = process.env.BARK_API_URL;
// Base URL for serving gradients (use Railway URL when deployed)
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
// Directory for storing temporary gradient images
// In Railway, we should use /tmp for temporary files
let GRADIENTS_DIR = process.env.NODE_ENV === 'production'
  ? path.join('/tmp', 'temp_gradients')
  : path.join(__dirname, 'temp_gradients');

// Create gradients directory if it doesn't exist
try {
  if (!fs.existsSync(GRADIENTS_DIR)) {
    fs.mkdirSync(GRADIENTS_DIR, { recursive: true });
    console.log(`Created gradients directory at: ${GRADIENTS_DIR}`);
  }
} catch (error) {
  console.error(`Error creating gradients directory: ${error.message}`);
  // Fallback to a different directory if needed
  if (process.env.NODE_ENV === 'production') {
    console.log('Attempting to use alternative temp directory...');
    // Try to use the current directory as fallback
    GRADIENTS_DIR = __dirname;
  }
}

// ==================== QUOTE FUNCTIONS (JSON Version) ====================

// Function to load quotes from JSON file
function loadQuotes() {
  try {
    const quotesData = fs.readFileSync(path.join(__dirname, 'quotes.json'), 'utf8');
    return JSON.parse(quotesData);
  } catch (error) {
    console.error('Error loading quotes from JSON:', error);
    return null;
  }
}

// Function to get a random quote from a specific category
function getRandomQuoteFromJSON(category) {
  try {
    const quotes = loadQuotes();
    if (!quotes || !quotes.categories || !quotes.categories[category]) {
      console.warn(`No quotes found in JSON for category: ${category}`);
      return null;
    }

    const categoryQuotes = quotes.categories[category];
    const randomQuote = categoryQuotes[Math.floor(Math.random() * categoryQuotes.length)];
    return `${randomQuote.quote} - ${randomQuote.author}`;
  } catch (error) {
    console.error('Error getting random quote from JSON:', error);
    throw error;
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

// Function to generate a random gradient JPG
function generateGradientJPG() {
  // Create canvas
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Generate random colors for the gradient
  const color1 = randomColor();
  const color2 = randomColor();
  const color3 = randomColor();
  
  // Random gradient angle (0-360 degrees)
  const angle = Math.floor(Math.random() * 360);
  const radians = (angle * Math.PI) / 180;

  // Calculate gradient start and end points based on angle
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const radius = Math.sqrt(CANVAS_WIDTH * CANVAS_WIDTH + CANVAS_HEIGHT * CANVAS_HEIGHT) / 2;
  
  const startX = centerX - Math.cos(radians) * radius;
  const startY = centerY - Math.sin(radians) * radius;
  const endX = centerX + Math.cos(radians) * radius;
  const endY = centerY + Math.sin(radians) * radius;

  // Create gradient
  const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
  gradient.addColorStop(0, color1);
  gradient.addColorStop(0.5, color2);
  gradient.addColorStop(1, color3);

  // Fill canvas with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Generate a unique filename
  const filename = `gradient-${crypto.randomBytes(8).toString('hex')}.jpg`;
  const filePath = path.join(GRADIENTS_DIR, filename);
  
  // Write JPG to file
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(filePath, buffer);
  
  return {
    filename,
    filePath,
    url: `${BASE_URL}/gradients/${filename}`
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
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  gradient.addColorStop(0, '#FF3B30');
  gradient.addColorStop(1, '#990000');

  // Fill canvas with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const filePath = path.join(GRADIENTS_DIR, 'error-gradient.jpg');
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 });
  fs.writeFileSync(filePath, buffer);
  console.log('Created error gradient');
}

// ==================== NOTIFICATION FUNCTIONS ====================

// Function to send a random quote notification
async function sendRandomQuote() {
  const categories = ['naval', 'marcusAurelius', 'creativeAct', 'goggins'];
  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  await sendQuoteFromCategory(randomCategory);
}

// Function to send an error notification
async function sendErrorNotification(errorMessage) {
  try {
    await axios.post(BARK_API_URL, {
      title: 'Quote Service Error',
      body: `Error: ${errorMessage}`,
      badge: 1,
      sound: 'default',
      group: 'error-alerts',
      icon: `${BASE_URL}/gradients/error-gradient.jpg`
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
    sendQuoteFromCategory(category);
  });
});

// Updated function to use JSON instead of DB
async function sendQuoteFromCategory(category) {
  try {
    const quote = getRandomQuoteFromJSON(category);
    if (!quote) {
      console.error(`Could not get a valid quote for ${category}`);
      sendErrorNotification(`No quotes found for category ${category}`);
      return;
    }

    const [quoteText, author] = quote.split(' - ');
    const gradient = generateGradientJPG();

    const barkData = {
      title: author,
      body: quoteText,
      icon: gradient.url,
      sound: 'default',
      group: 'daily-quotes',
      action: 'none',
      autoCopy: "1"
    };

    const response = await axios.post(BARK_API_URL, barkData);
    console.log('Notification sent successfully:', response.data);
    deleteGradient(gradient.filePath);

  } catch (error) {
    console.error(`Error sending ${category} notification:`, error);
    sendErrorNotification(error.message);
  }
}

// Serve gradient files statically with logging
app.use('/gradients', (req, res, next) => {
  console.log(`Gradient request for: ${req.url}`);
  console.log(`Looking in directory: ${GRADIENTS_DIR}`);
  express.static(GRADIENTS_DIR)(req, res, (err) => {
    if (err) {
      console.error(`Error serving gradient: ${err}`);
      return next(err);
    }
    console.log('Gradient served successfully');
    next();
  });
});

// Set up routes
app.get('/', (req, res) => {
  res.send('Quote notification service is running!');
});

// Endpoint to manually trigger a notification
app.post('/send-quote', (req, res) => {
  const { category } = req.body;
  if (category) {
    sendQuoteFromCategory(category);
    res.send(`Quote notification triggered for category: ${category}`);
  } else {
    sendRandomQuote();
    res.send('Random quote notification triggered!');
  }
});

// ==================== STARTUP ====================

// Initialize server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // Test JSON file access
  try {
    console.log('Testing quotes.json access...');
    const quotes = loadQuotes();
    if (quotes && quotes.categories) {
      console.log('Quotes data loaded successfully.');
    }
  } catch (err) {
    console.error('Failed to load quotes.json:', err);
    console.log('The application will continue running, but quote functionality may be limited.');
  }

  // Clean gradients and create error gradient
  try {
    console.log('Cleaning gradient directory...');
    if (!fs.existsSync(GRADIENTS_DIR)) {
      console.log('Creating gradients directory...');
      fs.mkdirSync(GRADIENTS_DIR, { recursive: true });
    }
    
    fs.readdir(GRADIENTS_DIR, (err, files) => {
      if (err) {
        console.error('Error reading gradients directory:', err);
        return;
      }
      
      for (const file of files) {
        if (file !== 'error-gradient.jpg') { // Keep the error gradient
          fs.unlink(path.join(GRADIENTS_DIR, file), err => {
            if (err) console.error(`Error deleting file ${file}:`, err);
          });
        }
      }
      console.log(`Cleaned ${files ? files.length : 0} gradient files from previous session`);
    });
  } catch (err) {
    console.error('Error cleaning gradient directory:', err);
  }
  
  try {
    createErrorGradient();
  } catch (err) {
    console.error('Error creating error gradient:', err);
  }
  
  console.log('Quote service is operational.');
});
