module.exports = {
	build: {
		overwriteDest: true,
	},
	ignoreFiles: [
		'package.json',
		'package-lock.json',
		'README.md',
		'tsconfig.json',
		'web-ext-config.js',
		'*.ts',
	],
	lint: { selfHosted: true },
	run: {
		browserConsole: true,
		pref: ['browser.link.open_newwindow=3'],
		startUrl: ['https://eproc.jfsc.jus.br/eprocV2/'],
	},
};
