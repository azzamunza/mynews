#!/usr/bin/env node

/**
 * Article Watcher
 * Monitors the articles directory and regenerates articles.json when changes occur
 */

const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const ARTICLES_DIR = './articles';
const ARTICLES_JSON_PATH = './articles.json';
const NEWS_DATA_PATH = './news-data.json';

/**
 * Extract metadata from HTML file
 */
async function extractMetadataFromHTML(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extract meta tags
    const getMeta = (name) => {
      const regex = new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i');
      const match = content.match(regex);
      return match ? match[1] : '';
    };

    const filename = path.basename(filePath);
    
    return {
      id: getMeta('article-id'),
      title: getMeta('og:title'),
      filename: filename,
      category: getMeta('article-category'),
      author: getMeta('article-author'),
      publishDate: getMeta('article-date'),
      readTime: getMeta('article-readtime'),
      excerpt: getMeta('description'),
      thumbnailImage: getMeta('og:image'),
      bannerImage: getMeta('og:image'),
      sourceUrl: getMeta('article-source'),
      isTrending: getMeta('article-trending') === 'true',
      isVideo: getMeta('article-video') === 'true',
      videoUrl: getMeta('article-video-url'),
      isJob: false
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Regenerate articles.json from all HTML files in articles directory
 */
async function regenerateArticlesJSON() {
  try {
    console.log('🔄 Regenerating articles.json...');
    
    // Read all HTML files in articles directory
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} HTML files`);
    
    // Extract metadata from each file
    const articlesMetadata = [];
    for (const file of htmlFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      const metadata = await extractMetadataFromHTML(filePath);
      if (metadata && metadata.id) {
        articlesMetadata.push(metadata);
      }
    }
    
    // Sort by publish date (newest first)
    articlesMetadata.sort((a, b) => {
      const dateA = new Date(a.publishDate || '1970-01-01');
      const dateB = new Date(b.publishDate || '1970-01-01');
      return dateB - dateA;
    });
    
    // Write articles.json
    await fs.writeFile(
      ARTICLES_JSON_PATH,
      JSON.stringify({ articles: articlesMetadata }, null, 2),
      'utf-8'
    );
    
    console.log(`✓ Updated articles.json with ${articlesMetadata.length} articles`);
    
  } catch (error) {
    console.error('❌ Error regenerating articles.json:', error.message);
  }
}

/**
 * Start watching the articles directory
 */
function startWatcher() {
  console.log('👁️  Starting article watcher...\n');
  console.log(`📁 Watching: ${path.resolve(ARTICLES_DIR)}`);
  console.log(`📄 Output: ${path.resolve(ARTICLES_JSON_PATH)}\n`);
  console.log('Press Ctrl+C to stop\n');
  console.log('═══════════════════════════════════════\n');
  
  // Initialize watcher
  const watcher = chokidar.watch(ARTICLES_DIR, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: false
  });
  
  let regenerateTimeout = null;
  
  // Debounced regeneration (wait 1 second after last change)
  const scheduleRegeneration = () => {
    if (regenerateTimeout) {
      clearTimeout(regenerateTimeout);
    }
    regenerateTimeout = setTimeout(() => {
      regenerateArticlesJSON();
    }, 1000);
  };
  
  watcher
    .on('add', filePath => {
      if (filePath.endsWith('.html')) {
        console.log(`➕ Added: ${path.basename(filePath)}`);
        scheduleRegeneration();
      }
    })
    .on('change', filePath => {
      if (filePath.endsWith('.html')) {
        console.log(`✏️  Changed: ${path.basename(filePath)}`);
        scheduleRegeneration();
      }
    })
    .on('unlink', filePath => {
      if (filePath.endsWith('.html')) {
        console.log(`➖ Removed: ${path.basename(filePath)}`);
        scheduleRegeneration();
      }
    })
    .on('error', error => {
      console.error('❌ Watcher error:', error);
    })
    .on('ready', () => {
      console.log('✓ Watcher is ready and monitoring for changes\n');
      // Do initial regeneration
      regenerateArticlesJSON();
    });
}

// Run if called directly
if (require.main === module) {
  startWatcher();
}

module.exports = { startWatcher, regenerateArticlesJSON, extractMetadataFromHTML };
