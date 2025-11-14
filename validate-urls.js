#!/usr/bin/env node

/**
 * URL Validator
 * Checks all URLs in HTML articles for broken links and attempts to find replacements
 */

const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Configuration
const ARTICLES_DIR = './articles';
const MAX_CONCURRENT_CHECKS = 5;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const USER_AGENT = 'Mozilla/5.0 (compatible; NewsHub-URLChecker/1.0)';

/**
 * Check if a URL is accessible
 */
async function checkURL(url, timeout = REQUEST_TIMEOUT) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': USER_AGENT
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeoutId);
    
    return {
      url,
      status: response.status,
      ok: response.ok,
      redirected: response.redirected,
      finalUrl: response.url
    };
  } catch (error) {
    // If HEAD fails, try GET with limited body
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': USER_AGENT
        },
        signal: controller.signal,
        redirect: 'follow'
      });
      
      clearTimeout(timeoutId);
      
      return {
        url,
        status: response.status,
        ok: response.ok,
        redirected: response.redirected,
        finalUrl: response.url
      };
    } catch (getError) {
      return {
        url,
        status: 0,
        ok: false,
        error: getError.message
      };
    }
  }
}

/**
 * Search for a replacement URL (simple implementation)
 */
async function findReplacementURL(originalUrl, context = '') {
  try {
    // Extract domain and path
    const urlObj = new URL(originalUrl);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;
    
    // Try variations
    const variations = [
      // Try HTTP if HTTPS fails
      originalUrl.replace('https://', 'http://'),
      // Try without www
      originalUrl.replace('www.', ''),
      // Try with www
      originalUrl.replace(/https?:\/\//, 'https://www.'),
      // Try archive.org
      `https://web.archive.org/web/*/${originalUrl}`
    ];
    
    for (const variation of variations) {
      if (variation === originalUrl) continue;
      
      const result = await checkURL(variation);
      if (result.ok) {
        return {
          found: true,
          newUrl: result.finalUrl || variation,
          method: 'variation'
        };
      }
    }
    
    return {
      found: false,
      suggestions: [
        `Search Google: https://www.google.com/search?q=${encodeURIComponent(domain + ' ' + context)}`,
        `Archive: https://web.archive.org/web/*/${originalUrl}`
      ]
    };
  } catch (error) {
    return { found: false, error: error.message };
  }
}

/**
 * Extract all URLs from HTML content
 */
function extractURLs(html) {
  const $ = cheerio.load(html);
  const urls = new Set();
  
  // Extract from img src
  $('img[src]').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      urls.add(src);
    }
  });
  
  // Extract from a href
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
      urls.add(href);
    }
  });
  
  // Extract from iframe src
  $('iframe[src]').each((i, elem) => {
    const src = $(elem).attr('src');
    if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
      urls.add(src);
    }
  });
  
  return Array.from(urls);
}

/**
 * Replace URL in HTML content
 */
function replaceURL(html, oldUrl, newUrl) {
  return html.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);
}

/**
 * Validate URLs in a single article
 */
async function validateArticle(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const urls = extractURLs(content);
    
    if (urls.length === 0) {
      return { filePath, urls: [], broken: [], fixed: 0 };
    }
    
    console.log(`\n📄 Checking ${path.basename(filePath)} (${urls.length} URLs)`);
    
    const results = [];
    let modifiedContent = content;
    let fixedCount = 0;
    
    // Check URLs in batches
    for (let i = 0; i < urls.length; i += MAX_CONCURRENT_CHECKS) {
      const batch = urls.slice(i, i + MAX_CONCURRENT_CHECKS);
      const checks = await Promise.all(batch.map(url => checkURL(url)));
      
      for (const check of checks) {
        if (!check.ok) {
          console.log(`  ✗ Broken: ${check.url} (${check.status || 'ERROR'})`);
          
          // Try to find replacement
          const replacement = await findReplacementURL(check.url, path.basename(filePath));
          
          if (replacement.found) {
            console.log(`    ↪ Replaced with: ${replacement.newUrl}`);
            modifiedContent = replaceURL(modifiedContent, check.url, replacement.newUrl);
            fixedCount++;
            results.push({ url: check.url, status: check.status, fixed: true, newUrl: replacement.newUrl });
          } else {
            console.log(`    ⚠ No replacement found`);
            if (replacement.suggestions) {
              replacement.suggestions.forEach(s => console.log(`      → ${s}`));
            }
            results.push({ url: check.url, status: check.status, fixed: false });
          }
        } else {
          console.log(`  ✓ OK: ${check.url}`);
        }
      }
    }
    
    // Write modified content if URLs were fixed
    if (fixedCount > 0) {
      await fs.writeFile(filePath, modifiedContent, 'utf-8');
      console.log(`  💾 Saved ${fixedCount} fix(es) to file`);
    }
    
    return {
      filePath,
      urls: urls.length,
      broken: results.filter(r => !r.fixed),
      fixed: fixedCount
    };
    
  } catch (error) {
    console.error(`Error validating ${filePath}:`, error.message);
    return { filePath, error: error.message };
  }
}

/**
 * Main validation function
 */
async function validateAllArticles() {
  try {
    console.log('🔍 Starting URL validation...\n');
    
    // Read all HTML files
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} articles to validate\n`);
    console.log('═══════════════════════════════════════\n');
    
    const results = [];
    
    // Validate each article
    for (const file of htmlFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      const result = await validateArticle(filePath);
      results.push(result);
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('Summary:');
    
    const totalUrls = results.reduce((sum, r) => sum + (r.urls || 0), 0);
    const totalBroken = results.reduce((sum, r) => sum + (r.broken?.length || 0), 0);
    const totalFixed = results.reduce((sum, r) => sum + (r.fixed || 0), 0);
    
    console.log(`  📊 Total URLs checked: ${totalUrls}`);
    console.log(`  ✗ Broken URLs found: ${totalBroken}`);
    console.log(`  ✓ URLs fixed: ${totalFixed}`);
    console.log(`  ⚠ URLs still broken: ${totalBroken - totalFixed}`);
    console.log('═══════════════════════════════════════\n');
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalArticles: htmlFiles.length,
        totalUrls,
        totalBroken,
        totalFixed,
        stillBroken: totalBroken - totalFixed
      },
      details: results
    };
    
    await fs.writeFile(
      './url-validation-report.json',
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    
    console.log('📄 Detailed report saved to url-validation-report.json\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  validateAllArticles();
}

module.exports = { validateAllArticles, validateArticle, checkURL, findReplacementURL };
