/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const rebuildTargets = ["macos-alias", "fs-xattr", "ds-store", "appdmg"];

const nativeBinaryChecks = [
	{
		moduleName: "macos-alias",
		binaryRelPath: "build/Release/volume.node",
	},
	{
		moduleName: "fs-xattr",
		binaryRelPath: "build/Release/xattr.node",
	},
];

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
		throw new Error(
			"Failed to rebuild native macOS packaging dependencies required for DMG creation.",
		);
	}

	for (const { moduleName, binaryRelPath } of nativeBinaryChecks) {
		let moduleDir: string | undefined;
		try {
			moduleDir = path.dirname(require.resolve(`${moduleName}/package.json`));
		} catch (_error) {
			// Optional dependency not installed (non-darwin platforms). Skip.
			continue;
		}

		const binaryPath = path.join(moduleDir, binaryRelPath);
		if (existsSync(binaryPath)) {
			continue;
		}

		console.info(
			`${moduleName} binary missing after pnpm rebuild; running node-gyp rebuild manually...`,
		);
		const rebuildResult = npmExecPath
			? spawnSync(process.execPath, [npmExecPath, "exec", "node-gyp", "rebuild"], {
					stdio: "inherit",
					cwd: moduleDir,
				})
			: spawnSync("pnpm", ["exec", "node-gyp", "rebuild"], {
					cwd: moduleDir,
					stdio: "inherit",
				});

		if (rebuildResult.status !== 0 || rebuildResult.error) {
			throw new Error(`Failed to rebuild ${moduleName} native module.`);
		}

		if (!existsSync(binaryPath)) {
			throw new Error(
				`${moduleName} native module is still missing after rebuild; check build logs for details.`,
			);
		}
	}

	nativePackagingDepsBuilt = true;
};

// 构建 packagerConfig 的函数
const getPackagerConfig = () => {
	const baseConfig = {
		asar: true,
		icon: "static/icon",
		executableName: "302 AI Studio",
		appBundleId: "com.302ai.302aistudio",
	};

	if (process.platform === "darwin" && process.env.NODE_ENV === "production") {
		const macConfig: any = {
			...baseConfig,
			osxSign: {
				identity: "Developer ID Application: SONIER PTE. LTD.",
				"hardened-runtime": true,
				"gatekeeper-assess": false,
				entitlements: "entitlements.plist",
				"entitlements-inherit": "entitlements.plist",
			},
		};

		macConfig.osxNotarize = {
			appleId: process.env.APPLE_ID,
			appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
			teamId: process.env.APPLE_TEAM_ID,
		};

		return macConfig;
	}

	return baseConfig;
};

const config: ForgeConfig = {
	packagerConfig: getPackagerConfig(),
	rebuildConfig: {},
	makers: [
		new MakerSquirrel(
			{
				name: "302.AI.Studio",
				setupIcon: "static/icon.ico",
				iconUrl: "https://file.302.ai/gpt/playground/20250925/69b7db4b8f154fe7ad9397ba50f827b9.ico",
				loadingGif: "static/icon.gif",
			},
			["win32"],
		),
		{
			name: "@felixrieseberg/electron-forge-maker-nsis",
			config: {
				name: "302.AI.Studio",
				executableName: "302 AI Studio",
				artifactName: "${name}.Setup.${version}.${ext}",
				updater: {
					url: "https://github.com/302ai/302-AI-Studio/releases/latest/download",
				},
			},
		},
		new MakerZIP({}, ["darwin", "win32"]),
		new MakerDMG({
			icon: "static/icon.png",
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
