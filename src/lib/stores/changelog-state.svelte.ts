import { appInfo } from "$lib/app-info";
import { createLogger } from "@shared/logger";

const logger = createLogger("state");
import {
	fetchChangelog,
	fetchLatestChangelog,
	type ChangelogResponse,
	type ChangelogVersion,
} from "$lib/api/changelog";
import semver from "semver";

/**
 * Changelog state management using Svelte 5 runes
 */
class ChangelogState {
	/** All changelog versions */
	versions = $state<ChangelogVersion[]>([]);

	/** Latest changelog version */
	latestVersion = $state<ChangelogVersion | null>(null);

	/** Loading state for the list */
	loading = $state(false);

	/** Loading state for latest version */
	loadingLatest = $state(false);

	/** Error message if any */
	error = $state<string | null>(null);

	/** Total count of versions available */
	total = $state(0);

	/** Current app version */
	get currentVersion(): string {
		return appInfo.version;
	}

	/** Check if there's a newer version available */
	hasNewerVersion = $derived(() => {
		if (!this.latestVersion) return false;
		try {
			// Clean version strings for comparison (remove 'v' prefix if present)
			const latest = this.latestVersion.version.replace(/^v/, "");
			const current = this.currentVersion.replace(/^v/, "");
			return semver.gt(latest, current);
		} catch {
			// If semver comparison fails, do string comparison
			return this.latestVersion.version !== this.currentVersion;
		}
	});

	/** Check if a version matches the current app version */
	isCurrentVersion(version: string): boolean {
		try {
			const v = version.replace(/^v/, "");
			const current = this.currentVersion.replace(/^v/, "");
			return semver.eq(v, current);
		} catch {
			return version === this.currentVersion;
		}
	}

	/**
	 * Fetch changelog with optional limit
	 * @param limit - Number of versions to fetch
	 */
	async fetchList(limit?: number): Promise<void> {
		this.loading = true;
		this.error = null;

		try {
			const response: ChangelogResponse = await fetchChangelog({ limit });
			this.versions = response.versions;
			this.total = response.total;
		} catch (err) {
			this.error = err instanceof Error ? err.message : "Failed to fetch changelog";
			this.versions = [];
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Fetch the latest changelog version
	 */
	async fetchLatest(): Promise<void> {
		this.loadingLatest = true;

		try {
			const latest = await fetchLatestChangelog();
			this.latestVersion = latest;
		} catch (err) {
			logger.error("Failed to fetch latest changelog:", err);
			this.latestVersion = null;
		} finally {
			this.loadingLatest = false;
		}
	}

	/**
	 * Fetch all changelog versions
	 */
	async fetchAll(): Promise<void> {
		return this.fetchList();
	}

	/**
	 * Reset the state
	 */
	reset(): void {
		this.versions = [];
		this.latestVersion = null;
		this.loading = false;
		this.loadingLatest = false;
		this.error = null;
		this.total = 0;
	}
}

export const changelogState = new ChangelogState();
