<script lang="ts">
	import { appInfo } from "$lib/app-info";
	import DiscordIcon from "$lib/assets/icons/social-medias/discord.svg";
	import GithubIcon from "$lib/assets/icons/social-medias/github.svg";
	import TwitterIcon from "$lib/assets/icons/social-medias/twitter.svg";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { m } from "$lib/paraglide/messages";
	import { cn } from "$lib/utils.js";

	const socialMedias = [
		{
			name: "Github",
			icon: GithubIcon,
			action: () => {},
		},
		{
			name: "Twitter",
			icon: TwitterIcon,
			action: () => {},
		},
		{
			name: "Discord",
			icon: DiscordIcon,
			action: () => {},
		},
	] as const;

	const footerLinks = [
		{
			id: 1,
			name: "Help Center",
			action: () => {},
		},
		{
			id: 2,
			name: "Terms of Service",
			action: () => {},
		},
		{
			id: 3,
			name: "Privacy Policy",
			action: () => {},
		},
	] as const;
</script>

<div class="mx-auto flex h-full flex-1 flex-col items-center justify-between">
	<div class="flex items-center gap-2 flex-col">
		<ModelIcon modelName="ai302" className="size-[62px]" />
		<h1 class="text-xl">{appInfo.productName}</h1>
		<p class="text-muted-foreground text-sm">{m.title_version()} {appInfo.version}</p>
	</div>

	<div class="flex items-center gap-4">
		<div class="flex items-center gap-4">
			{#each socialMedias as item (item.name)}
				<Button class="size-7 hover:bg-transparent" variant="ghost" onclick={item.action}>
					<img src={item.icon} alt={item.name} class="h-5 w-5" />
				</Button>
			{/each}
		</div>
		<div class="flex items-center gap-x-4">
			{#each footerLinks as item, index (item.name)}
				<div class="flex items-center gap-x-4">
					<button onclick={item.action} class="cursor-pointer text-muted-fg text-sm hover:text-fg">
						{item.name}
					</button>
					<Separator
						orientation="vertical"
						class={cn("h-5 w-0.5 bg-muted-fg", {
							"opacity-0": index === footerLinks.length - 1,
						})}
					/>
				</div>
			{/each}
		</div>
	</div>
</div>
