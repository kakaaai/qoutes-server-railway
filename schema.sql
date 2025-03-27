-- Drop the table if it exists (optional, for clean setup during testing/deployment)
DROP TABLE IF EXISTS quotes;

-- Create the quotes table
CREATE TABLE quotes (
    id SERIAL PRIMARY KEY,          -- Auto-incrementing integer ID
    quote_text TEXT NOT NULL,       -- The text of the quote
    author VARCHAR(255) NOT NULL,   -- The author's name
    category VARCHAR(100) NOT NULL  -- The category (e.g., naval, goggins)
);

-- Optional: Add an index on category for faster lookups
CREATE INDEX idx_quotes_category ON quotes (category);