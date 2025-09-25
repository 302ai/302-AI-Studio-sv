import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";
import { FuseV1Options, FuseVersion } from "@electron/fuses";

const config: ForgeConfig = {
	packagerConfig: {
		asar: true,
		icon: "static/icon",
		executableName: "302-ai-studio",
	},
	rebuildConfig: {},
	makers: [
		new MakerSquirrel({
			name: "302-ai-studio",
			setupIcon: "static/icon.ico",
			iconUrl: "static/icon.ico",
		}),
		new MakerZIP({}, ["darwin"]),
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
