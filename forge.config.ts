import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerWix } from "@electron-forge/maker-wix";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const rebuildTargets = ["macos-alias", "ds-store", "appdmg"];

let nativePackagingDepsBuilt = false;

const ensureNativePackagingDeps = (platform: NodeJS.Platform = process.platform) => {
	if (nativePackagingDepsBuilt || platform !== "darwin") {
		return;
	}

	const npmExecPath = process.env.npm_execpath;
	const rebuildArgs = ["rebuild", ...rebuildTargets];
	console.info("Rebuilding native macOS packaging dependencies via pnpm rebuild ...");
	const result = npmExecPath
		? spawnSync(process.execPath, [npmExecPath, ...rebuildArgs], {
			stdio: "inherit",
		})
		: spawnSync("pnpm", rebuildArgs, { stdio: "inherit" });

	if (result.status !== 0 || result.error) {
		throw new Error("Failed to rebuild native macOS packaging dependencies required for DMG creation.");
	}

	const macosAliasDir = path.dirname(require.resolve("macos-alias/package.json"));
	const macosAliasBinary = path.join(macosAliasDir, "build", "Release", "volume.node");
	if (!existsSync(macosAliasBinary)) {
		console.info("macos-alias binary missing after pnpm rebuild; running node-gyp rebuild manually...");
		const rebuildMacAlias = npmExecPath
			? spawnSync(
				process.execPath,
				[npmExecPath, "exec", "node-gyp", "rebuild"],
				{ stdio: "inherit", cwd: macosAliasDir },
			)
			: spawnSync("pnpm", ["exec", "node-gyp", "rebuild"], {
				cwd: macosAliasDir,
				stdio: "inherit",
			});

		if (rebuildMacAlias.status !== 0 || rebuildMacAlias.error) {
			throw new Error("Failed to rebuild macos-alias native module.");
		}

		if (!existsSync(macosAliasBinary)) {
			throw new Error(
				"macos-alias native module is still missing after rebuild; check build logs for details.",
			);
		}
	}

	nativePackagingDepsBuilt = true;
};

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
		icon: "static/icon",
		executableName: "302-ai-studio",
	},
	rebuildConfig: {},
	makers: [
		new MakerSquirrel(
			{
				name: "302-ai-studio",
				setupIcon: "static/icon.ico",
				iconUrl: "https://file.302.ai/gpt/playground/20250925/69b7db4b8f154fe7ad9397ba50f827b9.ico",
			},
			["win32"],
		),
		new MakerWix({}),
		new MakerZIP({}, ["darwin", "win32"]),
		new MakerDMG({
			format: "ULFO",
		}),
		new MakerRpm({
			options: {
				icon: "static/icon.png",
			},
		}),
		new MakerDeb({
			options: {
				icon: "static/icon.png",
			},
		}),
	],
	hooks: {
		preMake: async () => {
			ensureNativePackagingDeps();
		},
	},
	publishers: [
		{
			name: "@electron-forge/publisher-github",
			config: {
				repository: {
					owner: "302ai",
					name: "302-AI-Studio-sv",
				},
				prerelease: true,
				draft: false,
			},
		},
	],
	plugins: [
		new VitePlugin({
			// `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
			// If you are familiar with Vite configuration, it will look really familiar.
			build: [
				{
					// `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
					entry: "electron/main/index.ts",
					config: "vite.main.config.ts",
					target: "main",
				},
				{
					entry: "electron/preload/index.ts",
					config: "vite.preload.config.ts",
					target: "preload",
				},
			],
			renderer: [
				{
					name: "main_window",
					config: "vite.config.ts",
				},
			],
		}),
		// Fuses are used to enable/disable various Electron functionality
		// at package time, before code signing the application
		new FusesPlugin({
			version: FuseVersion.V1,
			[FuseV1Options.RunAsNode]: false,
			[FuseV1Options.EnableCookieEncryption]: true,
			[FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
			[FuseV1Options.EnableNodeCliInspectArguments]: false,
			[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
			[FuseV1Options.OnlyLoadAppFromAsar]: true,
		}),
	],
};

export default config;
