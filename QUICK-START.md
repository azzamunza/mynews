# Quick Start Guide

## Installation

```bash
npm install
```

## Basic Usage

### Extract All Articles
```bash
npm run extract
```
This will:
- Read all articles from `news-data.json`
- Generate HTML files in the `articles/` directory
- Create `articles.json` with metadata

### Validate HTML
```bash
npm run validate-html
```
This checks all HTML files for:
- Proper structure
- Container compatibility
- Responsive design

### Validate URLs
```bash
npm run validate
```
This checks and fixes broken links in articles.

### Test Everything
```bash
npm run test
```
Runs complete workflow verification.

### Watch for Changes
```bash
npm run watch
```
Monitors the `articles/` directory and automatically updates `articles.json`.

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run extract` | Generate HTML from news-data.json |
| `npm run watch` | Monitor articles directory |
| `npm run validate` | Check URLs for broken links |
| `npm run validate-html` | Validate HTML structure |
| `npm run test` | Run workflow tests |
| `npm run build` | Extract + validate HTML |

## File Structure

```
mynews/
├── articles/                   # Generated HTML files
│   └── *.html                 # Individual article pages
├── articles.json              # Article metadata
├── news-data.json             # Source data
├── index.html                 # Main website
├── extract-articles.js        # Extraction script
├── watch-articles.js          # File watcher
├── validate-urls.js           # URL validator
├── validate-html.js           # HTML validator
├── test-workflow.js           # Test suite
└── package.json               # Dependencies
```

## Common Tasks

### Add New Articles
1. Update `news-data.json` with new articles
2. Run `npm run extract`
3. Articles appear in the `articles/` directory

### Check Article Quality
```bash
npm run validate-html
```

### Fix Broken Links
```bash
npm run validate
```

### Monitor Changes
```bash
npm run watch &
# Edit articles manually
# articles.json updates automatically
```

## Troubleshooting

### Articles Not Generating
- Check `news-data.json` syntax
- Ensure articles have required fields
- Check console for error messages

### URLs Not Loading
- Some URLs may be blocked by network
- Check `url-validation-report.json` for details
- Review archive.org alternatives

### HTML Validation Fails
- Check `html-validation-report.json`
- Review specific issues listed
- Verify CSS files are accessible

## Next Steps

For detailed information, see:
- `README-ARTICLES.md` - Complete documentation
- `IMPLEMENTATION-SUMMARY.md` - Technical details

## Support

Run tests to verify system health:
```bash
npm run test
```

Expected output:
```
✅ ALL TESTS PASSED - System is working correctly!
```
