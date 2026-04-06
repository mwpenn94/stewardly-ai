# Stewardly Chrome Extension

AI-powered financial advisory tools for advisors.

## Features
- **Side Panel**: Quick chat, mini calculator, client search
- **LinkedIn Capture**: "Add to Stewardly" button on LinkedIn profiles
- **Gmail Compliance**: Real-time compliance screening of email drafts

## Development
```bash
cd chrome-extension
# TypeScript files need to be compiled to JS before loading
npx tsc --outDir dist
```

## Loading in Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension/` directory

## Publishing to Chrome Web Store
1. Create a developer account ($5 one-time fee)
2. Zip the extension directory
3. Upload at https://chrome.google.com/webstore/devconsole

## Auth
The extension reuses the session cookie from stewardly.manus.space.
User must be signed in to the web app for the extension to work.
