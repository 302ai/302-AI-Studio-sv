# Contributing to Plugin Registry

Thank you for your interest in contributing to the 302 AI Studio Plugin Registry!

## 📌 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How to Contribute](#how-to-contribute)
- [Submission Process](#submission-process)
- [Quality Standards](#quality-standards)
- [Review Process](#review-process)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## How to Contribute

There are several ways to contribute:

1. **Submit a Plugin** - Share your plugin with the community
2. **Update Plugin Information** - Keep plugin metadata current
3. **Report Issues** - Help us identify broken links or outdated information
4. **Improve Documentation** - Enhance guides and examples

## Submission Process

### 1. Prepare Your Plugin

Before submitting, ensure your plugin:

- [ ] Uses `@302ai/studio-plugin-sdk` v1.0.0 or later
- [ ] Has a valid `plugin.json` file
- [ ] Includes comprehensive README.md
- [ ] Follows [semantic versioning](https://semver.org/)
- [ ] Has been tested in 302 AI Studio
- [ ] Is hosted on GitHub with a public repository

### 2. Create a Release

1. Create a GitHub Release in your plugin repository
2. Tag the release with your version (e.g., `v1.0.0`)
3. Build your plugin and create a ZIP file containing:
   ```
   plugin.zip
   ├── plugin.json
   ├── main/
   │   └── index.js (or .ts)
   ├── README.md
   └── (other necessary files)
   ```
4. Upload the ZIP file to the GitHub Release
5. Get the direct download URL (should be HTTPS)

### 3. Fork and Add Entry

1. Fork this repository
2. Clone your fork locally
3. Add your plugin entry to `registry.json`:

   **Option A: Manual**

   ```bash
   # Edit registry.json directly
   vim registry.json
   ```

   **Option B: Interactive (Recommended)**

   ```bash
   # Use the helper script
   pnpm run add-plugin
   ```

4. Validate your changes:
   ```bash
   pnpm run validate
   ```

### 4. Submit Pull Request

1. Commit your changes with a clear message:

   ```bash
   git add registry.json
   git commit -m "feat: add my-awesome-plugin v1.0.0"
   ```

2. Push to your fork:

   ```bash
   git push origin main
   ```

3. Create a Pull Request with:
   - **Title**: `Add [plugin-name] v[version]`
   - **Description**: Brief description of your plugin and what it does
   - **Checklist**: Confirm all requirements are met

## Quality Standards

### Plugin Requirements

Your plugin submission must meet these standards:

#### Required

- ✅ Valid `plugin.json` with all required fields
- ✅ Working download URL (HTTPS only)
- ✅ Public GitHub repository
- ✅ README with installation and usage instructions
- ✅ Valid semantic version number
- ✅ Proper plugin ID (lowercase, alphanumeric, hyphens only)

#### Recommended

- 🌟 Plugin icon (PNG/SVG, recommended 256x256px)
- 🌟 Screenshots demonstrating functionality
- 🌟 CHANGELOG.md documenting version history
- 🌟 Comprehensive tags for discoverability
- 🌟 Minimum SDK version specified
- 🌟 Examples and documentation

### Code Quality

While we don't review plugin source code in detail for registry submission, we expect:

- Working functionality (no obvious bugs)
- Reasonable performance
- Respect for user privacy
- No malicious behavior
- Proper error handling

## Review Process

### Timeline

- **Initial Review**: Within 3-5 business days
- **Feedback Response**: Please respond within 7 days
- **Final Decision**: Typically within 1-2 weeks

### Review Criteria

Reviewers will check:

1. **Completeness**
   - All required fields present
   - Valid and accessible URLs
   - Proper formatting

2. **Functionality**
   - Plugin installs correctly
   - Basic functionality works
   - No critical bugs

3. **Documentation**
   - Clear description
   - Installation instructions
   - Usage examples

4. **Compliance**
   - Follows SDK guidelines
   - Meets quality standards
   - Appropriate tags

### Possible Outcomes

- ✅ **Approved** - Plugin added to registry
- 📝 **Changes Requested** - Minor fixes needed
- ❌ **Rejected** - Does not meet requirements (with explanation)

## Updating Existing Plugins

To update your plugin's information:

1. Fork the repository
2. Update your plugin entry in `registry.json`
3. Update `version` and `updatedAt` fields
4. Run validation: `pnpm run validate`
5. Submit PR with title: `Update [plugin-name] to v[new-version]`

**Note**: The `downloads`, `rating`, and `ratingCount` fields are managed by maintainers. Don't modify these unless correcting an error.

## Removing Your Plugin

To remove your plugin from the registry:

1. Open an issue explaining the reason
2. Maintainers will remove the entry
3. Alternatively, submit a PR removing your entry

## Questions?

- 📖 Check the [Submission Guide](./SUBMISSION_GUIDE.md)
- 💬 Start a [Discussion](https://github.com/302ai/302-AI-Studio-SV/discussions)
- 📧 Contact maintainers (see main repository)

## Recognition

All contributors will be acknowledged in the main 302 AI Studio repository. Thank you for helping grow the plugin ecosystem!
