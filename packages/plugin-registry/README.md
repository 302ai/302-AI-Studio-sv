# 302 AI Studio Plugin Registry

Official plugin registry for [302 AI Studio](https://github.com/302ai/302-AI-Studio-SV).

This registry maintains a curated list of community plugins that extend 302 AI Studio's capabilities.

## 📦 Available Plugins

Browse all available plugins in [`registry.json`](./registry.json).

To install plugins from this registry, use the Plugin Marketplace in 302 AI Studio:

1. Open 302 AI Studio
2. Go to Settings → Plugins
3. Click on the "Marketplace" tab
4. Search and install plugins

## 🚀 Submit Your Plugin

Want to share your plugin with the community? Follow these steps:

1. Read the [Submission Guide](./SUBMISSION_GUIDE.md)
2. Develop your plugin using the [Plugin SDK](https://github.com/302ai/302-AI-Studio-SV/tree/main/packages/plugin-sdk)
3. Create a GitHub release with your plugin ZIP file
4. Fork this repository
5. Add your plugin to `registry.json` (or use `pnpm run add-plugin`)
6. Run validation: `pnpm run validate`
7. Submit a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed contribution guidelines.

## 📋 Plugin Requirements

To be included in the registry, your plugin must:

- ✅ Be built using `@302ai/studio-plugin-sdk` v1.0.0 or later
- ✅ Include a valid `plugin.json` with complete metadata
- ✅ Have a public GitHub repository
- ✅ Provide a README with usage instructions
- ✅ Be distributed as a ZIP file via GitHub Releases
- ✅ Use HTTPS for all download URLs
- ✅ Follow semantic versioning
- ✅ Include appropriate tags for discoverability

## 🔧 Registry Structure

```json
{
	"version": "1.0.0",
	"lastUpdated": "2025-10-28T00:00:00.000Z",
	"plugins": [
		{
			"id": "my-awesome-plugin",
			"name": "My Awesome Plugin",
			"description": "A brief description",
			"author": "Your Name",
			"version": "1.0.0",
			"downloadUrl": "https://github.com/user/plugin/releases/download/v1.0.0/plugin.zip",
			"repository": "https://github.com/user/plugin",
			"tags": ["provider", "ai"],
			"minSdkVersion": "1.0.0"
		}
	]
}
```

See [`schema.json`](./schema.json) for the complete schema definition.

## 🛠️ Development Tools

### Validate Registry

```bash
pnpm run validate
```

Validates `registry.json` against the schema and checks for:

- Valid JSON syntax
- Required fields
- Unique plugin IDs
- Valid semver versions
- HTTPS URLs
- Proper date formats

### Add Plugin Interactively

```bash
pnpm run add-plugin
```

Interactive CLI tool to add a new plugin entry to the registry.

## 📊 Registry Stats

- **Total Plugins**: See [`registry.json`](./registry.json)
- **Schema Version**: 1.0.0
- **Last Updated**: Check the `lastUpdated` field in registry.json

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see the main [302 AI Studio repository](https://github.com/302ai/302-AI-Studio-SV) for details.

## 🔗 Links

- [302 AI Studio](https://github.com/302ai/302-AI-Studio-SV)
- [Plugin SDK Documentation](https://github.com/302ai/302-AI-Studio-SV/tree/main/packages/plugin-sdk)
- [Plugin Development Guide](https://github.com/302ai/302-AI-Studio-SV/blob/main/docs/plugin-development-guide.md)
- [Submit an Issue](https://github.com/302ai/302-AI-Studio-SV/issues)

## 📮 Support

If you have questions or need help:

- 📖 Read the [Submission Guide](./SUBMISSION_GUIDE.md)
- 💬 Open a [Discussion](https://github.com/302ai/302-AI-Studio-SV/discussions)
- 🐛 Report issues in the [main repository](https://github.com/302ai/302-AI-Studio-SV/issues)
