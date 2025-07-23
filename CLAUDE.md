# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a single-page dog breed explorer webapp with a web scraping pipeline. The application consists of two main components:

### Data Pipeline (crawler.js)
- Web scraper that extracts dog breed data from AKC.org using Cheerio
- Uses 5-second delays between requests for rate limiting
- Outputs `breeds.json` with 292+ dog breeds (name, AKC link, image URL, description)
- Run with: `node crawler.js`

### Frontend Webapp (index.html)
- Self-contained HTML file with embedded CSS/JavaScript (no build process)
- Loads breed data from `breeds.json` asynchronously
- Uses Fisher-Yates shuffle algorithm for randomization without duplicates
- Tracks "X of Y breeds seen" progress and reshuffles when all breeds are viewed

## Development Commands

```bash
# Install dependencies
npm install

# Start local development server
npx http-server

# Update breed data from AKC.org
node crawler.js
```

## Key Technical Patterns

### Randomization System
The app uses a sophisticated no-duplicate system:
- Fisher-Yates shuffle creates random order of all breeds
- Pops breeds from `remainingBreeds` array until empty
- Auto-reshuffles when all 292 breeds have been seen

### Web Scraping Strategy
- Handles AKC pagination and 404s gracefully
- Multiple CSS selectors for resilient parsing
- Validates required fields and filters duplicates
- Error recovery continues crawling despite individual page failures

### Frontend Architecture
- Pure vanilla JavaScript with ES modules
- Embedded styles/scripts for single-file deployment
- Smooth CSS transitions prevent layout reflow
- Loading states and fallback data for error handling

## Data Format

`breeds.json` contains array of breed objects:
```json
{
  "name": "Golden Retriever",
  "akcLink": "https://www.akc.org/dog-breeds/golden-retriever/",
  "imageUrl": "https://...",
  "description": "Friendly, intelligent, devoted"
}
```