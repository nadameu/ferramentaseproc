interface Window {
	wrappedJSObject: UnsafeWindow;
}

interface UnsafeWindow extends Window {
	FeP: FerramentasEProc;
	analisarDocs(): void;
	documentosAbertos: { [key: string]: Window };
}

interface FerramentasEProc {
	complementoInstalado: boolean;
	numeroVersaoCompativel: string;
	versaoUsuarioCompativel: boolean;
}
