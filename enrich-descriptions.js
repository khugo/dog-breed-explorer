import * as cheerio from 'cheerio';
import fs from 'fs/promises';

const DELAY_MS = 7000; // 7 second delay between requests

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

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
        return null;
    }
}

async function extractFullDescription(html) {
    const $ = cheerio.load(html);
    
    // Look for the breedPage component specifically
    const breedPageElement = $('[data-js-component="breedPage"]');
    if (breedPageElement.length === 0) {
        return null;
    }
    
    const jsonData = breedPageElement.attr('data-js-props');
    if (!jsonData) {
        return null;
    }
    
    try {
        // Decode HTML entities in the JSON string
        const decodedJson = jsonData
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
        
        const data = JSON.parse(decodedJson);
        
        // Extract both blurb and about descriptions
        const breedData = data.settings?.breed_data?.description;
        
        if (breedData) {
            const breedKey = Object.keys(breedData)[0]; // Get the breed key (e.g., "affenpinscher")
            const breedInfo = breedData[breedKey];
            
            const blurbText = breedInfo?.akc_org_blurb || '';
            const aboutText = breedInfo?.akc_org_about || '';
            
            if (blurbText || aboutText) {
                // Clean HTML tags and decode entities from both texts
                const cleanBlurb = blurbText
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;/g, "'")
                    .trim();
                
                const cleanAbout = aboutText
                    .replace(/<[^>]*>/g, '') // Remove HTML tags
                    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;/g, "'")
                    .trim();
                
                // Combine blurb and about with 2 line breaks
                const combined = [cleanBlurb, cleanAbout].filter(text => text).join('\n\n');
                return combined || null;
            }
        }
        
        return null;
        
    } catch (error) {
        return null;
    }
}

async function enrichBreedDescription(breed) {
    try {
        const html = await fetchPage(breed.akcLink);
        if (!html) {
            console.log(`  ❌ Failed to fetch page for ${breed.name}`);
            return breed;
        }
        
        const fullDescription = await extractFullDescription(html);
        if (fullDescription && fullDescription.length > breed.description.length) {
            console.log(`  ✅ Enhanced description for ${breed.name} (${breed.description.length} → ${fullDescription.length} chars)`);
            return {
                ...breed,
                description: fullDescription
            };
        } else {
            console.log(`  ⚠️  No improvement found for ${breed.name}`);
            return breed;
        }
        
    } catch (error) {
        console.error(`  ❌ Error processing ${breed.name}:`, error.message);
        return breed;
    }
}

async function loadExistingBreeds() {
    try {
        const data = await fs.readFile('breeds.json', 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading breeds.json:', error.message);
        throw error;
    }
}

async function saveEnrichedBreeds(breeds) {
    try {
        const json = JSON.stringify(breeds, null, 2);
        await fs.writeFile('breeds.json', json, 'utf8');
        console.log(`\n✅ Saved ${breeds.length} enriched breeds to breeds.json`);
    } catch (error) {
        console.error('Error saving breeds.json:', error.message);
        throw error;
    }
}

async function main() {
    try {
        console.log('🚀 Starting breed description enrichment...\n');
        
        const breeds = await loadExistingBreeds();
        console.log(`📚 Loaded ${breeds.length} breeds from breeds.json\n`);
        
        let enhanced = 0;
        let failed = 0;
        
        for (let i = 0; i < breeds.length; i++) {
            const breed = breeds[i];
            console.log(`[${i + 1}/${breeds.length}] Processing ${breed.name}...`);
            
            const enrichedBreed = await enrichBreedDescription(breed);
            
            // Update the breed in the array
            breeds[i] = enrichedBreed;
            
            // Save progress immediately after each breed
            await saveEnrichedBreeds(breeds);
            
            if (enrichedBreed.description !== breed.description) {
                enhanced++;
            } else {
                failed++;
            }
            
            if (i < breeds.length - 1) {
                console.log(`   ⏱️  Waiting ${DELAY_MS/1000} seconds...\n`);
                await delay(DELAY_MS);
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`   Total breeds: ${breeds.length}`);
        console.log(`   Enhanced: ${enhanced}`);
        console.log(`   Unchanged: ${failed}`);
        console.log(`   Success rate: ${Math.round((enhanced / breeds.length) * 100)}%`);
        
    } catch (error) {
        console.error('❌ Enrichment failed:', error.message);
        process.exit(1);
    }
}

main();