module.exports = {
	ignoreFiles: [
		'jsconfig.json',
		'package.json',
		'package-lock.json',
		'README.md',
		'web-ext-config.js',
	],
	lint: { selfHosted: true },
	run: {
		browserConsole: true,
		pref: ['browser.link.open_newwindow=3'],
		startUrl: ['https://eproc.jfsc.jus.br/eprocV2/'],
	},
};
