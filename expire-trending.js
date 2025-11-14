#!/usr/bin/env node

/**
 * Expire Trending Articles Script
 * 
 * Reviews all articles in the articles directory and sets article-trending to false
 * if the article-date is older than the configured trending time limit.
 * 
 * This script should be run nightly via GitHub Actions.
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const ARTICLES_DIR = './articles';
const CONFIG_PATH = './config.json';

/**
 * Parse date from article format (e.g., "Nov 03, 2025")
 */
function parseArticleDate(dateString) {
  try {
    return new Date(dateString);
  } catch (error) {
    console.error(`Error parsing date: ${dateString}`, error);
    return null;
  }
}

/**
 * Check if article is too old to be trending
 */
function isTooOldForTrending(articleDate, trendingTimeLimitDays) {
  if (!articleDate) return false;
  
  const now = new Date();
  const daysDiff = (now - articleDate) / (1000 * 60 * 60 * 24);
  return daysDiff > trendingTimeLimitDays;
}

/**
 * Update article HTML file to set article-trending to false
 */
async function updateArticleTrending(filePath, shouldBeTrending) {
  try {
    let content = await fs.readFile(filePath, 'utf-8');
    
    // Find and replace the article-trending meta tag
    const trendingRegex = /<meta name="article-trending" content="(true|false)">/i;
    const currentValue = content.match(trendingRegex)?.[1];
    
    if (!currentValue) {
      console.log(`  ⚠ No article-trending meta tag found in ${path.basename(filePath)}`);
      return false;
    }
    
    const newValue = shouldBeTrending ? 'true' : 'false';
    
    // Only update if value changed
    if (currentValue !== newValue) {
      content = content.replace(trendingRegex, `<meta name="article-trending" content="${newValue}">`);
      await fs.writeFile(filePath, content, 'utf-8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`  ❌ Error updating ${path.basename(filePath)}:`, error.message);
    return false;
  }
}

/**
 * Process all articles in the articles directory
 */
async function expireTrendingArticles() {
  try {
    console.log('🔍 Starting trending articles expiration process...\n');
    
    // Load configuration
    const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configData);
    const trendingTimeLimit = config.trendingTimeLimit || 3;
    
    console.log(`⏱️  Trending time limit: ${trendingTimeLimit} days\n`);
    
    // Read all HTML files in articles directory
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    console.log(`📁 Found ${htmlFiles.length} article files\n`);
    
    let processedCount = 0;
    let expiredCount = 0;
    
    // Process each article
    for (const file of htmlFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Extract metadata
        const getMetaContent = (name) => {
          const regex = new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i');
          const match = content.match(regex);
          return match ? match[1] : null;
        };
        
        const articleDate = getMetaContent('article-date');
        const isTrending = getMetaContent('article-trending') === 'true';
        
        if (!articleDate) {
          console.log(`⚠️  ${file}: No article-date found, skipping`);
          continue;
        }
        
        const parsedDate = parseArticleDate(articleDate);
        if (!parsedDate) {
          console.log(`⚠️  ${file}: Invalid date format "${articleDate}", skipping`);
          continue;
        }
        
        // Check if article should still be trending
        const tooOld = isTooOldForTrending(parsedDate, trendingTimeLimit);
        
        if (isTrending && tooOld) {
          console.log(`🔄 ${file}:`);
          console.log(`   Date: ${articleDate}`);
          console.log(`   Status: Expiring trending status`);
          
          const updated = await updateArticleTrending(filePath, false);
          if (updated) {
            expiredCount++;
            console.log(`   ✓ Updated successfully\n`);
          } else {
            console.log(`   ℹ️  No update needed\n`);
          }
        } else if (isTrending) {
          console.log(`✓ ${file}: Still trending (${articleDate})`);
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
      }
    }
    
    console.log('\n═══════════════════════════════════════');
    console.log(`✓ Processing complete`);
    console.log(`  Processed: ${processedCount} articles`);
    console.log(`  Expired: ${expiredCount} trending articles`);
    console.log('═══════════════════════════════════════\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  expireTrendingArticles();
}

module.exports = { expireTrendingArticles };
