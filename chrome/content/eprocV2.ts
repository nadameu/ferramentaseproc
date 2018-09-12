function $<T extends Element>(selector: string, baseElement: NodeSelector = document) {
	return baseElement.querySelector<T>(selector);
}

function $$<T extends Element>(selector: string, baseElement: NodeSelector = document) {
	const elements = baseElement.querySelectorAll<T>(selector);
	return Array.from(elements);
}

class CheckBox {
	getLabel: () => HTMLLabelElement;
	vincularElementoClasse: (elemento: Element, classe: string) => void;
	constructor(nomePreferencia: string, texto: string) {
		const checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		const promise = browser.storage.local
			.get()
			.then(obj => obj[nomePreferencia])
			.then(checked => (checked === undefined ? false : checked))
			.then(checked => {
				checkbox.checked = checked;
			})
			.catch(e => console.error(e));
		const label = document.createElement('label');
		label.className = 'infraLabel noprint';
		label.appendChild(checkbox);
		label.appendChild(document.createTextNode(` ${texto}`));
		this.getLabel = () => label;
		this.vincularElementoClasse = (elemento, classe) => {
			const alterarClasse = (selecionado: boolean) => {
				const operacao = selecionado ? 'add' : 'remove';
				elemento.classList[operacao](classe);
			};
			checkbox.addEventListener('change', () => {
				const selecionado = checkbox.checked;
				browser.storage.local
					.set({
						[nomePreferencia]: selecionado,
					})
					.catch(e => console.error(e));
				alterarClasse(selecionado);
			});
			promise.then(() => alterarClasse(checkbox.checked));
		};
	}
}

const Gedpro = (() => {
	interface Visitor {
		visit(node: GedproNode): void;
		visitDoc(doc: GedproDoc): void;
		visitNode(node: GedproNode): void;
		visitNodes(nodes: GedproNodes): void;
	}
	class GedproNodes extends Array<GedproNode> {
		constructor(doc: XMLDocument) {
			super();
			$$('reg', doc).forEach(reg => {
				this.push(GedproNode.fromReg(reg));
			});
		}

		accept(visitor: Visitor) {
			visitor.visitNodes(this);
			this.forEach(node => visitor.visit(node));
		}
	}

	class GedproIcones extends Array<GedproIcone> {
		constructor(str: string) {
			super();
			for (let i = 0; i < str.length; i += 3) {
				this.push(new GedproIcone(str.substr(i, 3)));
			}
		}
	}

	class GedproIcone {
		static ARQUIVOS = new Map<string, string>([
			['iWO', 'Word'],
			['iPO', 'Papiro'],
			['PDF', 'pdfgedpro'],
			['iPF', 'PastaAberta'],
			['iL+', 'L-'],
			['iT+', 'T-'],
			['iL0', 'L'],
			['iT0', 'T'],
			['i00', 'Vazio'],
			['iI0', 'I'],
			['0', 'documento'], // Em edição
			['1', 'chave'], // Bloqueado
			['2', 'valida'], // Pronto para assinar
			['3', 'assinatura'], // Assinado
			['4', 'fase'], // Movimentado
			['5', 'procedimentos'], // Devolvido
			['6', 'localizador'], // Arquivado
			['7', 'excluidos'], // Anulado
			['8', 'abrirbloco'], // Conferido
		]);

		readonly arquivo: string = 'Vazio';
		constructor(str: string) {
			if (GedproIcone.ARQUIVOS.has(str)) {
				this.arquivo = GedproIcone.ARQUIVOS.get(str) as string;
			}
		}

		toImg() {
			const img = document.createElement('img');
			img.className = 'extraGedproImg';
			img.src = `http://${Gedpro.host}/images/${this.arquivo}.gif`;
			return img;
		}
	}

	class GedproNode {
		icones: GedproIcones = new GedproIcones('');
		rotulo: string = '';
		constructor(reg: Element) {
			if (reg === undefined) return;
			const icones = reg.getAttribute('icones');
			if (icones === null) return;
			this.icones = new GedproIcones(icones);
		}

		accept(visitor: Visitor) {
			visitor.visitNode(this);
		}

		static fromReg(reg: Element): GedproNode {
			switch (reg.getAttribute('codigoTipoNodo')) {
				case '-1':
					return new GedproDocComposto(reg);

				case '0':
					return new GedproProcesso(reg);

				case '1':
					return new GedproIncidente(reg);

				case '2':
					return new GedproDoc(reg);

				default:
					throw new Error(`Tipo de nó desconhecido: ${reg.getAttribute('codigoTipoNodo')}.`);
			}
		}
	}

	class GedproDoc extends GedproNode {
		maiorAcesso: number;
		codigo: string;
		status: string;
		statusIcone: GedproIcone;
		data: string;
		criador: string;
		dataCriacao: string;
		versao: string;
		editor: string;
		dataVersao: string;
		static STATUSES = new Map([
			['0', 'Em edição'],
			['1', 'Bloqueado'],
			['2', 'Pronto para assinar'],
			['3', 'Assinado'],
			['4', 'Movimentado'],
			['5', 'Devolvido'],
			['6', 'Arquivado'],
			['7', 'Anulado'],
			['8', 'Conferido'],
			['9', 'Para conferir'],
		]);

		constructor(reg: Element) {
			super(reg);
			this.rotulo = reg.getAttribute('nomeTipoDocumentoExibicao');
			this.maiorAcesso = Number(reg.getAttribute('MaiorAcesso'));
			this.codigo = reg.getAttribute('codigoDocumento');
			const statusDocumento = reg.getAttribute('statusDocumento');
			this.status = GedproDoc.STATUSES.get(statusDocumento);
			this.statusIcone = new GedproIcone(statusDocumento);
			this.data = reg.getAttribute('dataDocumento');
			this.criador = reg.getAttribute('siglaCriador');
			this.dataCriacao = reg.getAttribute('dataCriacao');
			this.versao = reg.getAttribute('numeroVersaoDocumento');
			this.editor = reg.getAttribute('siglaEditor');
			this.dataVersao = reg.getAttribute('dataHoraEdicao');
		}

		accept(visitor: Visitor) {
			visitor.visitDoc(this);
		}
		getClasse() {
			if (this.maiorAcesso >= 8) {
				return 'extraGedproRotuloGreen';
			} else if (this.maiorAcesso >= 2) {
				return 'extraGedproRotuloBlue';
			}
			return 'extraGedproRotuloGray';
		}
	}

	class GedproProcesso extends GedproNode {
		constructor(reg: Element) {
			super(reg);
			this.rotulo = 'Documentos do GEDPRO';
		}
	}

	class GedproIncidente extends GedproNode {
		constructor(reg: Element) {
			super(reg);
			this.rotulo = reg.getAttribute('descricaoIncidente');
		}
	}

	class GedproDocComposto extends GedproNode {
		constructor(reg: Element) {
			super(reg);
			this.rotulo = `${reg.getAttribute('nomeTipoDocComposto')} ${reg.getAttribute(
				'identificador'
			)}/${reg.getAttribute('ano')}`;
		}
	}

	const GedproTabela = (function() {
		let table: HTMLTableElement;
		function getTable() {
			if (!table) {
				createTable();
			}
			return table;
		}
		function createTable() {
			table = document.createElement('table');
			table.className = 'infraTable';
		}
		let tHead: HTMLTableSectionElement;
		function getTHead() {
			if (!tHead) {
				createTHead();
			}
			return tHead;
		}
		const numCells = 7;
		function createTHead() {
			const table = getTable();
			table.deleteTHead();
			tHead = table.createTHead();
			const tr = tHead.insertRow(0);
			['Documento', 'Número', 'Status', 'Data Documento', 'Criação', 'Edição'].forEach(text => {
				const th = document.createElement('th');
				th.className = 'infraTh';
				th.textContent = text;
				tr.appendChild(th);
			});
			tr.cells[2].colSpan = 2;
		}
		let tBody: HTMLTableSectionElement;
		function getTBody() {
			if (!tBody) {
				createTBody();
			}
			return tBody;
		}
		function createTBody() {
			const table = getTable();
			if (table.tBodies.length) {
				$$('tbody', table).forEach(tBody => {
					table.removeChild(tBody);
				});
			}
			tBody = document.createElement('tbody');
			table.appendChild(tBody);
			trClassName = null;
		}
		let tFoot: HTMLTableSectionElement;
		function getTFoot() {
			if (!tFoot) {
				createTFoot();
			}
			return tFoot;
		}
		function createTFoot() {
			const table = getTable();
			table.deleteTFoot();
			tFoot = table.createTFoot();
			const tr = tFoot.insertRow(0);
			const th = document.createElement('th');
			th.className = 'extraGedproPaginacao';
			th.colSpan = numCells;
			tr.appendChild(th);
		}
		let trClassName: 'infraTrClara' | 'infraTrEscura' | null;
		function createRow() {
			const tBody = getTBody();
			const tr = tBody.insertRow(tBody.rows.length);
			trClassName = trClassName == 'infraTrClara' ? 'infraTrEscura' : 'infraTrClara';
			tr.className = trClassName;
			return tr;
		}
		let pagina = 1;
		let maiorPagina = pagina;
		return {
			getPagina(estaPagina: number) {
				pagina = estaPagina;
				getTHead();
				createTBody();
				createTFoot();
				return table;
			},
			getTable() {
				return getTable();
			},
			visit(obj: GedproNodes) {
				obj.accept(this);
			},
			visitNodes(nodes: GedproNodes) {
				const possuiMaisDocumentos = nodes.length >= 21;
				if (pagina > maiorPagina) {
					maiorPagina = pagina;
				} else if (pagina == maiorPagina && possuiMaisDocumentos) {
					maiorPagina++;
				}
				getTHead();
				const cell = getTFoot().rows[0].cells[0];

				function criaLinkPaginacaoGedpro(pagina: number, texto: number) {
					const link = document.createElement('a');
					link.href = '#cargaDocsGedpro';
					link.textContent = String(texto);
					link.addEventListener(
						'click',
						() => Gedpro.getDocs(pagina).catch(err => console.error(err)),
						false
					);
					cell.appendChild(link);
				}
				cell.appendChild(document.createTextNode('Página '));
				for (let p = 1; p <= maiorPagina; p++) {
					if (p == pagina) {
						const span = document.createElement('span');
						span.className = 'extraGedproPaginaAtual';
						span.textContent = String(pagina);
						cell.appendChild(span);
					} else {
						criaLinkPaginacaoGedpro(p, p);
					}
					cell.appendChild(document.createTextNode(' '));
				}
			},
			visitNode(node: GedproNode) {
				const tr = createRow();
				const tdRotulo = tr.insertCell(0);
				tdRotulo.colSpan = numCells;
				node.icones.forEach(function(icone) {
					tdRotulo.appendChild(icone.toImg());
				});
				tdRotulo.appendChild(document.createTextNode(` ${node.rotulo}`));
				return tr;
			},
			visitDoc(doc: GedproDoc) {
				const row = this.visitNode(doc);
				const tdRotulo = row.cells[row.cells.length - 1];
				tdRotulo.removeAttribute('colspan');
				tdRotulo.className = doc.getClasse();
				if (tdRotulo.className != 'extraGedproRotuloGray') {
					const node = doc;
					tdRotulo.addEventListener(
						'click',
						(e: MouseEvent) => {
							e.preventDefault();
							e.stopPropagation();
							const menuFechar = $<HTMLLIElement>('#extraFechar');
							if (menuFechar) {
								menuFechar.style.visibility = 'visible';
							}
							const win =
								window.wrappedJSObject.documentosAbertos[`${Eproc.processo}${node.codigo}`];
							if (typeof win == 'object' && !win.closed) {
								return win.focus();
							}
							window.wrappedJSObject.documentosAbertos[
								`${Eproc.processo}${node.codigo}`
							] = window.open(
								`http://${
									Gedpro.host
								}/visualizarDocumentos.asp?origem=pesquisa&ignoraframes=sim&codigoDocumento=${
									node.codigo
								}`,
								`${Eproc.processo}${node.codigo}`,
								'menubar=0,resizable=1,status=0,toolbar=0,location=0,directories=0,scrollbars=1'
							);
						},
						false
					);
				}
				row.insertCell(row.cells.length).innerHTML = doc.codigo;
				row.insertCell(row.cells.length).innerHTML = doc.status;
				row.insertCell(row.cells.length).appendChild(doc.statusIcone.toImg());
				row.insertCell(row.cells.length).innerHTML = doc.data;
				row.insertCell(row.cells.length).innerHTML = `${doc.criador}<br/>${doc.dataCriacao}`;
				row.insertCell(row.cells.length).innerHTML = `Versão ${doc.versao} por ${
					doc.editor
				} em<br/>${doc.dataVersao}`;
				return row;
			},
		};
	})();

	type State = {
		buscando: boolean;
		pagina?: number;
		linkCargaDocs?: VLink;
		linkElement?: HTMLAnchorElement;
		host?: string;
		link?: string;
		loginForm?: string;
		loginPossivel?: true;
		novoLogin: boolean;
		grupos?: string;
		docsUrl?: string;
		xml?: XMLDocument;
	};
	function createAction<A extends string>(type: A): () => { type: A };
	function createAction<A extends string, P>(type: A): (payload: P) => { type: A; payload: P };
	function createAction(type: string) {
		return function createAction2(payload?: any) {
			return payload === undefined ? { type } : { type, payload };
		};
	}
	const Actions = {
		buscar: createAction<'BUSCAR', number>('BUSCAR'),
		docsUrlObtido: createAction<'DOCS_URL_OBTIDO', string>('DOCS_URL_OBTIDO'),
		documentosObtidos: createAction<'DOCUMENTOS_OBTIDOS', XMLDocument>('DOCUMENTOS_OBTIDOS'),
		erro: createAction<'ERRO', string>('ERRO'),
		elementoLinkObtido: createAction<'ELEMENTO_LINK_OBTIDO', HTMLAnchorElement>(
			'ELEMENTO_LINK_OBTIDO'
		),
		gruposObtidos: createAction<'GRUPOS_OBTIDOS', string>('GRUPOS_OBTIDOS'),
		linkCargaDocsObtido: createAction<'LINK_CARGA_DOCS_OBTIDO', VLink>('LINK_CARGA_DOCS_OBTIDO'),
		linkObtido: createAction<'LINK_OBTIDO', string>('LINK_OBTIDO'),
		loginFormObtido: createAction<'FORMULARIO_LOGIN_OBTIDO', string>('FORMULARIO_LOGIN_OBTIDO'),
		loginOk: createAction('LOGIN_OK'),
		loginPossivel: createAction('LOGIN_POSSIVEL'),
		novoLogin: createAction('NOVO_LOGIN'),
	};
	type Action = {
		[k in keyof typeof Actions]: ReturnType<typeof Actions[k]>
	}[keyof typeof Actions];

	let state: State = { buscando: false, novoLogin: false };

	function reducer(state: State, action: Action): State {
		switch (action.type) {
			case 'BUSCAR':
				return { ...state, buscando: true, pagina: action.payload };
			case 'DOCUMENTOS_OBTIDOS':
				return { ...state, xml: action.payload };
			case 'DOCS_URL_OBTIDO':
				return { ...state, docsUrl: action.payload };
			case 'ELEMENTO_LINK_OBTIDO':
				return { ...state, linkElement: action.payload };
			case 'ERRO':
				console.error(action.payload);
				alert(action.payload);
				return { buscando: false, novoLogin: false };
			case 'FORMULARIO_LOGIN_OBTIDO':
				return { ...state, loginForm: action.payload };
			case 'GRUPOS_OBTIDOS':
				return { ...state, grupos: action.payload };
			case 'LINK_CARGA_DOCS_OBTIDO':
				return { ...state, linkCargaDocs: action.payload };
			case 'LINK_OBTIDO':
				return { ...state, link: action.payload, host: new URL(action.payload).host };
			case 'LOGIN_OK':
				return { ...state, novoLogin: false };
			case 'LOGIN_POSSIVEL':
				return { ...state, loginPossivel: true };
			case 'NOVO_LOGIN':
				return { ...state, novoLogin: true };
			default:
				return state;
		}
	}
	let dispatching = false;
	let actions: Action[] = [];
	function dispatch(action: Action): void {
		actions.push(action);
		if (dispatching) return;
		dispatching = true;
		while (actions.length > 0) {
			const action = actions.shift();
			console.log('State', state, 'Action', action);
			state = reducer(state, action);
		}
		actions = [];
		dispatching = false;
		subscribers.forEach(s => s());
	}
	let subscribers: (() => void)[] = [];
	function subscribe(subscriber: () => void): () => void {
		subscribers.push(subscriber);
		return () => {
			subscribers = subscribers.filter(s => s !== subscriber);
		};
	}
	function updateStatus(status: string) {
		console.log('STATUS UPDATE', status);
		state.linkCargaDocs.textContent = status;
	}
	function handler(): void {
		if (state.buscando) {
			if (!state.linkCargaDocs) {
				const linkCargaDocs = $$<VLink>('#linkCargaDocs');
				if (linkCargaDocs.length < 1)
					return dispatch(
						Actions.erro('Não foi possível obter o botão de carregamento do Gedpro.')
					);
				dispatch(Actions.linkCargaDocsObtido(linkCargaDocs[0]));
			}
			if (!state.linkElement) {
				updateStatus('Obtendo link do GEDPRO...');
				return Gedpro.getLinkElement();
			}
			if (!state.link || !state.host) {
				updateStatus('Obtendo endereço do GEDPRO...');
				return Gedpro.getLink(state.linkElement);
			}
			if (!state.loginForm) {
				updateStatus('Obtendo link de requisição de login...');
				return Gedpro.getLoginForm(state.host, state.link);
			}
			if (!state.loginPossivel) {
				updateStatus('Verificando possibilidade de login...');
				return Gedpro.getLogin(state.loginForm);
			}
			if (state.novoLogin) {
				alert('Feche o documento e tente novamente agora.');
				return dispatch(Actions.loginOk());
			}
			if (!state.grupos) {
				updateStatus('Obtendo grupos do usuário...');
				return Gedpro.getGrupos(state.host);
			}
			if (!state.docsUrl) {
				updateStatus('Obtendo endereço dos documentos...');
				return Gedpro.getDocsUrl(state.host, state.grupos);
			}
			if (!state.xml) {
				updateStatus(`Carregando página ${state.pagina} da árvore de documentos...`);
				return Gedpro.getXml(state.docsUrl, state.pagina);
			}
		}
	}
	subscribe(handler);
	class GedproStatic {
		async getDocs(pagina: number = 1) {
			dispatch(Actions.buscar(pagina));
			return;

			if (state.buscando) {
				dispatch(Actions.exibirAviso('A solicitação já foi enviada. Por favor aguarde.'));
				return;
			}
			dispatch(Actions.buscar(pagina));
			const xml = await Gedpro.getXml(pagina);
			const nodes = new GedproNodes(xml);
			GedproTabela.visit(nodes);
			const pai = $('#cargaDocsGedpro');
			const linkCargaDocs = $<VLink>('#linkCargaDocs');
			linkCargaDocs.transform();
			const table = GedproTabela.getTable();
			pai.insertBefore(table, linkCargaDocs);
			dispatch(Actions.parar());
		}
		getDocsUrl(host: string, grupos: string) {
			dispatch(
				Actions.docsUrlObtido(
					`http://${host}/XMLInterface.asp?processo=${
						Eproc.processo
					}&ProcessoVisual=PV&grupos=${grupos}`
				)
			);
		}
		getGrupos(host: string): void {
			fetch(
				`http://${host}/arvore2.asp?modulo=Textos do Processo&processo=${
					Eproc.processo
				}&numeroProcessoVisual=NPV&localizadorProcesso=LP`,
				{ credentials: 'include' }
			)
				.then(response => response.text())
				.then(text => {
					const match = text.match(/&grupos=([^&]+)&/);
					if (!match) {
						dispatch(
							Actions.erro(
								'Não foi possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.'
							)
						);
						dispatch(Actions.gruposObtidos('11,28,82'));
					}
					dispatch(Actions.gruposObtidos(match[1]));
				});
		}
		getLink(linkElement: HTMLAnchorElement): void {
			fetch(linkElement.href, {
				credentials: 'include',
				method: 'HEAD',
				headers: new Headers({ 'X-Ferramentas-e-Proc': '1' }),
			}).then(response =>
				dispatch(Actions.linkObtido(response.headers.get('X-Ferramentas-e-Proc-Redirect')))
			);
		}
		getLinkElement(): void {
			const links = $$<HTMLAnchorElement>(
				'a[href^="controlador.php?acao=acessar_processo_gedpro&"]'
			);
			if (links.length == 1) {
				dispatch(Actions.elementoLinkObtido(links[0]));
			} else {
				dispatch(Actions.erro('Link do Gedpro não encontrado.'));
			}
		}
		getLoginForm(host: string, link: string): void {
			fetch(link, { credentials: 'include' })
				.then(response => response.text())
				.then(text => {
					const formLogin = /FormLogin\.asp\?[^"]+/.exec(text);
					const mainframePage = /\/mainframe\.asp\?[^"]+/.exec(text);
					if (formLogin) {
						return dispatch(Actions.loginFormObtido(`http://${host}/${formLogin}`));
					} else if (mainframePage) {
						return this.getLoginForm(host, `http://${host}${mainframePage}`);
					} else {
						dispatch(Actions.erro('Não foi possível obter o link de requisição de login.'));
					}
				});
		}
		getNewLogin(e: MouseEvent) {
			e.preventDefault();
			e.stopPropagation();
			dispatch(Actions.novoLogin());
		}
		getLogin(loginForm: string): void {
			fetch(loginForm, { credentials: 'include' })
				.then(response => response.text())
				.then(text => {
					if (/<!-- Erro /.test(text)) {
						dispatch(Actions.erro('Não é possível fazer login no GEDPRO.'));
					} else {
						dispatch(Actions.loginPossivel());
					}
				});
		}
		getXml(docsUrl: string, pagina: number): void {
			fetch(`${docsUrl}&pgtree=${pagina}`, { credentials: 'include' })
				.then(response => response.blob())
				.then(
					blob =>
						new Promise<string>(resolve => {
							const reader = new FileReader();
							reader.addEventListener('loadend', () => resolve(reader.result as string), {
								once: true,
							});
							reader.readAsText(blob);
						})
				)
				.then(text => {
					const parser = new DOMParser();
					const xml = parser.parseFromString(text, 'application/xml');
					dispatch(Actions.documentosObtidos(xml));
				});
		}
	}
	return new GedproStatic();
})();
var Eproc = {
	acao: '',
	pagina: '',
	processo: 0,
	clicar(elemento: EventTarget) {
		const evento = document.createEvent('MouseEvents');
		evento.initMouseEvent(
			'click',
			true,
			true,
			window,
			0,
			0,
			0,
			0,
			0,
			false,
			false,
			false,
			false,
			0,
			null
		);
		elemento.dispatchEvent(evento);
	},
	closeAllWindows() {
		const windows = [];
		for (let w in window.wrappedJSObject.documentosAbertos) {
			const win = window.wrappedJSObject.documentosAbertos[w];
			if (typeof win == 'object' && !win.closed) {
				windows.push(win);
			}
		}
		const menuFechar = $<HTMLLIElement>('#extraFechar');
		if (windows.length) {
			const tela = /^processo_selecionar/.test(this.acao) ? 'Este processo' : 'Esta tela';
			const msg = `${tela} possui ${windows.length} ${
				windows.length > 1 ? 'janelas abertas' : 'janela aberta'
			}.\nDeseja fechá-${windows.length > 1 ? 'las' : 'la'}?`;
			const resposta = confirm(msg);
			if (resposta === true) {
				for (let w = windows.length - 1; w >= 0; w--) {
					windows[w].close();
				}
				if (menuFechar) {
					menuFechar.style.visibility = 'hidden';
				}
			}
		} else {
			if (menuFechar) {
				menuFechar.style.visibility = 'hidden';
			}
		}
	},
	modificarTabelaProcessos: function() {
		function findTh(campo: string, texto: string): HTMLTableHeaderCellElement {
			let th = null;
			const setas = $$<HTMLAnchorElement>(`a[onclick="infraAcaoOrdenar('${campo}','ASC');"]`);
			if (setas.length !== 1) {
				$$('.infraTh').forEach(possibleTh => {
					if (possibleTh.textContent === texto && possibleTh.matches('th')) th = possibleTh;
				});
			} else {
				th = setas[0].parentElement;
				while (th !== null && !th.matches('th')) {
					th = th.parentElement;
				}
			}
			return th as HTMLTableHeaderCellElement;
		}
		let classeTh = findTh('DesClasseJudicial', 'Classe');
		const juizoTh = findTh('SigOrgaoJuizo', 'Juízo');
		let th = classeTh || juizoTh;
		if (th === null) {
			const tr = $$('tr[data-classe]');
			if (tr.length > 0) {
				let table;
				for (
					table = tr[0].parentElement;
					table !== null && !table.matches('table');
					table = table.parentElement
				);
				$$<HTMLTableHeaderCellElement>('.infraTh', table).forEach(function(th) {
					if (/^Classe( Judicial)?$/.test(th.textContent)) {
						classeTh = th;
					}
				});
			}
			th = classeTh;
		}
		if (th === null) {
			$$<HTMLTableHeaderCellElement>('.infraTh').forEach(function(th) {
				if (/^Classe( Judicial)?$/.test(th.textContent.trim())) {
					classeTh = th;
				}
			});
			th = classeTh;
		}
		if (th !== null) {
			const table = th.closest('table');
			table.removeAttribute('width');
			$$<HTMLTableHeaderCellElement>('th', table).forEach(function(th) {
				th.removeAttribute('width');
			});
			table.rows.forEach(tr => {
				if (!tr.className.match(/infraTr(Clara|Escura)/)) return;
				if (juizoTh) {
					let color = null;
					const juizoIndex = juizoTh.cellIndex;
					const juizoCell = tr.cells[juizoIndex];
					const juizoText = juizoCell.textContent;
					const juizo = juizoText[juizoText.length - 1];
					if (/^\s*[A-Z]{5}TR/.test(juizoText)) {
						switch (juizo) {
							case 'A':
							case 'F':
								color = 'black';
								break;

							case 'B':
							case 'G':
								color = 'green';
								break;

							case 'C':
							case 'H':
								color = 'red';
								break;

							case 'D':
								color = 'brown';
								break;

							case 'E':
								color = 'orange';
								break;

							default:
								color = 'black';
						}
					}
					if (color) {
						juizoCell.style.color = color;
					}
				}
			});
		}
	},
	corrigirCss: function(rule: string) {
		const extra = Eproc.getStyle('extraCorrecaoCss');
		extra.innerHTML = 'div.infraAreaDados { height: auto !important; overflow: inherit; }';
		extra.innerHTML += rule;
	},
	entrar: function() {
		Eproc.corrigirCss('#fldLogin { position: static; margin: 6% auto; }');
	},
	entrar_cert: function() {
		this.entrar();
	},
	getStyle: function(id: string) {
		let extraStyle = $<HTMLStyleElement>(`#${id}`);
		if (!extraStyle) {
			extraStyle = document.createElement('style');
			extraStyle.id = id;
			$('head').appendChild(extraStyle);
		}
		return extraStyle;
	},
	getMenu: function() {
		const menu = $('#main-menu');
		if (menu) return menu;
		return false;
	},
	init: async function() {
		if (window.wrappedJSObject.FeP) {
			analisarVersao(window.wrappedJSObject.FeP);
		}
		this.pagina = window.location.pathname.split('/eprocV2/')[1];
		this.parametros = {};
		for (
			let p = 0,
				params = window.location.search
					.split('?')
					.splice(0)
					.join('')
					.split('&'),
				param;
			p < params.length && (param = params[p]);
			p++
		) {
			const nameValue = param.split('=');
			this.parametros[nameValue[0]] = nameValue[1];
		}
		if (this.parametros.acao) {
			this.acao = this.parametros.acao;
			delete this.parametros.acao;
		}
		if (this.parametros.num_processo) {
			this.processo = this.parametros.num_processo;
			delete this.parametros.num_processo;
		}
		const barraSistema = $('.infraBarraSistema');
		if (barraSistema) {
			await Eproc.mudaEstilos();
		}
		const pesquisaRapida = $<HTMLInputElement>('#txtNumProcessoPesquisaRapida');
		if (pesquisaRapida && pesquisaRapida.matches('input')) {
			if ('placeholder' in pesquisaRapida) {
				pesquisaRapida.setAttribute('placeholder', 'Pesquisa');
				pesquisaRapida.removeAttribute('value');
				pesquisaRapida.removeAttribute('style');
				pesquisaRapida.removeAttribute('onclick');
			}
		}
		const global = $('#divInfraAreaGlobal');
		if (global) {
			const wrapper = document.createElement('div');
			wrapper.className = 'extraWrapper';
			global.parentNode.insertBefore(wrapper, global);
			wrapper.appendChild(global);
		}
		const barra = $('#divInfraBarraTribunalD');
		if (barra) {
			const div = document.createElement('div');
			div.className = 'infraAcaoBarraSistema';
			const a = document.createElement('a');
			a.id = 'extraConfiguracaoComplemento';
			a.addEventListener('click', () => browser.runtime.sendMessage({ type: 'options' }), false);
			const img = document.createElement('img');
			img.className = 'infraImg';
			img.src = browser.runtime.getURL('chrome/skin/stapler-16.png');
			a.appendChild(img);
			div.appendChild(a);
			let upperDiv;
			if (pesquisaRapida) {
				upperDiv = pesquisaRapida.closest('.infraAcaoBarraSistema');
				upperDiv.parentNode.insertBefore(div, upperDiv.nextSibling.nextSibling.nextSibling);
			} else if ($('#lnkSairSistema')) {
				upperDiv = $('#lnkSairSistema').closest('.infraAcaoBarraSistema');
				upperDiv.parentNode.insertBefore(div, upperDiv);
			} else {
				barra.appendChild(div);
			}
		}
		this.modificarTabelaProcessos();
		if (this.acao && this[this.acao]) {
			this[this.acao]();
		} else if (this.parametros.acao_origem && this[`${this.parametros.acao_origem}_destino`]) {
			this[`${this.parametros.acao_origem}_destino`]();
		}

		class Icone {
			private _icone: HTMLImageElement;

			addToLink(link: Node) {
				link.insertBefore(this.getIcone(), link.firstChild);
			}

			getIcone() {
				if (!this._icone) {
					this._icone = document.createElement('img');
					this._icone.width = 16;
					this._icone.height = 16;
					this._icone.className = 'extraIconeAcao noprint';
				}
				return this._icone;
			}
			setSrc(src: string) {
				this.getIcone().src = src;
			}
		}

		class InfraIcone extends Icone {
			constructor(arquivo: string) {
				super();
				this.setSrc(`infra_css/imagens/${arquivo}`);
			}
		}

		class ChromeIcone extends Icone {
			constructor(arquivo: string) {
				super();
				this.setSrc(browser.runtime.getURL(`chrome/skin/${arquivo}`));
			}
		}

		const acoes = getAcoes();
		const botoesDesabilitados = Eproc.prefUsuario(5) == 'N';
		if (acoes && !botoesDesabilitados) {
			const fieldset = $('#fldAcoes');
			const legend = $('legend', fieldset);
			if (legend) {
				const opcoes = document.createElement('div');
				opcoes.className = 'extraAcoesOpcoes noprint';
				legend.appendChild(opcoes);
				const chkMostrarIcones = new CheckBox('v2.mostraricones', 'Mostrar ícones');
				chkMostrarIcones.vincularElementoClasse(fieldset, 'extraAcoesMostrarIcones');
				opcoes.appendChild(chkMostrarIcones.getLabel());
			}
			acoes.forEach(function(acao) {
				if (!acao.classList.contains('infraButton')) {
					acao.classList.add('extraLinkAcao');
				}
				const sublinhados = $$('u', acao);
				if (sublinhados.length == 1) {
					const u = sublinhados[0];
					u.parentNode.replaceChild(u.childNodes[0], u);
				}
				if (!acao.href) {
					if (/window\.open/.test(acao.getAttribute('onclick'))) {
						acao.href = /window\.open\(['"]([^'"]+)/.exec(acao.getAttribute('onclick'))[1];
					} else {
						acao.href = '#';
					}
					acao.addEventListener(
						'click',
						function(e) {
							e.preventDefault();
						},
						false
					);
				}
				const acaoControlador = /\?acao=([^&]+)/.exec(acao.href);
				if (acaoControlador && acaoControlador.length == 2) {
					let icone = null;
					switch (acaoControlador[1]) {
						case 'acessar_processo_gedpro':
							icone = new ChromeIcone('ie.png');
							break;

						case 'acesso_usuario_processo_listar':
							icone = new InfraIcone('menos.gif');
							break;

						case 'arvore_documento_listar':
							icone = new ChromeIcone('tree.gif');
							break;

						case 'audiencia_listar':
							icone = new ChromeIcone('microphone.png');
							break;

						case 'criar_mandado':
							icone = new ChromeIcone('knight-crest.gif');
							break;

						case 'gerenciamento_partes_listar':
							icone = new InfraIcone('grupo.gif');
							break;

						case 'processo_gerenciar_proc_individual_listar':
						case 'gerenciamento_partes_situacao_listar':
							icone = new InfraIcone('marcar.gif');
							break;

						case 'gerenciamento_peritos_listar':
							icone = new ChromeIcone('graduation-hat.png');
							break;

						case 'intimacao_bloco_filtrar':
							icone = new InfraIcone('versoes.gif');
							break;

						case 'processo_agravar':
						case 'processo_cadastrar':
							icone = new InfraIcone('atualizar.gif');
							break;

						case 'redistribuicao_processo_embargo_infrigente':
							icone = new InfraIcone('hierarquia.gif');
							break;

						case 'processo_apelacao':
						case 'processo_remessa_tr':
						case 'selecionar_processos_remessa_instancia_superior':
						case 'selecionar_processos_remessa_instancia_superior_stf':
							icone = new ChromeIcone('up.png');
							break;

						case 'processo_citacao':
							icone = new ChromeIcone('newspaper.png');
							break;

						case 'processo_consultar':
							icone = new InfraIcone('lupa.gif');
							break;

						case 'processo_edicao':
							icone = new InfraIcone('assinar.gif');
							break;

						case 'processo_expedir_carta_subform':
							icone = new InfraIcone('email.gif');
							break;

						case 'processo_intimacao':
						case 'processo_intimacao_bloco':
							icone = new InfraIcone('encaminhar.gif');
							break;

						case 'processo_intimacao_aps_bloco':
							icone = new InfraIcone('transportar.gif');
							break;

						case 'processo_lembrete_destino_cadastrar':
							icone = new InfraIcone('tooltip.gif');
							break;

						case 'processo_movimento_consultar':
							icone = new InfraIcone('receber.gif');
							break;

						case 'processo_movimento_desativar_consulta':
							icone = new InfraIcone('remover.gif');
							break;

						case 'processo_requisicao_cef':
							icone = new ChromeIcone('predio.png');
							break;

						case 'procurador_parte_associar':
						case 'procurador_parte_listar':
							icone = new InfraIcone('mais.gif');
							break;

						case 'requisicao_pagamento_cadastrar':
							icone = new ChromeIcone('money.png');
							break;

						case 'selecionar_processos_arquivo_completo':
							icone = new InfraIcone('pdf.gif');
							break;
					}
					if (icone instanceof Icone) {
						icone.addToLink(acao);
					}
				}
				if (acao.nextSibling && acao.nextSibling.nodeType == document.TEXT_NODE) {
					const span = document.createElement('span');
					span.className = 'extraAcoesSeparador';
					span.textContent = acao.nextSibling.textContent;
					acao.parentNode.replaceChild(span, acao.nextSibling);
				}
			});
		}

		function getAcoes() {
			const acoes = $$<HTMLAnchorElement>('#fldAcoes > center a');
			if (acoes.length === 0) return false;
			return acoes;
		}
	},
	mudaEstilos: async function() {
		function getCss(name: string) {
			return fetch(browser.runtime.getURL(`chrome/skin/${name}.css`)).then(data => data.text());
		}

		function getStyleElement(skin?: string) {
			let styleElementName;
			if (typeof skin == 'undefined') {
				styleElementName = 'extraMain';
			} else if (skin == 'print') {
				styleElementName = 'extraPrint';
			} else if (/-extra$/.test(skin)) {
				styleElementName = 'extraSkinExtra';
			}
			return Eproc.getStyle(styleElementName);
		}

		async function addStyleSheet(name?: string) {
			const estilo = getStyleElement(name);
			const media = name == 'print' ? 'print' : 'screen';
			estilo.media = media;
			if (typeof name == 'undefined') name = 'screen';
			let css = `.no${name} { display: none; }\n`;
			if (name == 'screen') name = 'eprocV2';
			css += await getCss(name);
			estilo.innerHTML = css;
		}
		await addStyleSheet();
		await addStyleSheet('print');

		$$<HTMLLabelElement | HTMLInputElement>(
			'label[onclick^="listarTodos"], label[onclick^="listarEventos"], #txtEntidade, #txtPessoaEntidade'
		).forEach(auto => {
			const id = auto.id.replace('lblListar', 'txt');
			auto = $(`#${id}`);
			if (auto) {
				const w = auto.clientWidth;
				if (w === 0) return;
				auto.style.width = `${w}px`;
			}
		});

		const estilosPersonalizados = $<HTMLLinkElement>('link[href^="css/estilos.php?skin="]');
		if (estilosPersonalizados) {
			const result = /\?skin=([^&]+)/.exec(estilosPersonalizados.href);
			let skin;
			switch (result[1]) {
				case 'elegant':
					skin = 'candy';
					break;

				case 'minimalist':
					skin = 'icecream';
					break;

				case 'stock':
				/* falls through */
				default:
					skin = 'stock';
					break;
			}
			addStyleSheet(`${skin}-extra`);
		}
	},
	usuario_tipo_monitoramento_localizador_listar() {
		const linhas = $$('#divInfraAreaTabela tr[class^="infraTr"]');
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
	},
	async principal_destino() {
		Eproc.corrigirCss('');
		const linhas = $$('#fldProcessos tr[class^="infraTr"], #fldLocalizadores tr[class^="infraTr"]');
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
		const botao = $<HTMLAnchorElement>('#lnkConfiguracaoSistema');
		const novasConfiguracoesMostradas =
			(await browser.storage.local.get()).novasconfiguracoes4mostradas || true;
		if (botao) {
			if (!novasConfiguracoesMostradas) {
				const resposta = confirm(
					'Você deve configurar algumas opções antes de continuar.\n\nDeseja abrir a tela de configurações agora?'
				);
				if (resposta === true) {
					window.location.href = botao.href;
				}
			}
			const xhr = new XMLHttpRequest();
			xhr.open('GET', botao.href);
			xhr.onreadystatechange = function() {
				if (this.readyState == 4 && this.status == 200) {
					const div = document.createElement('div');
					div.innerHTML = this.responseText;
					const storage = window.localStorage;
					if (storage.length) {
						for (let key in storage) {
							if (/^ch\d+$/.test(key)) {
								storage.removeItem(key);
							}
						}
					}
					$$<HTMLInputElement>('input[type=checkbox][id^="ch"]', div).forEach(input => {
						storage.setItem(input.id, input.checked ? 'S' : 'N');
					});
				}
			};
			xhr.send('');
		}
	},
	decorarLinhasTabelaLocalizadores(linhas: HTMLTableRowElement[]) {
		linhas.forEach(linha => {
			const link = getLink(linha);
			const url = getUrl(link);
			const processos = getQtdProcessos(link);
			linha.classList.add('extraLocalizador');
			linha.setAttribute('data-processos', String(processos));
			if (processos > 0) {
				linha.addEventListener(
					'click',
					function() {
						window.location.href = url;
					},
					false
				);
			}
		});

		function getLink(tr: HTMLTableRowElement) {
			try {
				return tr.cells[1].querySelector('a');
			} catch (e) {
				return null;
			}
		}

		function getUrl(a: HTMLAnchorElement) {
			try {
				if (a.href) {
					return a.href;
				} else if (a.getAttribute('onclick')) {
					return `javascript:${a.getAttribute('onclick')}`;
				}
			} catch (e) {
				return '';
			}
		}

		function getQtdProcessos(a: HTMLAnchorElement) {
			try {
				return Number(a.textContent);
			} catch (e) {
				return 0;
			}
		}
	},
	processo_cadastrar_2: function() {
		const auto = $<HTMLInputElement>('#txtDesAssunto');
		if (auto) {
			auto.style.width = `${auto.clientWidth}px`;
		}
	},
	processo_consulta_listar: function() {
		const form = $<HTMLFormElement>('#frmProcessoEventoLista');
		form.action = window.location.pathname + window.location.search;
		const docsGedpro = $('#divDocumentosGedpro');
		if (docsGedpro) {
			const linkSecao = $('#divInfraBarraTribunalE').getElementsByTagName('a')[0];
			const estado = linkSecao.hostname.match(/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/);
			const linkGedpro = `http://gedpro.${
				estado ? `jf${estado[1]}` : 'trf4'
			}.jus.br/visualizarDocumentos.asp?codigoDocumento=`;
			class Doc {
				link: HTMLAnchorElement;
				constructor(numero: string, tipo: string) {
					this.toString = function() {
						return [tipo, numero].join(' ');
					};
					this.link = document.createElement('a');
					this.link.textContent = this.toString();
					this.link.href = linkGedpro + numero;
					this.link.target = '_blank';
					this.link.setAttribute('data-doc', numero);
				}
				static fromRow(row: HTMLTableRowElement) {
					const numero = row.cells[1].textContent.replace(/^ged_/, '');
					const tipo = row.cells[2].textContent;
					return new Doc(numero, tipo);
				}
			}
			const thead = form.querySelector('.infraTable > tbody > tr:first-child');
			const th = document.createElement('th');
			th.className = 'infraTh';
			th.textContent = 'Documento Gedpro';
			thead.appendChild(th);
			const processos = form.querySelectorAll<HTMLTableRowElement>(
				'.infraTable > tbody > tr[class^=infraTr]'
			);
			$$<HTMLTableRowElement>('tr[class^=infraTr]', docsGedpro).forEach((row, r) => {
				const doc = Doc.fromRow(row);
				const newCell = processos[r].insertCell(processos[r].cells.length);
				newCell.appendChild(doc.link);
				row.parentNode.removeChild(row);
			});
			window.wrappedJSObject.analisarDocs();
		}
	},
	processo_evento_paginacao_listar() {
		this.processo_selecionar();
	},
	processo_seleciona_publica() {
		this.processo_selecionar();
	},
	processo_selecionar() {
		let linkCargaDocs;
		const div = document.createElement('div');
		div.id = 'cargaDocsGedpro';
		linkCargaDocs = VirtualLink('Carregar documentos do GEDPRO', () =>
			Gedpro.getDocs().catch(err => console.error(err))
		);
		linkCargaDocs.id = 'linkCargaDocs';
		if ($$('a.infraButton').length) {
			linkCargaDocs.className = 'infraButton';
		} else {
			linkCargaDocs.className = 'extraLinkAcao';
		}
		let transformed = false;
		linkCargaDocs.transform = function() {
			if (transformed) {
				return;
			}
			transformed = true;
			this.removeTrigger();
			this.classList.remove('extraLinkAcao');
			this.textContent = 'Falta de permissão de acesso?';
			this.addEventListener(
				'click',
				(e: MouseEvent) => Gedpro.getNewLogin(e).catch(err => console.error(err)),
				false
			);
		};
		div.appendChild(linkCargaDocs);
		const fldMinutas = $('#fldMinutas');
		fldMinutas.parentNode.insertBefore(document.createElement('br'), fldMinutas.nextSibling);
		fldMinutas.parentNode.insertBefore(div, fldMinutas.nextSibling.nextSibling);

		$$<HTMLTableElement>('.infraTable').forEach(table => {
			if (
				table.getAttribute('summary') == 'Eventos' ||
				table.rows[0].cells[0].textContent == 'Evento'
			) {
				applyTableModifications(table);
			}
		});

		function applyTableModifications(table: HTMLTableElement) {
			if (!table.tHead) {
				table.createTHead();
				const firstRow = table.rows[0];
				if (firstRow.cells[0].tagName == 'TH') {
					table.tHead.appendChild(firstRow);
				}
			}
			$$('th', table).forEach(function(th) {
				th.removeAttribute('width');
			});
			const eventosReferidos: { [key: string]: HTMLTableRowElement[] } = {};
			table.addEventListener(
				'click',
				e => {
					const docLink = e.target as HTMLAnchorElement;
					if (docLink.hasAttribute('data-doc')) {
						const lastClicked = $('#lastClicked');
						if (lastClicked) {
							lastClicked.removeAttribute('id');
						}
						docLink.id = 'lastClicked';
						const menuFechar = $<HTMLLIElement>('#extraFechar');
						if (menuFechar) {
							menuFechar.style.visibility = 'visible';
						}
					}
				},
				false
			);
			$$<HTMLTableRowElement>('tr[class^="infraTr"], tr[bgcolor="#FFFACD"]', table).forEach(tr => {
				const colunaDescricao = tr.cells[tr.cells.length - 3];
				const texto = colunaDescricao.textContent;
				const numeroEvento = /^\d+/.exec(tr.cells[tr.cells.length - 5].textContent)[0];
				if (/Refer\. ao Evento: \d+$/.test(texto)) {
					const eventoReferido = /\d+$/.exec(texto)[0];
					if (!(eventoReferido in eventosReferidos)) {
						eventosReferidos[eventoReferido] = [];
					}
					eventosReferidos[eventoReferido].push(tr);
				} else if (numeroEvento in eventosReferidos) {
					const parte = $('.infraEventoPrazoParte', tr);
					if (parte) {
						eventosReferidos[numeroEvento].forEach(function(linha) {
							linha.cells[linha.cells.length - 3].innerHTML += `<br>${
								`${colunaDescricao.innerHTML}<br>`.split('<br>')[1]
							}`;
						});
					}
				}
			});
			table.classList.add('extraTabelaEventos');
		}
		const menu = Eproc.getMenu();
		if (menu) {
			const fechar = document.createElement('li');
			fechar.id = 'extraFechar';
			fechar.style.visibility = 'hidden';
			const fecharLink = VirtualLink('Fechar as janelas abertas', Eproc.closeAllWindows);
			fechar.appendChild(fecharLink);
			menu.appendChild(fechar);
			let fecharFixado = false;
			let fecharAltura;
			let fecharY: number;
			let posicaoIdeal: number;
			let paginaY: number;
			const afixar = function() {
				fechar.style.position = 'fixed';
				fechar.style.top = `${posicaoIdeal}px`;
				fechar.style.width = `${menu.clientWidth}px`;
				fecharFixado = true;
			};
			const desafixar = function() {
				fechar.style.position = '';
				fechar.style.top = '';
				fechar.style.width = '';
				fecharFixado = false;
			};
			const debounce = function(callback: Function, ms: number) {
				let timer: number;
				let context: any;
				let args: IArguments;
				return function() {
					window.clearTimeout(timer);
					context = this;
					args = arguments;
					timer = window.setTimeout(function() {
						return callback.apply(context, args);
					}, ms);
				};
			};
			const throttle = function(callback: Function) {
				let atualizando = false;
				let context: any;
				let args: IArguments;
				function atualizar() {
					callback.apply(context, args);
					atualizando = false;
				}
				return function() {
					if (!atualizando) {
						context = this;
						args = arguments;
						window.requestAnimationFrame(atualizar);
						atualizando = true;
					}
				};
			};
			const atualizar = throttle(function() {
				if (fecharY - paginaY < posicaoIdeal) {
					if (!fecharFixado) {
						afixar();
					}
				} else if (fecharFixado) {
					desafixar();
				}
			});
			function onScroll() {
				paginaY = window.pageYOffset;
				atualizar();
			}
			window.addEventListener('scroll', onScroll, false);
			function calcularDimensoes() {
				desafixar();
				fecharAltura = fechar.clientHeight;
				fecharY = fechar.offsetTop;
				posicaoIdeal = (window.innerHeight - fecharAltura) / 2;
				onScroll();
			}
			const onResize = debounce(calcularDimensoes, 50);
			window.addEventListener('resize', onResize, false);
			$('#lnkInfraMenuSistema').addEventListener('click', onResize, false);
			const inicializar = debounce(calcularDimensoes, 300);
			inicializar();
		}
	},
	isSegundoGrau() {
		return this.getEstado() === null;
	},
	getEstado() {
		const linkSecao = $<HTMLAnchorElement>('#divInfraBarraTribunalE a');
		const estado = (linkSecao ? linkSecao.hostname : window.location.hostname).match(
			/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/
		);
		if (estado) return estado[1];
		return null;
	},
	getNumprocF(numproc: string) {
		let numprocF = '';
		for (let i = 0, len = numproc.length; i < len; i++) {
			let d = numproc.substr(i, 1);
			if (i == 7) numprocF += '-';
			if (i == 9 || i == 13 || i == 16) numprocF += '.';
			numprocF += d;
		}
		return numprocF;
	},
	prefUsuario(num: number) {
		const storage = window.localStorage;
		if (`ch${num}` in storage) {
			return storage.getItem(`ch${num}`);
		}
		return null;
	},
	usuario_personalizacao_configuracao: async function() {
		const storage = window.localStorage;
		$$('input[type=checkbox][id^="ch"]').forEach(function(input) {
			input.addEventListener(
				'click',
				function() {
					storage.setItem(`ch${this.name}`, this.checked ? 'S' : 'N');
				},
				false
			);
		});

		const botao = $<HTMLAnchorElement>('#lnkConfiguracaoSistema');
		let novasConfiguracoesMostradas =
			(await browser.storage.local.get()).novasconfiguracoes4mostradas || true;
		if (botao && !novasConfiguracoesMostradas) {
			window.alert(
				'Por favor, verifique se todas as configurações estão de acordo com suas preferências.'
			);
			novasConfiguracoesMostradas = true;
			browser.storage.local.set({ novasconfiguracoes4mostradas: true });
			const tooltip = new Tooltip(
				'Este ícone permite acessar novamente as configurações a qualquer momento.'
			);
			tooltip.vincular(botao);
			window.addEventListener('resize', tooltip.desenhar, false);
			botao.addEventListener('mouseover', tooltip.ocultar, false);
		}
	},
};
function analisarVersao(FeP: FerramentasEProc) {
	const numeroVersaoCompativel = FeP.numeroVersaoCompativel.split('.').map(Number);
	const numeroVersaoInstalada = browser.runtime
		.getManifest()
		.version.split('.')
		.map(Number);
	while (numeroVersaoCompativel.length < numeroVersaoInstalada.length) {
		numeroVersaoCompativel.push(0);
	}
	while (numeroVersaoInstalada.length < numeroVersaoCompativel.length) {
		numeroVersaoInstalada.push(0);
	}
	const comparacao = numeroVersaoInstalada.foldMap(Ordering, (x, i) =>
		Ordering.compare(x, numeroVersaoCompativel[i])
	);
	window.wrappedJSObject.FeP.versaoUsuarioCompativel = comparacao.value !== OrderingTag.LT;
}

interface SemigroupTypeRep {
	empty(): Semigroup;
}
interface Semigroup {
	concat(that: Semigroup): Semigroup;
}

interface Array<T> {
	foldMap<ST extends SemigroupTypeRep, S extends ReturnType<ST['empty']>>(
		S: ST,
		f: (x: T, i: number) => S
	): S;
}

Array.prototype.foldMap = function foldMap<
	T,
	ST extends SemigroupTypeRep,
	S extends ReturnType<ST['empty']>
>(this: Array<T>, S: ST, f: (x: T, i: number) => S): S {
	return this.reduce((acc, x, i) => acc.concat(f(x, i)) as S, S.empty() as S);
};

enum OrderingTag {
	LT = -1,
	EQ = 0,
	GT = +1,
}

class Ordering {
	constructor(readonly value: OrderingTag) {}

	concat(that: Ordering) {
		return this.value === OrderingTag.EQ ? that : this;
	}

	static empty() {
		return new Ordering(OrderingTag.EQ);
	}
	static compare(a: any, b: any) {
		return new Ordering(a < b ? OrderingTag.LT : a > b ? OrderingTag.GT : OrderingTag.EQ);
	}
}

class Tooltip {
	desenhar: () => void;
	vincular: (elemento: HTMLElement) => void;
	ocultar: () => void;
	constructor(texto: string) {
		let adicionarElementos: () => void;
		let div = document.createElement('div');
		div.innerHTML = '<img src="imagens/tooltip/arrow3.gif" style="position: absolute;"/>';
		const img = div.firstChild as HTMLImageElement;
		div.innerHTML = `<div style="position: absolute; background: lightyellow; border: 1px solid black; font-size: 1.2em; width: 30ex; text-align: center; padding: 10px;">${texto}</div>`;
		div = div.firstChild as HTMLDivElement;
		let elementoVinculado: HTMLElement;
		let x = 0;
		let y = 0;
		this.vincular = function(elemento: HTMLElement) {
			elementoVinculado = elemento;
			this.desenhar();
		};
		this.desenhar = function() {
			removerElementos();
			calcularXY(elementoVinculado);
			adicionarElementos();
			posicionarElementos();
		};
		this.ocultar = function() {
			removerElementos();
			adicionarElementos = function() {};
		};

		function calcularXY(elemento: HTMLElement) {
			for (x = 0, y = 0; elemento !== null; elemento = elemento.offsetParent as HTMLElement) {
				x += elemento.offsetLeft;
				y += elemento.offsetTop;
			}
		}

		function posicionarElementos() {
			img.style.top = `${y + elementoVinculado.offsetHeight}px`;
			img.style.left = `${x + elementoVinculado.offsetWidth / 2 - 15}px`;
			div.style.top = `${y + elementoVinculado.offsetHeight + 15 - 1}px`;
			div.style.left = `${x + elementoVinculado.offsetWidth / 2 - div.offsetWidth + 10}px`;
		}

		function removerElementos() {
			if (div.parentNode == document.body) {
				document.body.removeChild(div);
				document.body.removeChild(img);
			}
		}

		adicionarElementos = function() {
			document.body.appendChild(div);
			document.body.appendChild(img);
		};
	}
}

interface VLink extends HTMLAnchorElement {
	removeTrigger(): void;
	transform(): void;
}
function VirtualLink(texto: string, funcao: Function): VLink {
	const vLink = document.createElement('a');
	vLink.href = '#';
	vLink.innerHTML = texto;
	const fn = function(e: Event) {
		e.preventDefault();
		e.stopPropagation();
		funcao.call(this);
	};
	vLink.addEventListener('click', fn, false);
	return Object.assign(vLink, {
		removeTrigger() {
			vLink.removeEventListener('click', fn, false);
		},
		transform() {},
	});
}

Eproc.init();
