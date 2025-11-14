#!/usr/bin/env node

/**
 * Article Extractor
 * Extracts articles from news-data.json and generates individual HTML files
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const NEWS_DATA_PATH = './news-data.json';
const ARTICLES_DIR = './articles';
const ARTICLES_JSON_PATH = './articles.json';

/**
 * Sanitize filename by removing special characters
 */
function sanitizeFilename(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100); // Limit length
}

/**
 * Generate HTML structure for an article
 */
function generateArticleHTML(article) {
  const title = article.title || 'Untitled Article';
  const author = article.author || 'Unknown';
  const publishDate = article.publishDate || '';
  const category = article.category || '';
  const excerpt = article.excerpt || '';
  const readTime = article.readTime || '';
  const sourceUrl = article.sourceUrl || '';
  const bannerImage = article.bannerImage || '';
  const fullContent = article.fullContent || '<p>No content available.</p>';
  const isTrending = article.isTrending || false;
  const isVideo = article.isVideo || false;
  const videoUrl = article.videoUrl || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="article-id" content="${article.id}">
    <meta name="article-category" content="${category}">
    <meta name="article-author" content="${author}">
    <meta name="article-date" content="${publishDate}">
    <meta name="article-readtime" content="${readTime}">
    <meta name="article-source" content="${sourceUrl}">
    <meta name="article-trending" content="${isTrending}">
    <meta name="article-video" content="${isVideo}">
    <meta name="article-video-url" content="${videoUrl}">
    <meta name="description" content="${excerpt}">
    <meta name="og:title" content="${title}">
    <meta name="og:description" content="${excerpt}">
    <meta name="og:image" content="${bannerImage}">
    <meta name="og:url" content="${sourceUrl}">
    <title>${title} - NewsHub</title>
    <link rel="stylesheet" href="../css/article-magazine.css">
    <link rel="stylesheet" href="../css/layout-grid.css">
    <style>
        body {
            margin: 0;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            background-color: #f5f5f5;
        }
        .article-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .article-header {
            margin-bottom: 30px;
        }
        .article-meta {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 20px;
        }
        .article-meta span {
            margin-right: 15px;
        }
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #0066cc;
            text-decoration: none;
        }
        .back-link:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="article-container">
        <a href="../index.html" class="back-link">← Back to Home</a>
        <article class="article-header">
            <h1>${title}</h1>
            <div class="article-meta">
                ${category ? `<span><strong>Category:</strong> ${category}</span>` : ''}
                ${author ? `<span><strong>By:</strong> ${author}</span>` : ''}
                ${publishDate ? `<span><strong>Published:</strong> ${publishDate}</span>` : ''}
                ${readTime ? `<span><strong>Read time:</strong> ${readTime} min</span>` : ''}
                ${isTrending ? '<span><strong>🔥 Trending</strong></span>' : ''}
            </div>
            ${bannerImage ? `<img src="${bannerImage}" alt="${title}" style="width: 100%; height: auto; margin-bottom: 20px;">` : ''}
        </article>
        <div class="article-content">
            ${fullContent}
        </div>
        ${sourceUrl ? `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
            <a href="${sourceUrl}" target="_blank" rel="noopener noreferrer">Read original source →</a>
        </div>` : ''}
    </div>
</body>
</html>`;
}

/**
 * Main extraction function
 */
async function extractArticles() {
  try {
    console.log('📰 Starting article extraction...\n');

    // Read news-data.json
    const newsDataContent = await fs.readFile(NEWS_DATA_PATH, 'utf-8');
    const newsData = JSON.parse(newsDataContent);
    
    if (!newsData.articles || !Array.isArray(newsData.articles)) {
      throw new Error('No articles found in news-data.json');
    }

    const articles = newsData.articles;
    console.log(`Found ${articles.length} articles to process\n`);

    // Ensure articles directory exists
    try {
      await fs.access(ARTICLES_DIR);
    } catch {
      await fs.mkdir(ARTICLES_DIR, { recursive: true });
      console.log('✓ Created articles directory\n');
    }

    // Process each article
    const articlesMetadata = [];
    let successCount = 0;
    let errorCount = 0;

    for (const article of articles) {
      try {
        if (!article.id || !article.title) {
          console.log(`⚠ Skipping article with missing id or title`);
          errorCount++;
          continue;
        }

        // Generate filename from title
        const filename = `${sanitizeFilename(article.title)}.html`;
        const filePath = path.join(ARTICLES_DIR, filename);

        // Generate HTML content
        const htmlContent = generateArticleHTML(article);

        // Write HTML file
        await fs.writeFile(filePath, htmlContent, 'utf-8');

        // Add to metadata
        articlesMetadata.push({
          id: article.id,
          title: article.title,
          filename: filename,
          category: article.category || '',
          author: article.author || '',
          publishDate: article.publishDate || '',
          readTime: article.readTime || '',
          excerpt: article.excerpt || '',
          thumbnailImage: article.thumbnailImage || '',
          bannerImage: article.bannerImage || '',
          sourceUrl: article.sourceUrl || '',
          isTrending: article.isTrending || false,
          isVideo: article.isVideo || false,
          videoUrl: article.videoUrl || '',
          isJob: article.isJob || false
        });

        console.log(`✓ Generated: ${filename}`);
        successCount++;

      } catch (error) {
        console.error(`✗ Error processing article "${article.title}":`, error.message);
        errorCount++;
      }
    }

    // Write articles.json
    await fs.writeFile(
      ARTICLES_JSON_PATH,
      JSON.stringify({ articles: articlesMetadata }, null, 2),
      'utf-8'
    );

    console.log(`\n✓ Created articles.json with ${articlesMetadata.length} articles\n`);
    
    // Summary
    console.log('═══════════════════════════════════════');
    console.log('Summary:');
    console.log(`  ✓ Success: ${successCount} articles`);
    console.log(`  ✗ Errors: ${errorCount} articles`);
    console.log(`  📁 Output: ${ARTICLES_DIR}/`);
    console.log(`  📄 Metadata: ${ARTICLES_JSON_PATH}`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  extractArticles();
}

module.exports = { extractArticles, generateArticleHTML, sanitizeFilename };
