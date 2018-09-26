browser.browserAction.onClicked.addListener(openOptionsPage);

browser.runtime.onMessage.addListener((msg, info) => {
	if (typeof msg === 'object' && msg !== null) {
		switch (msg.type) {
			case 'options':
				return openOptionsPage();
		}
	}
	console.log('Background script received:', msg, info);
});

function openOptionsPage() {
	browser.runtime.openOptionsPage();
}
