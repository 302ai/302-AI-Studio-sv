const weixinChannelState = $state({
	isInstalled: async () => await window.electronAPI.openClawService.wechatInsalled(),
	loading: false,
	error: false,
	install: async () => {
		try {
			weixinChannelState.loading = true;
			const success = await window.electronAPI.openClawService.installWechat();
			weixinChannelState.error = !success;
		} catch (_e) {
			weixinChannelState.error = true;
		} finally {
			weixinChannelState.loading = false;
		}
		return !weixinChannelState.error;
	},
});

export default weixinChannelState;
