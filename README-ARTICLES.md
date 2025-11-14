# Article Extraction System

This system extracts articles from `news-data.json` and generates individual HTML files with URL validation and replacement capabilities.

## Overview

The article extraction system consists of three main components:

1. **Article Extractor** (`extract-articles.js`) - Extracts articles from news-data.json and generates HTML files
2. **File Watcher** (`watch-articles.js`) - Monitors the articles directory and updates articles.json
3. **URL Validator** (`validate-urls.js`) - Checks URLs in articles and attempts to find replacements

## Installation

```bash
npm install
```

This will install the required dependencies:
- `chokidar` - File system watcher
- `node-fetch` - HTTP client for URL validation
- `cheerio` - HTML parser for extracting URLs

## Usage

### Extract Articles

To extract all articles from `news-data.json` and generate HTML files:

```bash
npm run extract
# or
node extract-articles.js
```

This will:
- Read all articles from `news-data.json`
- Generate HTML files named from article titles in the `articles/` directory
- Create `articles.json` with metadata for all articles
- Store article metadata in HTML `<meta>` tags for accessibility

### Watch Articles Directory

To start the file watcher that automatically updates `articles.json` when HTML files change:

```bash
npm run watch
# or
node watch-articles.js
```

This will:
- Monitor the `articles/` directory for changes
- Automatically regenerate `articles.json` when files are added, changed, or removed
- Extract metadata from HTML files to keep `articles.json` synchronized

### Validate URLs

To check all URLs in article HTML files and attempt to fix broken links:

```bash
npm run validate
# or
node validate-urls.js
```

This will:
- Check all URLs in article HTML files
- Report broken links (404s, timeouts, etc.)
- Attempt to find replacements for broken URLs
- Automatically update HTML files with working replacements
- Generate a detailed report in `url-validation-report.json`

## File Structure

```
mynews/
├── articles/                       # Generated HTML article files
│   ├── article-title-1.html
│   ├── article-title-2.html
│   └── ...
├── articles.json                   # Article metadata for index.html
├── news-data.json                  # Source data
├── index.html                      # Main website (updated to use articles.json)
├── extract-articles.js             # Article extraction script
├── watch-articles.js               # File watcher script
├── validate-urls.js                # URL validation script
├── package.json                    # Dependencies
└── README-ARTICLES.md              # This file
```

## Generated HTML Structure

Each article HTML file contains:

### Metadata in `<head>` Section
- `article-id` - Unique article identifier
- `article-category` - Article category
- `article-author` - Author name
- `article-date` - Publication date
- `article-readtime` - Estimated read time
- `article-source` - Original source URL
- `article-trending` - Whether article is trending
- `article-video` - Whether article has video content
- `article-video-url` - Video URL if applicable
- `description` - Article excerpt
- Open Graph tags for social sharing

### HTML Structure
- Semantic HTML5 structure
- Responsive design
- Back navigation to index.html
- Embedded article content from `fullContent`
- Link to original source
- Consistent styling with main website

## Integration with index.html

The main `index.html` file has been updated to:

1. Load articles from both `news-data.json` and `articles.json`
2. Merge articles, preferring `articles.json` entries
3. Open individual HTML files when clicking on articles (if `filename` property exists)
4. Fall back to modal display for articles without HTML files

## URL Validation Details

The URL validator:
- Checks all URLs in `<img>`, `<a>`, and `<iframe>` tags
- Uses HEAD requests first, falls back to GET if needed
- Attempts multiple variations (HTTP/HTTPS, with/without www)
- Checks archive.org for archived versions
- Replaces broken URLs automatically when valid replacements are found
- Provides Google search and archive links for manual investigation

### Limitations
- Some URLs may be blocked by CORS or firewall policies
- External services may rate-limit requests
- Some broken links may not have suitable replacements
- YouTube embed URLs may require special handling

## HTML Formatting Validation

The generated HTML files:
- Use semantic HTML5 tags
- Include responsive viewport meta tag
- Have consistent container structure matching the main site
- Include CSS from the main website (`article-magazine.css`, `layout-grid.css`)
- Support the magazine-style layout used in fullContent

## Workflow

### Initial Setup
1. Run `npm install` to install dependencies
2. Run `npm run extract` to generate all HTML files
3. Run `npm run validate` to check and fix URLs

### Ongoing Updates
1. Update `news-data.json` with new articles
2. Run `npm run extract` to generate HTML for new articles
3. Optionally run `npm run validate` to check new URLs
4. Or run `npm run watch` to automatically update `articles.json` as files change

### Manual Article Updates
1. Edit HTML files in the `articles/` directory directly
2. The watcher (if running) will automatically update `articles.json`
3. Or manually run `npm run watch` to regenerate `articles.json`

## Troubleshooting

### URLs Not Loading
- Check if the URLs are accessible from your network
- Some websites block automated requests
- Try running validation during different times
- Check the detailed report in `url-validation-report.json`

### Articles Not Appearing
- Verify `articles.json` was generated correctly
- Check browser console for loading errors
- Ensure `news-data.json` has the correct format
- Verify article IDs match between files

### File Watcher Not Working
- Ensure the watcher script is running (`npm run watch`)
- Check file permissions in the `articles/` directory
- Verify the articles directory exists

## Scripts Reference

### extract-articles.js
**Purpose:** Extract articles from news-data.json and generate HTML files

**Key Functions:**
- `sanitizeFilename(title)` - Convert article titles to valid filenames
- `generateArticleHTML(article)` - Create HTML structure for an article
- `extractArticles()` - Main extraction function

### watch-articles.js
**Purpose:** Monitor articles directory and regenerate articles.json

**Key Functions:**
- `extractMetadataFromHTML(filePath)` - Parse metadata from HTML files
- `regenerateArticlesJSON()` - Rebuild articles.json from all HTML files
- `startWatcher()` - Initialize the file system watcher

### validate-urls.js
**Purpose:** Check and fix broken URLs in articles

**Key Functions:**
- `checkURL(url)` - Verify if a URL is accessible
- `findReplacementURL(originalUrl)` - Search for working alternatives
- `extractURLs(html)` - Find all URLs in HTML content
- `replaceURL(html, oldUrl, newUrl)` - Update URLs in HTML
- `validateArticle(filePath)` - Check all URLs in a single article
- `validateAllArticles()` - Main validation function

## Future Enhancements

Potential improvements:
- Implement web search API for better URL replacements
- Add support for image optimization and caching
- Implement incremental extraction (only new/changed articles)
- Add article versioning and change tracking
- Create automated URL monitoring with scheduled checks
- Add support for article translations
- Implement full-text search indexing

## License

MIT
