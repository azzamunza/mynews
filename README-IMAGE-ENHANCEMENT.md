# Article Image Enhancement Script

This script enhances articles by adding proper ALT tags to images and attempting to fetch additional images from source articles.

## Features

1. **ALT Tag Enhancement**: Automatically adds descriptive ALT tags to images that include:
   - Article title
   - Source hostname (e.g., "Image from www.wired.com")

2. **Source Image Retrieval**: Attempts to fetch images from the original source article URL:
   - Extracts images from the source page
   - Filters out small images, icons, and tracking pixels
   - Adds up to 2 additional high-quality images to articles with sparse content

3. **Fallback Handling**: If source images cannot be fetched:
   - Still updates existing images with proper ALT tags
   - Uses og:image metadata already present in articles

4. **Local Storage**: Images can be downloaded to the `./images` directory for local hosting (in environments with external access)

## Usage

Run the enhancement script:

```bash
npm run enhance-images
```

Or directly:

```bash
node enhance-article-images.js
```

## How It Works

1. **Scans** all HTML files in the `./articles` directory
2. **Extracts** metadata including:
   - `article-source` meta tag (source URL)
   - `og:image` meta tag (primary image)
   - Article title
3. **Attempts to fetch** the source page to find additional images
4. **Updates** the article HTML with:
   - Enhanced ALT tags on existing images
   - Additional images from source (if available)
   - Proper attribution in image captions
5. **Saves** the updated HTML back to the article file

## Example Output

### Before Enhancement
```html
<img src="https://example.com/image.jpg" alt="Article Title">
```

### After Enhancement
```html
<img src="https://example.com/image.jpg" alt="Article Title - Image from example.com">
```

## Limitations in Sandboxed Environments

In environments without external internet access (like CI/CD pipelines), the script will:
- Still add ALT tags to existing images
- Not be able to fetch additional images from source
- Process all articles successfully with improved metadata

## Configuration

The script has built-in filtering to exclude:
- Images smaller than 100x100 pixels
- Icons and logos
- Tracking pixels
- SVG files
- Images with common tracking URL patterns

## Error Handling

The script handles errors gracefully:
- Continues processing even if a source page cannot be fetched
- Reports statistics at the end (processed, skipped, errors)
- Provides detailed console output for each article

## Integration with Build Process

To automatically enhance images during the build process, modify `package.json`:

```json
"scripts": {
  "build": "npm run extract && npm run enhance-images && npm run validate-html"
}
```

## Manual Image Management

Images saved to the `./images` directory can be:
- Committed to the repository
- Served locally with the website
- Referenced in articles using relative paths

## Example: Adding Images Manually

If you want to add images manually to an article:

1. Save image to `./images/my-image.jpg`
2. Add to article HTML:

```html
<div class="article-image-block" style="margin: 20px 0;">
    <img src="../images/my-image.jpg" 
         alt="Descriptive text - Image from source.com" 
         style="max-width: 100%; height: auto; border-radius: 4px;">
    <p style="font-size: 0.9em; color: #666; margin-top: 5px; font-style: italic;">
        Image caption with attribution
    </p>
</div>
```

## Troubleshooting

### "getaddrinfo ENOTFOUND" errors
This means the environment cannot access external URLs. The script will still enhance existing images with ALT tags.

### No images found in source
Some websites may use JavaScript to load images, which this script cannot detect. Consider adding images manually or using the og:image from metadata.

### Rate limiting
The script includes a 500ms delay between processing articles to be respectful to source servers.

## Future Enhancements

Potential improvements for this script:
- Support for downloading videos from source
- Automatic image optimization and resizing
- Support for lazy-loaded images on source pages
- Integration with image CDN services
- Automatic WEBP conversion for better performance
