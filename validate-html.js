#!/usr/bin/env node

/**
 * HTML Validator
 * Checks HTML article files for formatting issues and container compatibility
 */

const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

// Configuration
const ARTICLES_DIR = './articles';

/**
 * Validate HTML structure and formatting
 */
function validateHTMLStructure(html, filename) {
  const issues = [];
  const $ = cheerio.load(html);
  
  // Check for essential elements
  if (!$('meta[name="article-id"]').length) {
    issues.push('Missing article-id meta tag');
  }
  
  if (!$('title').length) {
    issues.push('Missing title tag');
  }
  
  if (!$('meta[name="viewport"]').length) {
    issues.push('Missing viewport meta tag (not responsive)');
  }
  
  // Check for article container
  if (!$('.article-container').length) {
    issues.push('Missing .article-container div');
  }
  
  // Check for back navigation
  if (!$('.back-link').length) {
    issues.push('Missing back navigation link');
  }
  
  // Check images have alt text
  $('img').each((i, elem) => {
    if (!$(elem).attr('alt')) {
      issues.push(`Image ${i + 1} missing alt text`);
    }
  });
  
  // Check for inline styles (potential container issues)
  const inlineStyleCount = $('[style]').length;
  if (inlineStyleCount > 10) {
    issues.push(`High inline style usage (${inlineStyleCount} elements) - may cause container conflicts`);
  }
  
  // Check for large widths that might break container
  $('[style*="width"]').each((i, elem) => {
    const style = $(elem).attr('style');
    if (style && style.includes('width:') && !style.includes('max-width')) {
      const widthMatch = style.match(/width:\s*(\d+)px/);
      if (widthMatch && parseInt(widthMatch[1]) > 1200) {
        issues.push(`Element has fixed width > 1200px which may break container`);
      }
    }
  });
  
  // Check for tables without responsive wrapper
  if ($('table').length > 0 && !$('.table-responsive').length) {
    issues.push('Tables found without responsive wrapper - may overflow on mobile');
  }
  
  // Check for iframe without responsive wrapper
  $('iframe').each((i, elem) => {
    const parent = $(elem).parent();
    const style = parent.attr('style') || '';
    if (!style.includes('position: relative') && !style.includes('padding-bottom')) {
      issues.push(`Iframe ${i + 1} missing responsive wrapper`);
    }
  });
  
  // Check CSS links are relative
  $('link[rel="stylesheet"]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href && !href.startsWith('../') && !href.startsWith('./')) {
      issues.push(`Stylesheet link ${i + 1} not relative: ${href}`);
    }
  });
  
  return {
    filename,
    valid: issues.length === 0,
    issues,
    stats: {
      images: $('img').length,
      links: $('a').length,
      iframes: $('iframe').length,
      videos: $('iframe[src*="youtube"], iframe[src*="vimeo"]').length,
      inlineStyles: inlineStyleCount,
      tableCount: $('table').length
    }
  };
}

/**
 * Validate container compatibility
 */
function validateContainerCompatibility(html, filename) {
  const $ = cheerio.load(html);
  const issues = [];
  
  // Check article content is wrapped properly
  const articleContent = $('.article-content');
  if (articleContent.length === 0) {
    issues.push('Missing .article-content wrapper');
  } else {
    // Check if content has proper max-width
    const container = $('.article-container');
    if (container.length) {
      const style = container.attr('style') || '';
      const cssStyle = $('style').text();
      
      if (!style.includes('max-width') && !cssStyle.includes('.article-container') && !cssStyle.includes('max-width')) {
        issues.push('Container may not have max-width constraint');
      }
    }
  }
  
  // Check for fixed width elements that might overflow
  $('[style*="width"]').each((i, elem) => {
    const style = $(elem).attr('style') || '';
    const widthMatch = style.match(/width:\s*(\d+)px/);
    if (widthMatch && parseInt(widthMatch[1]) > 1200 && !style.includes('max-width')) {
      issues.push(`Element with fixed width > 1200px found`);
    }
  });
  
  // Check magazine layout compatibility
  const hasMagazineLayout = $('.magazine-article').length > 0;
  if (hasMagazineLayout) {
    // Check for magazine CSS
    const hasMagazineCSS = $('link[href*="magazine"]').length > 0 || 
                           $('style').text().includes('magazine-');
    
    if (!hasMagazineCSS) {
      issues.push('Magazine layout used but CSS may not be loaded');
    }
  }
  
  return {
    filename,
    compatible: issues.length === 0,
    issues,
    hasMagazineLayout
  };
}

/**
 * Validate a single article
 */
async function validateArticle(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    const structure = validateHTMLStructure(content, filename);
    const compatibility = validateContainerCompatibility(content, filename);
    
    return {
      filename,
      valid: structure.valid && compatibility.compatible,
      structure,
      compatibility
    };
  } catch (error) {
    return {
      filename: path.basename(filePath),
      valid: false,
      error: error.message
    };
  }
}

/**
 * Main validation function
 */
async function validateAllArticles() {
  try {
    console.log('🔍 Starting HTML validation...\n');
    
    // Read all HTML files
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} articles to validate\n`);
    console.log('═══════════════════════════════════════\n');
    
    const results = [];
    let validCount = 0;
    let issueCount = 0;
    
    // Validate each article
    for (const file of htmlFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      const result = await validateArticle(filePath);
      results.push(result);
      
      if (result.valid) {
        validCount++;
        console.log(`✓ ${file}`);
      } else {
        issueCount++;
        console.log(`✗ ${file}`);
        
        if (result.error) {
          console.log(`  ERROR: ${result.error}`);
        } else {
          if (result.structure && result.structure.issues.length > 0) {
            console.log(`  Structure issues:`);
            result.structure.issues.forEach(issue => {
              console.log(`    - ${issue}`);
            });
          }
          
          if (result.compatibility && result.compatibility.issues.length > 0) {
            console.log(`  Container compatibility issues:`);
            result.compatibility.issues.forEach(issue => {
              console.log(`    - ${issue}`);
            });
          }
        }
        console.log('');
      }
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════');
    console.log('Summary:');
    console.log(`  ✓ Valid articles: ${validCount}`);
    console.log(`  ✗ Articles with issues: ${issueCount}`);
    console.log('═══════════════════════════════════════\n');
    
    // Statistics
    const allStats = results
      .filter(r => r.structure && r.structure.stats)
      .map(r => r.structure.stats);
    
    if (allStats.length > 0) {
      const totalImages = allStats.reduce((sum, s) => sum + s.images, 0);
      const totalLinks = allStats.reduce((sum, s) => sum + s.links, 0);
      const totalVideos = allStats.reduce((sum, s) => sum + s.videos, 0);
      const magazineCount = results.filter(r => r.compatibility && r.compatibility.hasMagazineLayout).length;
      
      console.log('Statistics:');
      console.log(`  📷 Total images: ${totalImages}`);
      console.log(`  🔗 Total links: ${totalLinks}`);
      console.log(`  🎥 Total videos: ${totalVideos}`);
      console.log(`  📰 Magazine layout articles: ${magazineCount}`);
      console.log('═══════════════════════════════════════\n');
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalArticles: htmlFiles.length,
        validArticles: validCount,
        articlesWithIssues: issueCount
      },
      details: results
    };
    
    await fs.writeFile(
      './html-validation-report.json',
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    
    console.log('📄 Detailed report saved to html-validation-report.json\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  validateAllArticles();
}

module.exports = { validateAllArticles, validateArticle, validateHTMLStructure, validateContainerCompatibility };
