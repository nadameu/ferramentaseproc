Array.from(document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')).forEach(
	checkbox => {
		const key = checkbox.id;
		browser.storage.local.get({ [key]: true }).then(obj => {
			checkbox.checked = obj[key];
			checkbox.addEventListener('change', () => {
				browser.storage.local.set({ [key]: checkbox.checked });
			});
		});
	}
);
browser.storage.onChanged.addListener((changes, areaName) => {
	if (areaName !== 'local') return;
	const changed = Object.keys(changes);
	changed.forEach(id => {
		const checkbox = document.getElementById(id) as HTMLInputElement | null;
		if (!checkbox) return;
		const property = (changes as any)[id] as browser.storage.StorageChange;
		if (property.newValue !== property.oldValue) checkbox.checked = property.newValue;
	});
});
