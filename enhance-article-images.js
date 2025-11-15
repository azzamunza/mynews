/**
 * Script to enhance article images by:
 * 1. Extracting source URLs from article metadata
 * 2. Fetching images from source articles
 * 3. Adding ALT attributes with source information
 * 4. Saving images locally if direct linking fails
 */

const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const cheerio = require('cheerio');

const ARTICLES_DIR = './articles';
const IMAGES_DIR = './images';

// Ensure images directory exists
async function ensureImagesDir() {
    try {
        await fs.access(IMAGES_DIR);
    } catch {
        await fs.mkdir(IMAGES_DIR, { recursive: true });
    }
}

// Read all HTML files from articles directory
async function getArticleFiles() {
    const files = await fs.readdir(ARTICLES_DIR);
    return files.filter(file => file.endsWith('.html'));
}

// Extract metadata from HTML
function extractMetadata($) {
    const metadata = {};
    
    // Extract source URL
    const sourceUrl = $('meta[name="article-source"]').attr('content');
    metadata.sourceUrl = sourceUrl;
    
    // Extract existing og:image
    const ogImage = $('meta[property="og:image"]').attr('content');
    metadata.ogImage = ogImage;
    
    // Extract article title
    const title = $('h1').first().text() || $('title').text().replace(' - NewsHub', '');
    metadata.title = title;
    
    return metadata;
}

// Fetch page content with error handling
async function fetchPage(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        
        protocol.get(url, options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Extract images from source page
function extractImagesFromSource(html, sourceUrl) {
    const $ = cheerio.load(html);
    const images = [];
    
    // Find all images in the page
    $('img').each((i, elem) => {
        let src = $(elem).attr('src') || $(elem).attr('data-src') || $(elem).attr('data-lazy-src');
        
        if (!src) return;
        
        // Convert relative URLs to absolute
        if (src.startsWith('//')) {
            src = 'https:' + src;
        } else if (src.startsWith('/')) {
            const urlObj = new URL(sourceUrl);
            src = `${urlObj.protocol}//${urlObj.host}${src}`;
        } else if (!src.startsWith('http')) {
            const urlObj = new URL(sourceUrl);
            const basePath = sourceUrl.substring(0, sourceUrl.lastIndexOf('/'));
            src = `${basePath}/${src}`;
        }
        
        // Get alt text if available
        const alt = $(elem).attr('alt') || '';
        
        // Filter out small images, icons, and tracking pixels
        const width = parseInt($(elem).attr('width')) || 0;
        const height = parseInt($(elem).attr('height')) || 0;
        
        // Skip tiny images
        if ((width > 0 && width < 100) || (height > 0 && height < 100)) {
            return;
        }
        
        // Skip common tracking/icon patterns
        if (src.includes('icon') || 
            src.includes('logo') || 
            src.includes('pixel') ||
            src.includes('tracker') ||
            src.includes('1x1') ||
            src.endsWith('.svg')) {
            return;
        }
        
        images.push({
            url: src,
            alt: alt || `Image from ${new URL(sourceUrl).hostname}`
        });
    });
    
    return images;
}

// Download image and save locally
async function downloadImage(url, filename) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const filepath = path.join(IMAGES_DIR, filename);
        
        protocol.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to download: ${res.statusCode}`));
                return;
            }
            
            const fileStream = require('fs').createWriteStream(filepath);
            res.pipe(fileStream);
            
            fileStream.on('finish', () => {
                fileStream.close();
                resolve(filepath);
            });
            
            fileStream.on('error', (err) => {
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

// Update article HTML with enhanced images
function updateArticleHTML($, images, metadata) {
    let updated = false;
    
    // Update existing images with ALT tags if missing
    $('img').each((i, elem) => {
        const currentAlt = $(elem).attr('alt');
        
        // If ALT is missing or generic, improve it
        if (!currentAlt || currentAlt.trim() === '' || currentAlt === metadata.title) {
            const sourceHost = metadata.sourceUrl ? new URL(metadata.sourceUrl).hostname : 'source';
            $(elem).attr('alt', `${metadata.title} - Image from ${sourceHost}`);
            updated = true;
        }
    });
    
    // Check if article content area exists
    const articleContent = $('.article-content');
    
    if (articleContent.length > 0 && images.length > 0) {
        // Add images from source if article content is sparse
        const existingImages = articleContent.find('img').length;
        
        if (existingImages < 2 && images.length > 0) {
            // Add up to 2 additional images from source
            const imagesToAdd = images.slice(0, Math.min(2, images.length));
            
            imagesToAdd.forEach((img, idx) => {
                const imgHtml = `
                    <div class="article-image-block" style="margin: 20px 0;">
                        <img src="${img.url}" alt="${img.alt}" style="max-width: 100%; height: auto; border-radius: 4px;">
                        <p style="font-size: 0.9em; color: #666; margin-top: 5px; font-style: italic;">
                            ${img.alt}
                        </p>
                    </div>
                `;
                
                // Insert after first paragraph or at the beginning
                const paragraphs = articleContent.find('p');
                if (paragraphs.length > idx) {
                    $(paragraphs[idx]).after(imgHtml);
                } else {
                    articleContent.append(imgHtml);
                }
            });
            
            updated = true;
        }
    }
    
    return updated;
}

// Process a single article
async function processArticle(filename) {
    console.log(`Processing: ${filename}`);
    
    try {
        const filepath = path.join(ARTICLES_DIR, filename);
        const html = await fs.readFile(filepath, 'utf8');
        const $ = cheerio.load(html);
        
        const metadata = extractMetadata($);
        
        if (!metadata.sourceUrl) {
            console.log(`  ⚠️  No source URL found, skipping`);
            return { processed: false, reason: 'no-source-url' };
        }
        
        console.log(`  📄 Source: ${metadata.sourceUrl}`);
        
        // Try to fetch source page
        let sourceImages = [];
        try {
            console.log(`  🌐 Fetching source page...`);
            const sourceHtml = await fetchPage(metadata.sourceUrl);
            sourceImages = extractImagesFromSource(sourceHtml, metadata.sourceUrl);
            console.log(`  🖼️  Found ${sourceImages.length} images from source`);
        } catch (error) {
            console.log(`  ⚠️  Could not fetch source page: ${error.message}`);
            // Continue anyway, we can still improve existing images
        }
        
        // Update article with enhanced images and ALT tags
        const updated = updateArticleHTML($, sourceImages, metadata);
        
        if (updated) {
            await fs.writeFile(filepath, $.html());
            console.log(`  ✅ Article updated`);
            return { processed: true, imagesAdded: sourceImages.length };
        } else {
            console.log(`  ℹ️  No updates needed`);
            return { processed: false, reason: 'no-updates-needed' };
        }
        
    } catch (error) {
        console.error(`  ❌ Error processing ${filename}:`, error.message);
        return { processed: false, error: error.message };
    }
}

// Main function
async function main() {
    console.log('🚀 Starting article image enhancement...\n');
    
    await ensureImagesDir();
    
    const articleFiles = await getArticleFiles();
    console.log(`Found ${articleFiles.length} articles to process\n`);
    
    const results = {
        total: articleFiles.length,
        processed: 0,
        skipped: 0,
        errors: 0
    };
    
    // Process articles one by one (to avoid overwhelming servers)
    for (const file of articleFiles) {
        const result = await processArticle(file);
        
        if (result.processed) {
            results.processed++;
        } else if (result.error) {
            results.errors++;
        } else {
            results.skipped++;
        }
        
        // Small delay to be polite to source servers
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`   Total articles: ${results.total}`);
    console.log(`   ✅ Processed: ${results.processed}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Errors: ${results.errors}`);
    console.log('='.repeat(50));
}

// Run the script
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { processArticle, extractImagesFromSource };
