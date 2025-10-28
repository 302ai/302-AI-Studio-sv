# Plugin Submission Guide

Complete guide to submitting your plugin to the 302 AI Studio Plugin Registry.

## 📋 Prerequisites

Before you begin, make sure you have:

- [ ] A working plugin built with `@302ai/studio-plugin-sdk`
- [ ] A GitHub account
- [ ] Your plugin tested in 302 AI Studio
- [ ] Basic knowledge of Git and GitHub

## 🚀 Step-by-Step Guide

### Step 1: Develop Your Plugin

#### 1.1 Install the SDK

```bash
npm install @302ai/studio-plugin-sdk
# or
pnpm add @302ai/studio-plugin-sdk
```

#### 1.2 Create Plugin Structure

```
my-plugin/
├── plugin.json          # Plugin metadata (required)
├── main/
│   └── index.ts        # Plugin entry point (required)
├── README.md           # Documentation (required)
├── CHANGELOG.md        # Version history (recommended)
├── package.json        # Dependencies (if any)
└── icon.png           # Plugin icon (recommended)
```

#### 1.3 Create plugin.json

```json
{
	"id": "my-awesome-plugin",
	"name": "My Awesome Plugin",
	"version": "1.0.0",
	"description": "A brief description of what your plugin does",
	"author": "Your Name",
	"type": "provider",
	"main": "main/index.js",
	"permissions": ["http", "storage"],
	"tags": ["ai", "provider", "openai"],
	"configSchema": {
		"type": "object",
		"properties": {
			"apiKey": {
				"type": "string",
				"title": "API Key",
				"description": "Your API key"
			}
		},
		"required": ["apiKey"]
	}
}
```

#### 1.4 Implement Plugin

```typescript
import { BaseProviderPlugin } from "@302ai/studio-plugin-sdk";
import type { Model, ModelProvider } from "@302ai/studio-plugin-sdk";

export default class MyPlugin extends BaseProviderPlugin {
	protected providerId = "my-provider";
	protected providerName = "My Provider";
	protected apiType = "openai";
	protected defaultBaseUrl = "https://api.example.com";
	protected websites = {
		official: "https://example.com",
		apiKey: "https://example.com/api-keys",
		docs: "https://docs.example.com",
		models: "https://docs.example.com/models",
	};

	async onFetchModels(provider: ModelProvider): Promise<Model[]> {
		// Implement model fetching
		return [];
	}
}
```

#### 1.5 Create README.md

Your README should include:

- Plugin description and purpose
- Features list
- Installation instructions
- Configuration guide
- Usage examples
- API reference (if applicable)
- Troubleshooting tips
- License information

### Step 2: Test Your Plugin

#### 2.1 Install Locally

1. Open 302 AI Studio
2. Go to Settings → Plugins
3. Click "Install Plugin"
4. Select "Local Folder"
5. Choose your plugin directory

#### 2.2 Verify Functionality

- [ ] Plugin loads without errors
- [ ] Configuration options work
- [ ] Core functionality works as expected
- [ ] No console errors
- [ ] Performance is acceptable

#### 2.3 Test Edge Cases

- [ ] Invalid configuration
- [ ] Network errors
- [ ] Rate limiting
- [ ] Large datasets
- [ ] Different environments

### Step 3: Prepare for Release

#### 3.1 Create GitHub Repository

```bash
# Initialize git
git init
git add .
git commit -m "feat: initial commit"

# Create repository on GitHub
# Then push
git remote add origin https://github.com/yourusername/your-plugin.git
git branch -M main
git push -u origin main
```

#### 3.2 Build Plugin

If using TypeScript, build your plugin:

```bash
# Using tsup (recommended)
npx tsup main/index.ts --format esm --dts

# Or using tsc
npx tsc
```

#### 3.3 Create Plugin ZIP

Create a ZIP file containing:

```
my-plugin.zip
├── plugin.json
├── main/
│   ├── index.js
│   └── index.d.ts
├── README.md
├── CHANGELOG.md (optional)
└── icon.png (optional)
```

**Important**: Do NOT include:

- `node_modules/`
- Source `.ts` files (include compiled `.js` instead)
- Development files (`.git/`, `.vscode/`, etc.)
- Large binary files

**Command to create ZIP:**

```bash
# Unix/Linux/Mac
zip -r my-plugin.zip plugin.json main/ README.md icon.png -x "*.ts" "node_modules/*"

# Or use a GUI tool
```

#### 3.4 Create GitHub Release

1. Go to your repository on GitHub
2. Click "Releases" → "Create a new release"
3. **Tag**: `v1.0.0` (must match plugin.json version)
4. **Title**: `v1.0.0 - Initial Release`
5. **Description**: Describe changes and features
6. **Attach file**: Upload your `my-plugin.zip`
7. Click "Publish release"

#### 3.5 Get Download URL

After creating the release:

1. Right-click on the ZIP file in the release
2. Copy link address
3. It should look like:
   ```
   https://github.com/yourusername/your-plugin/releases/download/v1.0.0/my-plugin.zip
   ```

### Step 4: Submit to Registry

#### 4.1 Fork the Registry

1. Go to [plugin-registry](https://github.com/302ai/302-AI-Studio-SV/tree/main/packages/plugin-registry)
2. Click "Fork"
3. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/302-AI-Studio-SV.git
   cd 302-AI-Studio-SV/packages/plugin-registry
   ```

#### 4.2 Add Your Plugin

**Option A: Interactive Tool (Recommended)**

```bash
pnpm install
pnpm run add-plugin
```

Follow the prompts to enter your plugin information.

**Option B: Manual Edit**

Edit `registry.json` and add your entry:

```json
{
	"id": "my-awesome-plugin",
	"name": "My Awesome Plugin",
	"description": "A brief description of what your plugin does",
	"author": "Your Name",
	"version": "1.0.0",
	"downloadUrl": "https://github.com/yourusername/your-plugin/releases/download/v1.0.0/my-plugin.zip",
	"repository": "https://github.com/yourusername/your-plugin",
	"homepage": "https://github.com/yourusername/your-plugin",
	"tags": ["ai", "provider", "openai"],
	"icon": "https://raw.githubusercontent.com/yourusername/your-plugin/main/icon.png",
	"readme": "https://raw.githubusercontent.com/yourusername/your-plugin/main/README.md",
	"minSdkVersion": "1.0.0",
	"downloads": 0,
	"rating": 0,
	"ratingCount": 0,
	"featured": false,
	"publishedAt": "2025-10-28T00:00:00.000Z",
	"updatedAt": "2025-10-28T00:00:00.000Z"
}
```

#### 4.3 Validate

```bash
pnpm run validate
```

Fix any errors before proceeding.

#### 4.4 Commit and Push

```bash
git add registry.json
git commit -m "feat: add my-awesome-plugin v1.0.0"
git push origin main
```

#### 4.5 Create Pull Request

1. Go to your fork on GitHub
2. Click "Contribute" → "Open pull request"
3. **Title**: `Add my-awesome-plugin v1.0.0`
4. **Description**:

   ```markdown
   ## Plugin Information

   - **Name**: My Awesome Plugin
   - **Version**: 1.0.0
   - **Type**: Provider Plugin
   - **Repository**: https://github.com/yourusername/your-plugin

   ## Description

   Brief description of what your plugin does and why it's useful.

   ## Checklist

   - [x] Plugin uses @302ai/studio-plugin-sdk v1.0.0+
   - [x] Valid plugin.json included
   - [x] README with instructions
   - [x] Tested in 302 AI Studio
   - [x] HTTPS download URL
   - [x] Validation passed
   ```

5. Click "Create pull request"

### Step 5: Review Process

#### 5.1 Automated Checks

GitHub Actions will automatically:

- Validate JSON syntax
- Check schema compliance
- Verify required fields
- Test download URL

If checks fail, fix the issues and push updates.

#### 5.2 Maintainer Review

Maintainers will review:

- Plugin quality and functionality
- Documentation completeness
- Code safety (no malicious code)
- Compliance with guidelines

#### 5.3 Possible Outcomes

- ✅ **Approved**: PR merged, plugin in registry
- 📝 **Changes Requested**: Address feedback and update PR
- ❌ **Rejected**: Doesn't meet requirements (rare)

## 📊 After Approval

Once your PR is merged:

1. **Installation**: Users can install from Plugin Marketplace
2. **Updates**: Keep your plugin maintained
3. **Support**: Respond to issues in your repository
4. **Analytics**: Monitor downloads and ratings

## 🔄 Updating Your Plugin

When releasing a new version:

1. Update `version` in `plugin.json`
2. Create new GitHub Release with updated ZIP
3. Fork registry again (or pull latest changes)
4. Update your entry in `registry.json`:
   - `version`: new version number
   - `downloadUrl`: new release URL
   - `updatedAt`: current date
   - `changelog`: link to changelog (optional)
5. Submit new PR with title: `Update my-awesome-plugin to v1.1.0`

## ❓ Common Issues

### Download URL Not Working

- Ensure it's the direct ZIP download link
- Must be HTTPS
- Test the URL in a browser

### Validation Fails

- Check JSON syntax (no trailing commas)
- Verify all required fields
- Run `pnpm run validate` locally

### Plugin Doesn't Load

- Check `main` field points to correct file
- Ensure all dependencies are included
- Check for TypeScript compilation errors

## 📚 Resources

- [Plugin SDK Documentation](../plugin-sdk/README.md)
- [Example Plugins](../../plugins/builtin/)
- [API Reference](../plugin-sdk/README.md#api-reference)
- [GitHub Releases Guide](https://docs.github.com/en/repositories/releasing-projects-on-github)

## 💬 Get Help

- 💬 [Discussions](https://github.com/302ai/302-AI-Studio-SV/discussions)
- 🐛 [Report Issue](https://github.com/302ai/302-AI-Studio-SV/issues)
- 📖 [Documentation](https://github.com/302ai/302-AI-Studio-SV)

Good luck with your plugin submission! 🎉
