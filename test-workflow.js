#!/usr/bin/env node

/**
 * Workflow Test Script
 * Tests the complete article extraction and validation workflow
 */

const fs = require('fs').promises;
const path = require('path');
const { extractArticles } = require('./extract-articles.js');
const { regenerateArticlesJSON } = require('./watch-articles.js');
const { validateHTMLStructure } = require('./validate-html.js');

const ARTICLES_DIR = './articles';
const ARTICLES_JSON_PATH = './articles.json';
const NEWS_DATA_PATH = './news-data.json';

/**
 * Test workflow
 */
async function testWorkflow() {
  console.log('🧪 Testing Complete Workflow\n');
  console.log('═══════════════════════════════════════\n');
  
  try {
    // Step 1: Check news-data.json exists
    console.log('Step 1: Checking news-data.json...');
    await fs.access(NEWS_DATA_PATH);
    const newsData = JSON.parse(await fs.readFile(NEWS_DATA_PATH, 'utf-8'));
    console.log(`✓ Found ${newsData.articles?.length || 0} articles in news-data.json\n`);
    
    // Step 2: Check articles directory
    console.log('Step 2: Checking articles directory...');
    await fs.access(ARTICLES_DIR);
    const files = await fs.readdir(ARTICLES_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    console.log(`✓ Found ${htmlFiles.length} HTML files in articles directory\n`);
    
    // Step 3: Check articles.json
    console.log('Step 3: Checking articles.json...');
    await fs.access(ARTICLES_JSON_PATH);
    const articlesJson = JSON.parse(await fs.readFile(ARTICLES_JSON_PATH, 'utf-8'));
    console.log(`✓ articles.json contains ${articlesJson.articles?.length || 0} articles\n`);
    
    // Step 4: Validate a sample article
    console.log('Step 4: Validating sample article...');
    if (htmlFiles.length > 0) {
      const sampleFile = path.join(ARTICLES_DIR, htmlFiles[0]);
      const content = await fs.readFile(sampleFile, 'utf-8');
      const validation = validateHTMLStructure(content, htmlFiles[0]);
      
      if (validation.valid) {
        console.log(`✓ Sample article "${htmlFiles[0]}" is valid\n`);
      } else {
        console.log(`✗ Sample article has issues:`);
        validation.issues.forEach(issue => console.log(`  - ${issue}`));
        console.log('');
      }
    }
    
    // Step 5: Check article metadata
    console.log('Step 5: Checking article metadata...');
    const sampleArticle = articlesJson.articles[0];
    const requiredFields = ['id', 'title', 'filename', 'category', 'author'];
    const missingFields = requiredFields.filter(field => !sampleArticle[field]);
    
    if (missingFields.length === 0) {
      console.log(`✓ Sample article has all required metadata fields\n`);
    } else {
      console.log(`✗ Sample article missing fields: ${missingFields.join(', ')}\n`);
    }
    
    // Step 6: Verify filename matches
    console.log('Step 6: Verifying filename references...');
    let filenameMatches = 0;
    let filenameMismatches = 0;
    
    for (const article of articlesJson.articles) {
      if (article.filename) {
        const filePath = path.join(ARTICLES_DIR, article.filename);
        try {
          await fs.access(filePath);
          filenameMatches++;
        } catch {
          filenameMismatches++;
          console.log(`  ⚠ File not found: ${article.filename}`);
        }
      }
    }
    
    console.log(`✓ ${filenameMatches} filename references match existing files`);
    if (filenameMismatches > 0) {
      console.log(`✗ ${filenameMismatches} filename references don't match files`);
    }
    console.log('');
    
    // Step 7: Check index.html
    console.log('Step 7: Checking index.html integration...');
    const indexHtml = await fs.readFile('./index.html', 'utf-8');
    
    const hasArticlesJsonLoad = indexHtml.includes('articles.json');
    const hasOpenModalUpdate = indexHtml.includes('article.filename');
    
    if (hasArticlesJsonLoad && hasOpenModalUpdate) {
      console.log(`✓ index.html is configured to use articles.json\n`);
    } else {
      console.log(`⚠ index.html may not be properly configured:`);
      if (!hasArticlesJsonLoad) console.log(`  - Missing articles.json loading code`);
      if (!hasOpenModalUpdate) console.log(`  - Missing filename handling in openModal`);
      console.log('');
    }
    
    // Summary
    console.log('═══════════════════════════════════════');
    console.log('Test Summary:');
    console.log(`  Articles in news-data.json: ${newsData.articles?.length || 0}`);
    console.log(`  HTML files generated: ${htmlFiles.length}`);
    console.log(`  Articles in articles.json: ${articlesJson.articles?.length || 0}`);
    console.log(`  Filename matches: ${filenameMatches}/${articlesJson.articles?.length || 0}`);
    console.log('═══════════════════════════════════════\n');
    
    // Final verdict
    const allTestsPassed = 
      htmlFiles.length > 0 &&
      articlesJson.articles?.length > 0 &&
      filenameMatches > 0 &&
      filenameMismatches === 0 &&
      hasArticlesJsonLoad &&
      hasOpenModalUpdate;
    
    if (allTestsPassed) {
      console.log('✅ ALL TESTS PASSED - System is working correctly!\n');
      return 0;
    } else {
      console.log('⚠️  SOME TESTS FAILED - Please review the issues above\n');
      return 1;
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error(error.stack);
    return 1;
  }
}

// Run if called directly
if (require.main === module) {
  testWorkflow().then(code => process.exit(code));
}

module.exports = { testWorkflow };
