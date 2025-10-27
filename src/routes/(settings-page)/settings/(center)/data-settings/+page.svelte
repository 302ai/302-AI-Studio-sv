<script lang="ts">
	import DataBackup from "./data-backup.svelte";
	import DataExport from "./data-export.svelte";
	import DataImport from "./data-import.svelte";
	import DataReset from "./data-reset.svelte";
	import VersionInfo from "./version-info.svelte";
</script>

<DataExport />

<DataImport />

<DataBackup />

<DataReset />

<VersionInfo />
