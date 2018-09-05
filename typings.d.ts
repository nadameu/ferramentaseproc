interface Window {
	wrappedJSObject: UnsafeWindow;
}

interface UnsafeWindow extends Window {
	FeP: {
		complementoInstalado: boolean;
		numeroVersaoCompativel: string;
		versaoUsuarioCompativel: boolean;
	};
	analisarDocs(): void;
	documentosAbertos: { [key: string]: Window };
}
