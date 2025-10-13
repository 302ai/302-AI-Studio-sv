<script lang="ts">
	import { appInfo } from "$lib/app-info";
	import DiscordIcon from "$lib/assets/icons/social-medias/discord.svg";
	import GithubIcon from "$lib/assets/icons/social-medias/github.svg";
	import TwitterIcon from "$lib/assets/icons/social-medias/twitter.svg";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import * as Avatar from "$lib/components/ui/avatar";
	import { Button } from "$lib/components/ui/button/index.js";
	import { m } from "$lib/paraglide/messages";

	const { openExternalLink } = window.electronAPI.externalLinkService;

	const socialMedias = [
		{
			name: "Github",
			icon: GithubIcon,
			action: () => openExternalLink("https://github.com/302ai"),
		},
		{
			name: "Twitter",
			icon: TwitterIcon,
			action: () => openExternalLink("https://x.com/302aiofficial"),
		},
		{
			name: "Discord",
			icon: DiscordIcon,
			action: () => openExternalLink("https://discord.com/invite/4fgQ4M6ypq"),
		},
	] as const;

	const footerLinks = [
		{
			id: 1,
			name: m.title_help_center(),
			action: () => openExternalLink("https://help.302.ai/"),
		},
		{
			id: 2,
			name: m.title_terms_of_service(),
			action: () => openExternalLink("https://302.ai/terms/"),
		},
		{
			id: 3,
			name: m.title_privacy_policy(),
			action: () => openExternalLink("https://302.ai/privacy/"),
		},
	] as const;
</script>

<div class="mx-auto flex h-full flex-col items-center">
	<div class="flex flex-1 items-center justify-center">
		<div class="flex items-center gap-y-[22px] flex-col">
			<ModelIcon modelName="ai302" className="size-[62px]" />
			<div class="flex items-center gap-y-2 flex-col">
				<h1 class="text-xl">{appInfo.productName}</h1>
				<p class="text-muted-foreground text-sm">{m.title_version()} {appInfo.version}</p>
			</div>
			<p class="mx-auto text-center text-muted-foreground text-sm leading-relaxed">
				{m.app_description()}
				<a
					href={appInfo.homepage}
					target="_blank"
					class="text-sm text-primary hover:underline"
					onclick={(e) => {
						e.preventDefault();
						openExternalLink(appInfo.homepage);
					}}
				>
					{appInfo.homepage}
				</a>
			</p>
		</div>
	</div>

	<div class="flex items-center gap-4">
		<div class="flex items-center gap-2">
			{#each socialMedias as item (item.name)}
				<Button
					size="icon-sm"
					class="hover:bg-secondary dark:hover:bg-secondary size-8"
					variant="ghost"
					onclick={item.action}
				>
					<Avatar.Root class="rounded-sm size-6">
						<Avatar.Image src={item.icon} alt={item.name} />
					</Avatar.Root>
				</Button>
			{/each}
		</div>
		<div class="flex items-center gap-x-4">
			{#each footerLinks as item (item.name)}
				<div class="flex items-center gap-x-4">
					<Button
						variant="ghost"
						onclick={item.action}
						class="text-muted-foreground fit-content p-0 text-sm font-normal hover:bg-transparent dark:hover:bg-transparent"
					>
						{item.name}
					</Button>
				</div>
			{/each}
		</div>
	</div>
</div>
