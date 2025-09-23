<script lang="ts">
	import { openaiHandler } from "$lib/handlers/chat-handlers";
	import { FChatTransport } from "$lib/transport/f-chat-transport";
	import { Chat } from "@ai-sdk/svelte";

	// 当前选择的handler - 使用 $state
	let selectedHandler = $state("mock");

	// 获取handler函数
	function getHandler() {
		return openaiHandler;
	}

	// 创建chat实例，使用自定义transport
	let chat = $state<Chat | null>(null);
	FChatTransport;
	// 当selectedHandler改变时重新创建chat实例
	$effect(() => {
		chat = new Chat({
			transport: new FChatTransport({
				handler: getHandler(),
				// 自定义headers示例
				headers: {
					"X-Custom-Header": "demo-value",
					"X-Handler-Type": selectedHandler,
				},
				// 自定义body参数示例
				body: {
					temperature: 0.7,
					customParam: "example-value",
				},
			}),
		});
	});

	let input = $state("");

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (input.trim() && chat) {
			chat.sendMessage({ text: input });
			input = "";
		}
	}
</script>

<div class="container mx-auto max-w-4xl p-4">
	<h1 class="mb-6 text-3xl font-bold">AI SDK 自定义协议 Demo</h1>

	<div class="mb-6 rounded-lg border bg-gray-50 p-4">
		<h2 class="mb-4 text-xl font-semibold">选择Handler类型</h2>
		<div class="flex flex-wrap gap-2">
			<label class="flex items-center">
				<input type="radio" bind:group={selectedHandler} value="mock" class="mr-2" />
				模拟Handler (测试用)
			</label>
			<label class="flex items-center">
				<input type="radio" bind:group={selectedHandler} value="openai" class="mr-2" />
				OpenAI GPT-4o
			</label>
			<label class="flex items-center">
				<input type="radio" bind:group={selectedHandler} value="gpt35" class="mr-2" />
				OpenAI GPT-3.5
			</label>
			<label class="flex items-center">
				<input type="radio" bind:group={selectedHandler} value="tools" class="mr-2" />
				带工具的Handler
			</label>
			<label class="flex items-center">
				<input type="radio" bind:group={selectedHandler} value="customParams" class="mr-2" />
				自定义参数Handler
			</label>
		</div>
	</div>

	<div class="mb-6 rounded-lg border bg-blue-50 p-4">
		<h3 class="mb-2 font-semibold">当前配置:</h3>
		<p><strong>Handler:</strong> {selectedHandler}</p>
		<p><strong>自定义Headers:</strong> X-Custom-Header, X-Handler-Type</p>
		<p><strong>自定义Body参数:</strong> temperature: 0.7, customParam: 'example-value'</p>
	</div>

	<div class="flex h-[600px] flex-col border rounded-lg">
		<!-- 消息列表 -->
		<div class="flex-1 overflow-y-auto p-4">
			{#if chat}
				{#each chat.messages as message, messageIndex (messageIndex)}
					<div class="mb-4 {message.role === 'user' ? 'text-right' : 'text-left'}">
						<div
							class="inline-block max-w-[80%] rounded-lg p-3 {message.role === 'user'
								? 'bg-blue-500 text-white'
								: 'bg-gray-200 text-gray-800'}"
						>
							<div class="mb-1 text-xs opacity-70">
								{message.role} - {new Date().toLocaleTimeString()}
							</div>
							{#each message.parts as part, partIndex (partIndex)}
								{#if part.type === "text"}
									<div class="whitespace-pre-wrap">{part.text}</div>
								{:else if part.type === "tool-weather"}
									<div class="mt-2 rounded bg-yellow-100 p-2 text-sm text-gray-800">
										<strong>天气工具调用:</strong>
										<pre class="mt-1 text-xs">{JSON.stringify(part, null, 2)}</pre>
									</div>
								{:else if part.type === "tool-convertFahrenheitToCelsius"}
									<div class="mt-2 rounded bg-green-100 p-2 text-sm text-gray-800">
										<strong>温度转换工具调用:</strong>
										<pre class="mt-1 text-xs">{JSON.stringify(part, null, 2)}</pre>
									</div>
								{/if}
							{/each}
						</div>
					</div>
				{/each}

				{#if chat.status === "streaming" || chat.status === "submitted"}
					<div class="text-left">
						<div class="inline-block rounded-lg bg-gray-200 p-3">
							<div class="animate-pulse">AI正在思考中... (状态: {chat.status})</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="flex items-center justify-center p-8 text-gray-500">正在初始化Chat实例...</div>
			{/if}
		</div>

		<!-- 输入框 -->
		<div class="border-t p-4">
			<form onsubmit={handleSubmit} class="flex gap-2">
				<input
					bind:value={input}
					type="text"
					placeholder="输入消息..."
					class="flex-1 rounded-lg border px-3 py-2 focus:border-blue-500 focus:outline-none"
				/>
				<button
					type="submit"
					disabled={!input.trim() ||
						!chat ||
						chat.status === "streaming" ||
						chat.status === "submitted"}
					class="rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-300"
				>
					发送
				</button>
			</form>
		</div>
	</div>

	<div class="mt-6 rounded-lg border bg-gray-50 p-4">
		<h3 class="mb-2 font-semibold">使用说明:</h3>
		<ul class="list-disc space-y-1 pl-5 text-sm">
			<li><strong>模拟Handler:</strong> 使用本地模拟，无需API密钥，用于测试协议功能</li>
			<li><strong>OpenAI Handlers:</strong> 需要设置OPENAI_API_KEY环境变量</li>
			<li><strong>带工具的Handler:</strong> 展示工具调用功能，试试问"北京的天气怎么样？"</li>
			<li><strong>自定义参数Handler:</strong> 展示如何传递自定义参数给handler</li>
		</ul>

		<div class="mt-4">
			<h4 class="mb-2 font-semibold">协议特点:</h4>
			<ul class="list-disc space-y-1 pl-5 text-sm">
				<li>✅ 完全在renderer层运行，无需HTTP服务器</li>
				<li>✅ 可配置的handler函数，类似HTTP transport的fetch参数</li>
				<li>✅ 支持自定义headers和body参数</li>
				<li>✅ 支持预处理函数customizerequest</li>
				<li>✅ 兼容AI SDK的所有功能（流式响应、工具调用等）</li>
			</ul>
		</div>
	</div>
</div>
