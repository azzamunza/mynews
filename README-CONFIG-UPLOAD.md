# Config Upload Feature Documentation

## Overview

The configuration editor now supports automatic uploading of `config.json` to GitHub and immediate local application of changes via localStorage.

## Features

### 1. Immediate Config Application
When you save configuration changes, they are:
- Saved to browser localStorage immediately (instant effect)
- Applied to all pages that load config (index.html, etc.)
- Persisted until GitHub upload completes

### 2. Automatic GitHub Upload
Configuration changes are automatically committed and pushed to your GitHub repository using the GitHub API.

## Setup Instructions

### Step 1: Create a GitHub Personal Access Token

1. Go to [GitHub Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token" (classic)
3. Give it a descriptive name (e.g., "NewsHub Config Editor")
4. Select the **`repo`** scope (full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

### Step 2: Configure GitHub Settings in config.html

1. Open `config.html` in your browser
2. Click on the "GitHub Settings" tab
3. Fill in the following information:
   - **GitHub Personal Access Token**: Paste your token (starts with `ghp_`)
   - **Repository Owner**: Your GitHub username or organization name
   - **Repository Name**: The name of your repository (e.g., `mynews`)
   - **Branch**: The branch to commit to (usually `main`)
4. Click "Save GitHub Settings"
5. Click "Test Connection" to verify the setup works

### Step 3: Save Configuration Changes

Now when you make changes in any config tab and click "Save", the system will:
1. Apply changes immediately via localStorage (you'll see them right away)
2. Commit and push the changes to GitHub automatically
3. Show a success message when the upload completes

## How It Works

### localStorage Priority System

The configuration loading follows this priority:

1. **Check localStorage first**: If there's a pending config in `mynews_config_pending`, use it
2. **Fallback to server**: If no localStorage config, fetch from `config.json`

This ensures:
- Changes are visible immediately after saving
- Website continues to work even if GitHub upload fails
- Once GitHub processes the commit, localStorage can be cleared

### Config Loading Flow

```javascript
// In index.html, config.html, etc.
async function loadConfig() {
    // 1. Try localStorage first
    const localConfig = localStorage.getItem('mynews_config_pending');
    if (localConfig) {
        return JSON.parse(localConfig); // Use local config
    }
    
    // 2. Fall back to server
    const response = await fetch('config.json');
    return await response.json();
}
```

### Config Saving Flow

```javascript
async function saveConfig(commitMessage) {
    // 1. Save to localStorage (immediate effect)
    localStorage.setItem('mynews_config_pending', JSON.stringify(config));
    
    // 2. Upload to GitHub (background)
    await uploadToGitHub(config, commitMessage);
    
    // 3. Clear localStorage after successful upload
    localStorage.removeItem('mynews_config_pending');
}
```

## Testing

A test page is available at `test-config-integration.html` that verifies:
- localStorage config storage and retrieval
- Config loading priority (localStorage vs server)
- Mock config simulation

## Security Notes

### Token Storage
- The GitHub token is stored in browser localStorage
- It's only accessible to pages on the same origin
- Never commit your token to the repository

### Token Permissions
- The token only needs `repo` scope
- Consider using a fine-grained token with minimal permissions
- Rotate tokens periodically for security

### Fallback Behavior
- If GitHub upload fails, config is still saved locally
- Users are notified of upload failures
- Manual file download is available as backup

## Troubleshooting

### "GitHub not configured" error
- Go to GitHub Settings tab
- Enter your token and repository information
- Click "Test Connection" to verify

### "Failed to update config.json on GitHub" error
- Check that your token has `repo` scope
- Verify repository owner and name are correct
- Ensure the branch exists and you have write access

### Changes not appearing on live site
- localStorage changes are immediate in your browser
- GitHub Pages updates may take a few minutes after commit
- Clear browser cache if needed

### Config seems stuck on old values
- Clear localStorage: Open browser console and run:
  ```javascript
  localStorage.removeItem('mynews_config_pending');
  location.reload();
  ```

## Files Modified

- `config.html`: Added GitHub Settings tab, localStorage support, GitHub API integration
- `index.html`: Updated `loadBionicConfig()` to check localStorage first
- `test-config-integration.html`: Test page for verifying localStorage functionality

## API Usage

The implementation uses GitHub's REST API v3:
- **GET** `/repos/{owner}/{repo}/contents/config.json` - Get current file SHA
- **PUT** `/repos/{owner}/{repo}/contents/config.json` - Update file content

Rate limits: 5,000 requests per hour for authenticated requests.
