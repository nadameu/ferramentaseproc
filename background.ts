browser.browserAction.onClicked.addListener(openOptionsPage);

function openOptionsPage() {
	browser.runtime.openOptionsPage();
}
