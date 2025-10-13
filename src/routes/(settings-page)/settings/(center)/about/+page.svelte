<script lang="ts">
	import { appInfo } from "$lib/app-info";
	import DiscordIcon from "$lib/assets/icons/social-medias/discord.svg";
	import GithubIcon from "$lib/assets/icons/social-medias/github.svg";
	import TwitterIcon from "$lib/assets/icons/social-medias/twitter.svg";
	import { ModelIcon } from "$lib/components/buss/model-icon/index.js";
	import * as Avatar from "$lib/components/ui/avatar";
	import { Button } from "$lib/components/ui/button/index.js";
	import { m } from "$lib/paraglide/messages";

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
			name: m.title_help_center(),
			action: () => {},
		},
		{
			id: 2,
			name: m.title_terms_of_service(),
			action: () => {},
		},
		{
			id: 3,
			name: m.title_privacy_policy(),
			action: () => {},
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
				<a href={appInfo.homepage} target="_blank" class="text-sm text-primary hover:underline">
					{appInfo.homepage}
				</a>
			</p>
		</div>
	</div>

	<div class="flex items-center gap-4">
		<div class="flex items-center gap-4">
			{#each socialMedias as item (item.name)}
				<Button
					size="icon-sm"
					class="hover:bg-transparent size-7"
					variant="ghost"
					onclick={item.action}
				>
					<Avatar.Root class="rounded-md size-full">
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
						class="text-muted-foreground fit-content p-0 text-sm hover:bg-transparent dark:hover:bg-transparent"
					>
						{item.name}
					</Button>
				</div>
			{/each}
		</div>
	</div>
</div>
