#!/usr/bin/env node

/**
 * Article Verification Script
 * Generates a comprehensive report of article status
 */

const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const ARTICLES_DIR = './articles';

/**
 * Check if URL is an SVG placeholder
 */
function isSVGPlaceholder(url) {
  return url && (url.startsWith('data:image/svg+xml') || url.includes('<svg'));
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
 * Analyze a single article for issues
 */
async function analyzeArticle(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const $ = cheerio.load(content);
    
    const analysis = {
      filename: path.basename(filePath),
      title: $('meta[name="og:title"]').attr('content') || $('title').text(),
      sourceUrl: $('meta[name="article-source"]').attr('content'),
      hasVideoMeta: $('meta[name="article-video"]').attr('content') === 'true',
      videoUrl: $('meta[name="article-video-url"]').attr('content'),
      issues: [],
      warnings: [],
      success: []
    };
    
    // Check for SVG placeholder images
    const svgImages = [];
    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (isSVGPlaceholder(src)) {
        svgImages.push({ position: i + 1, src: src.substring(0, 100) + '...' });
      }
    });
    
    if (svgImages.length > 0) {
      analysis.issues.push({
        type: 'SVG_PLACEHOLDERS',
        count: svgImages.length,
        details: svgImages
      });
    } else {
      analysis.success.push('All images are real (no SVG placeholders)');
    }
    
    // Check if video should be embedded
    if (analysis.hasVideoMeta && analysis.videoUrl) {
      const hasIframe = $('iframe[src*="youtube"]').length > 0;
      const videoId = extractYouTubeID(analysis.videoUrl);
      
      if (!hasIframe) {
        analysis.issues.push({
          type: 'MISSING_VIDEO_EMBED',
          videoId: videoId,
          videoUrl: analysis.videoUrl
        });
      } else {
        analysis.success.push(`YouTube video embedded: ${videoId}`);
      }
    }
    
    // Check if article has substantial content
    const magazineContent = $('.magazine-main-content').text();
    const articleContent = $('.article-content').text();
    const contentLength = Math.max(magazineContent?.length || 0, articleContent?.length || 0);
    const hasContent = contentLength > 500;
    
    if (!hasContent) {
      analysis.issues.push({
        type: 'INSUFFICIENT_CONTENT',
        length: contentLength
      });
    } else {
      analysis.success.push(`Substantial content: ${contentLength} characters`);
    }
    
    // Check if article has proper magazine structure
    const hasMagazineStructure = $('.magazine-article').length > 0;
    const hasSidebar = $('.magazine-sidebar').length > 0;
    
    if (!hasMagazineStructure) {
      analysis.warnings.push('Missing magazine article structure');
    } else {
      analysis.success.push('Proper magazine structure');
    }
    
    if (!hasSidebar) {
      analysis.warnings.push('Missing sidebar');
    }
    
    // Check for image overlay text
    const overlayTexts = $('.magazine-image-text').toArray().map(elem => $(elem).text());
    if (overlayTexts.length > 0) {
      const longTexts = overlayTexts.filter(text => text.split(' ').length > 6);
      if (longTexts.length > 0) {
        analysis.warnings.push(`Image overlay text too long (>${6} words): "${longTexts[0]}"`);
      }
    }
    
    return analysis;
    
  } catch (error) {
    return {
      filename: path.basename(filePath),
      error: error.message
    };
  }
}

/**
 * Generate colored console output
 */
function colorize(text, color) {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
  };
  return `${colors[color] || ''}${text}${colors.reset}`;
}

/**
 * Main verification function
 */
async function verifyArticles() {
  try {
    console.log(colorize('🔍 Article Verification Report', 'blue'));
    console.log(colorize('═══════════════════════════════════════\n', 'blue'));
    
    // Read all HTML files
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    console.log(`Found ${htmlFiles.length} articles to verify\n`);
    
    const results = {
      total: 0,
      withIssues: 0,
      withWarnings: 0,
      perfect: 0,
      issues: {
        svgPlaceholders: 0,
        missingVideos: 0,
        insufficientContent: 0
      }
    };
    
    const detailedResults = [];
    
    // Analyze each article
    for (const file of htmlFiles) {
      const filePath = path.join(ARTICLES_DIR, file);
      const analysis = await analyzeArticle(filePath);
      
      results.total++;
      detailedResults.push(analysis);
      
      if (analysis.error) {
        console.log(colorize(`\n❌ ${analysis.filename}`, 'red'));
        console.log(colorize(`   Error: ${analysis.error}`, 'red'));
        results.withIssues++;
        continue;
      }
      
      const hasIssues = analysis.issues.length > 0;
      const hasWarnings = analysis.warnings.length > 0;
      
      if (hasIssues) results.withIssues++;
      if (hasWarnings) results.withWarnings++;
      if (!hasIssues && !hasWarnings) results.perfect++;
      
      // Count specific issues
      analysis.issues.forEach(issue => {
        if (issue.type === 'SVG_PLACEHOLDERS') results.issues.svgPlaceholders++;
        if (issue.type === 'MISSING_VIDEO_EMBED') results.issues.missingVideos++;
        if (issue.type === 'INSUFFICIENT_CONTENT') results.issues.insufficientContent++;
      });
      
      // Print status
      if (hasIssues) {
        console.log(colorize(`\n❌ ${analysis.filename}`, 'red'));
        analysis.issues.forEach(issue => {
          if (issue.type === 'SVG_PLACEHOLDERS') {
            console.log(colorize(`   ⚠ ${issue.count} SVG placeholder(s)`, 'red'));
          } else if (issue.type === 'MISSING_VIDEO_EMBED') {
            console.log(colorize(`   ⚠ Missing video embed: ${issue.videoId}`, 'red'));
          } else if (issue.type === 'INSUFFICIENT_CONTENT') {
            console.log(colorize(`   ⚠ Insufficient content: ${issue.length} chars`, 'red'));
          }
        });
      } else if (hasWarnings) {
        console.log(colorize(`\n⚠️  ${analysis.filename}`, 'yellow'));
        analysis.warnings.forEach(warning => {
          console.log(colorize(`   ⚠ ${warning}`, 'yellow'));
        });
      } else {
        // Only show perfect articles in verbose mode
        // console.log(colorize(`\n✅ ${analysis.filename}`, 'green'));
      }
    }
    
    // Summary
    console.log(colorize('\n\n═══════════════════════════════════════', 'blue'));
    console.log(colorize('Summary:', 'blue'));
    console.log(`  Total articles: ${results.total}`);
    console.log(colorize(`  ✅ Perfect: ${results.perfect}`, 'green'));
    console.log(colorize(`  ⚠️  With warnings: ${results.withWarnings}`, 'yellow'));
    console.log(colorize(`  ❌ With issues: ${results.withIssues}`, 'red'));
    console.log('');
    console.log('Issue Breakdown:');
    console.log(colorize(`  🖼️  SVG placeholders: ${results.issues.svgPlaceholders}`, 'red'));
    console.log(colorize(`  🎬 Missing video embeds: ${results.issues.missingVideos}`, 'red'));
    console.log(colorize(`  📄 Insufficient content: ${results.issues.insufficientContent}`, 'red'));
    console.log(colorize('═══════════════════════════════════════\n', 'blue'));
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: results,
      articles: detailedResults
    };
    
    await fs.writeFile(
      './article-verification-report.json',
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    
    console.log(colorize('📄 Detailed report saved to article-verification-report.json\n', 'blue'));
    
  } catch (error) {
    console.error(colorize('❌ Fatal error:', 'red'), error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  verifyArticles();
}

module.exports = { verifyArticles, analyzeArticle };
