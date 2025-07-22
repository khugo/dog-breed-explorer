import * as cheerio from 'cheerio';
import fs from 'fs/promises';

const BASE_URL = 'https://www.akc.org/dog-breeds/';

async function fetchPage(url) {
    try {
        console.log(`Fetching: ${url}`);
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.text();
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        throw error;
    }
}

function parseBreeds(html) {
    const $ = cheerio.load(html);
    const breeds = [];
    
    // Look for breed cards using the structure we found
    $('.breed-type-card, [class*="breed-type-card"]').each((index, element) => {
        const $card = $(element);
        
        // Extract breed name from h3 title
        const name = $card.find('.breed-type-card__title, h3').text().trim();
        
        // Extract AKC link from the main anchor tag
        const linkElement = $card.find('a[href*="/dog-breeds/"]').first();
        const akcLink = linkElement.attr('href');
        const fullAkcLink = akcLink && akcLink.startsWith('/') ? `https://www.akc.org${akcLink}` : akcLink;
        
        // Extract image URL
        const img = $card.find('img');
        let imageUrl = img.attr('data-src') || img.attr('src') || '';
        if (imageUrl && imageUrl.startsWith('/')) {
            imageUrl = `https://www.akc.org${imageUrl}`;
        }
        
        // Extract description from the content area
        const description = $card.find('.breed-type-card__content p, p').first().text().trim();
        
        if (name && fullAkcLink) {
            breeds.push({
                name,
                akcLink: fullAkcLink,
                imageUrl,
                description
            });
        }
    });
    
    return breeds;
}

const PAGE_URL = 'https://www.akc.org/dog-breeds/page/';
const DELAY_MS = 5000; // 5 second delay between requests

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function crawlAllBreeds() {
    const allBreeds = [];
    let page = 1;
    let consecutiveErrors = 0;
    const maxErrors = 3;
    
    console.log('Starting AKC breed crawl...');
    
    // First try the main breeds page
    try {
        console.log('Fetching main breeds page...');
        const html = await fetchPage(BASE_URL);
        if (html) {
            const breeds = parseBreeds(html);
            if (breeds.length > 0) {
                console.log(`Found ${breeds.length} breeds on main page`);
                allBreeds.push(...breeds);
            }
        }
        await delay(DELAY_MS);
    } catch (error) {
        console.log('Main page failed, trying paginated approach');
    }
    
    // Then try paginated pages
    while (consecutiveErrors < maxErrors) {
        try {
            const url = `${PAGE_URL}${page}`;
            const html = await fetchPage(url);
            
            if (html === null) {
                console.log(`Reached end of pages (404) at page ${page}`);
                break;
            }
            
            const breeds = parseBreeds(html);
            
            if (breeds.length === 0) {
                console.log(`No breeds found on page ${page}`);
                consecutiveErrors++;
            } else {
                console.log(`Found ${breeds.length} breeds on page ${page}`);
                
                // Filter out duplicates
                const newBreeds = breeds.filter(breed => 
                    !allBreeds.some(existing => existing.name === breed.name)
                );
                
                allBreeds.push(...newBreeds);
                console.log(`Added ${newBreeds.length} new breeds (${breeds.length - newBreeds.length} duplicates)`);
                consecutiveErrors = 0;
            }
            
            page++;
            
            // Rate limiting
            await delay(DELAY_MS);
            
        } catch (error) {
            console.error(`Error processing page ${page}:`, error.message);
            
            if (error.message.includes('404')) {
                console.log(`Reached end of pages at page ${page}`);
                break;
            }
            
            consecutiveErrors++;
            
            if (consecutiveErrors < maxErrors) {
                console.log(`Retrying after delay... (attempt ${consecutiveErrors}/${maxErrors})`);
                await delay(DELAY_MS * 2);
            }
        }
    }
    
    return allBreeds;
}

async function saveToFile(breeds, filename = 'breeds.json') {
    try {
        const json = JSON.stringify(breeds, null, 2);
        await fs.writeFile(filename, json, 'utf8');
        console.log(`Saved ${breeds.length} breeds to ${filename}`);
    } catch (error) {
        console.error('Error saving file:', error.message);
        throw error;
    }
}

async function main() {
    try {
        const breeds = await crawlAllBreeds();
        
        if (breeds.length === 0) {
            console.log('No breeds were scraped. Check the HTML parsing logic.');
            return;
        }
        
        console.log(`\nTotal breeds scraped: ${breeds.length}`);
        console.log('\nSample breeds:');
        breeds.slice(0, 5).forEach((breed, index) => {
            console.log(`${index + 1}. ${breed.name}`);
            console.log(`   Link: ${breed.akcLink}`);
            console.log(`   Image: ${breed.imageUrl}`);
            console.log(`   Description: ${breed.description}`);
            console.log('');
        });
        
        await saveToFile(breeds);
        
    } catch (error) {
        console.error('Crawl failed:', error.message);
        process.exit(1);
    }
}

main();