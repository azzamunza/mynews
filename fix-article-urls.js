#!/usr/bin/env node

/**
 * Article URL and Content Fixer
 * Fixes broken images, adds video embeds, and ensures articles have complete content
 */

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Configuration
const ARTICLES_DIR = './articles';
const NEWS_DATA_PATH = './news-data.json';
const ARTICLES_JSON_PATH = './articles.json';
const IMAGES_DIR = './images';
const REQUEST_TIMEOUT = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Check if URL is an SVG placeholder
 */
function isSVGPlaceholder(url) {
  return url && (url.startsWith('data:image/svg+xml') || url.includes('svg'));
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeID(url) {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * Verify if a YouTube video exists
 */
async function verifyYouTubeVideo(videoId) {
  try {
    // First try to check if the video page loads
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    // YouTube returns 200 even for invalid videos, check content
    if (response.ok) {
      const text = await response.text();
      // Check if it's a valid video page (not a removed/unavailable video)
      return !text.includes('Video unavailable') && !text.includes('This video isn\'t available');
    }
    return false;
  } catch (error) {
    // If we can't verify, assume it's valid (YouTube might be blocking requests)
    console.log(`  ⚠ Could not verify video ${videoId}, assuming valid`);
    return true;
  }
}

/**
 * Check if image URL is accessible
 */
async function checkImageURL(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Download image and save locally
 */
async function downloadImage(url, filename) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT * 2); // More time for downloads
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': USER_AGENT,
        'Referer': 'https://google.com/' // Helps with some sites
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    
    const buffer = await response.buffer();
    const filepath = path.join(IMAGES_DIR, filename);
    await fs.writeFile(filepath, buffer);
    
    // Return relative path from articles directory
    return `../images/${filename}`;
  } catch (error) {
    console.error(`  ✗ Failed to download ${url}:`, error.message);
    return null;
  }
}

/**
 * Generate a safe filename from URL
 */
function generateImageFilename(url, articleId) {
  const urlObj = new URL(url);
  const ext = path.extname(urlObj.pathname) || '.jpg';
  const sanitized = articleId.replace(/[^a-z0-9]/g, '-');
  return `${sanitized}-${Date.now()}${ext}`;
}

/**
 * Generate YouTube embed HTML
 */
function generateYouTubeEmbed(videoUrl) {
  const videoId = extractYouTubeID(videoUrl);
  if (!videoId) return '';
  
  return `
        <!-- YouTube Video Embed -->
        <div class="magazine-image-block">
            <div class="magazine-image-container" style="height: auto; background: #000;">
                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
                    <iframe src="https://www.youtube.com/embed/${videoId}" 
                            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen 
                            title="Video"></iframe>
                </div>
            </div>
            <div class="magazine-caption">Watch the related video content</div>
        </div>`;
}

/**
 * Analyze a single article
 */
async function analyzeArticle(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(content);
    
    const issues = {
      filename: path.basename(filePath),
      sourceUrl: $('meta[name="article-source"]').attr('content'),
      hasVideoMeta: $('meta[name="article-video"]').attr('content') === 'true',
      videoUrl: $('meta[name="article-video-url"]').attr('content'),
      svgImages: [],
      missingVideoEmbed: false,
      hasContent: false
    };
    
    // Check for SVG placeholder images
    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (isSVGPlaceholder(src)) {
        issues.svgImages.push({ index: i, src });
      }
    });
    
    // Check if video should be embedded
    if (issues.hasVideoMeta && issues.videoUrl) {
      const hasIframe = $('iframe[src*="youtube"]').length > 0;
      issues.missingVideoEmbed = !hasIframe;
    }
    
    // Check if article has substantial content
    const articleContent = $('.magazine-main-content').text() || $('.article-content').text();
    issues.hasContent = articleContent && articleContent.length > 500;
    
    return issues;
    
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Fix article images and videos
 */
async function fixArticle(filePath, newsDataArticle) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let $ = cheerio.load(content);
    let modified = false;
    
    console.log(`\n📝 Fixing: ${path.basename(filePath)}`);
    
    // Fix images if article data has real images
    if (newsDataArticle && newsDataArticle.bannerImage && !isSVGPlaceholder(newsDataArticle.bannerImage)) {
      let imageUrl = newsDataArticle.bannerImage;
      
      // Check if banner image is accessible
      const isAccessible = await checkImageURL(imageUrl);
      
      if (!isAccessible) {
        console.log(`  ⚠ Banner image not accessible, attempting download: ${imageUrl}`);
        
        // Try to download and save locally
        const filename = generateImageFilename(imageUrl, newsDataArticle.id);
        const localPath = await downloadImage(imageUrl, filename);
        
        if (localPath) {
          imageUrl = localPath;
          console.log(`  ✓ Downloaded image locally to: ${localPath}`);
        } else {
          console.log(`  ✗ Could not download image, keeping original URL`);
        }
      }
      
      // Replace SVG placeholders with real image (or original URL if download failed)
      $('img[src*="data:image/svg"]').each((i, elem) => {
        $(elem).attr('src', imageUrl);
        console.log(`  ✓ Replaced SVG placeholder ${i + 1} with ${isAccessible ? 'accessible' : 'downloaded'} image`);
        modified = true;
      });
    }
    
    // Add YouTube embed if video exists but not embedded
    if (newsDataArticle && newsDataArticle.isVideo && newsDataArticle.videoUrl) {
      const hasIframe = $('iframe[src*="youtube"]').length > 0;
      
      if (!hasIframe) {
        const videoId = extractYouTubeID(newsDataArticle.videoUrl);
        
        if (videoId) {
          // We'll embed the video regardless of verification
          // YouTube will show an error if the video doesn't exist
          const embedHTML = generateYouTubeEmbed(newsDataArticle.videoUrl);
          
          // Insert before the closing div of magazine-main-content
          const mainContent = $('.magazine-main-content');
          if (mainContent.length > 0) {
            mainContent.append(embedHTML);
            console.log(`  ✓ Added YouTube embed for video: ${videoId}`);
            modified = true;
          }
        }
      }
    }
    
    // Replace full content if it's more complete in news-data
    if (newsDataArticle && newsDataArticle.fullContent) {
      const currentContent = $('.magazine-article').html() || '';
      const newsContent = newsDataArticle.fullContent;
      
      // Only replace if news content is significantly larger
      if (newsContent.length > currentContent.length * 1.5) {
        $('.article-content').html(newsContent);
        console.log(`  ✓ Updated with more complete content from news-data.json`);
        modified = true;
      }
    }
    
    if (modified) {
      await fs.writeFile(filePath, $.html(), 'utf-8');
      console.log(`  💾 Saved changes to ${path.basename(filePath)}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🔧 Starting Article URL and Content Fixer...\n');
    
    // Ensure images directory exists
    try {
      await fs.access(IMAGES_DIR);
    } catch {
      await fs.mkdir(IMAGES_DIR, { recursive: true });
      console.log('✓ Created images directory\n');
    }
    
    // Load news data
    const newsDataContent = await fs.readFile(NEWS_DATA_PATH, 'utf-8');
    const newsData = JSON.parse(newsDataContent);
    
    // Create a map for quick lookup
    const newsDataMap = new Map();
    if (newsData.articles) {
      newsData.articles.forEach(article => {
        newsDataMap.set(article.id, article);
      });
    }
    
    console.log(`✓ Loaded ${newsDataMap.size} articles from news-data.json\n`);
    
    // Read all HTML files
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} articles to check\n`);
    console.log('═══════════════════════════════════════\n');
    
    const results = {
      analyzed: 0,
      withSVGImages: 0,
      missingVideoEmbeds: 0,
      lackingContent: 0,
      fixed: 0
    };
    
    // Analyze and fix each article
    for (const file of htmlFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      
      // Analyze
      const issues = await analyzeArticle(filePath);
      if (!issues) continue;
      
      results.analyzed++;
      
      if (issues.svgImages.length > 0) {
        results.withSVGImages++;
        console.log(`\n📊 ${file}:`);
        console.log(`  - Found ${issues.svgImages.length} SVG placeholder(s)`);
      }
      
      if (issues.missingVideoEmbed) {
        results.missingVideoEmbeds++;
        if (issues.svgImages.length === 0) console.log(`\n📊 ${file}:`);
        console.log(`  - Missing video embed for: ${issues.videoUrl}`);
      }
      
      if (!issues.hasContent) {
        results.lackingContent++;
        if (issues.svgImages.length === 0 && !issues.missingVideoEmbed) console.log(`\n📊 ${file}:`);
        console.log(`  - Lacks substantial content`);
      }
      
      // Try to fix if we have issues
      if (issues.svgImages.length > 0 || issues.missingVideoEmbed || !issues.hasContent) {
        // Find corresponding article in news-data
        const content = await fs.readFile(filePath, 'utf-8');
        const $ = cheerio.load(content);
        const articleId = $('meta[name="article-id"]').attr('content');
        const newsArticle = newsDataMap.get(articleId);
        
        if (newsArticle) {
          const wasFixed = await fixArticle(filePath, newsArticle);
          if (wasFixed) results.fixed++;
        } else {
          console.log(`  ⚠ No matching article found in news-data.json for ID: ${articleId}`);
        }
      }
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('Summary:');
    console.log(`  📊 Articles analyzed: ${results.analyzed}`);
    console.log(`  🖼️  Articles with SVG placeholders: ${results.withSVGImages}`);
    console.log(`  🎬 Articles missing video embeds: ${results.missingVideoEmbeds}`);
    console.log(`  📄 Articles lacking content: ${results.lackingContent}`);
    console.log(`  ✅ Articles fixed: ${results.fixed}`);
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { analyzeArticle, fixArticle };
