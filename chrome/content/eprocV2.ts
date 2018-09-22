const unsafeWindow = window.wrappedJSObject;

async function main() {
	await onDocumentEnd();
	await verificarCompatibilidadeVersao();
	await carregarEstilosPersonalizados();
	return Promise.all([
		corrigirPesquisaRapida(),
		destacarUltimoLinkClicado(),
		// TODO: fechar todas as janelas
		modificarTabelaProcessos(),
		modificarPaginaEspecifica(),
		mostrarIconesNoMenuAcoes(),
	]);
}

const Acoes = new Map<string, () => Promise<void>>([
	['entrar', centralizarListaPerfis],
	['entrar_cert', centralizarListaPerfis],
	['usuario_tipo_monitoramento_localizador_listar', decorarTabelaMeusLocalizadores],
	['processo_selecionar', telaProcesso],
]);

const AcoesOrigem = new Map<string, () => Promise<void>>([
	['principal', decorarTabelaLocalizadoresPainel],
]);

interface Apply<A> {
	ap<B>(that: Apply<(_: A) => B>): Apply<B>;
	map<B>(f: (_: A) => B): Apply<B>;
}

interface Visitor {
	visit(node: GedproNode): void;
	visitDoc(doc: GedproDoc): void;
	visitNode(node: GedproNode): void;
	visitNodes(nodes: GedproNodes): void;
}
class GedproNodes extends Array<GedproNode> {
	constructor(doc: XMLDocument) {
		super();
		queryAll('reg', doc).forEach(reg => {
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

	toImg(host: string) {
		const img = document.createElement('img');
		img.className = 'extraGedproImg';
		img.src = `http://${host}/images/${this.arquivo}.gif`;
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
		this.rotulo = reg.getAttribute('nomeTipoDocumentoExibicao') as string;
		this.maiorAcesso = Number(reg.getAttribute('MaiorAcesso') as string);
		this.codigo = reg.getAttribute('codigoDocumento') as string;
		const statusDocumento = reg.getAttribute('statusDocumento') as string;
		this.status = GedproDoc.STATUSES.get(statusDocumento) as string;
		this.statusIcone = new GedproIcone(statusDocumento);
		this.data = reg.getAttribute('dataDocumento') as string;
		this.criador = reg.getAttribute('siglaCriador') as string;
		this.dataCriacao = reg.getAttribute('dataCriacao') as string;
		this.versao = reg.getAttribute('numeroVersaoDocumento') as string;
		this.editor = reg.getAttribute('siglaEditor') as string;
		this.dataVersao = reg.getAttribute('dataHoraEdicao') as string;
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
		this.rotulo = reg.getAttribute('descricaoIncidente') as string;
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
			queryAll('tbody', table).forEach(tBody => {
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
						const win = window.wrappedJSObject.documentosAbertos[`${Eproc.processo}${node.codigo}`];
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
			row.insertCell(row.cells.length).innerHTML = `Versão ${doc.versao} por ${doc.editor} em<br/>${
				doc.dataVersao
			}`;
			return row;
		},
	};
})();

class List<A> {
	constructor(readonly fold: <B>(Nil: () => B, Cons: (head: A, tail: List<A>) => B) => B) {}
	alt(that: List<A>): List<A> {
		return this.isEmpty() ? that : this;
	}
	altL(lazy: () => List<A>): List<A> {
		return this.isEmpty() ? lazy() : this;
	}
	chain<B>(f: (_: A) => List<B>): List<B> {
		return new List((N, C) =>
			this.fold(N, (x, xs) =>
				f(x)
					.concat(xs.chain(f))
					.fold(N, C)
			)
		);
	}
	concat(that: List<A>): List<A> {
		return new List((N, C) => this.fold(() => that.fold(N, C), (x, xs) => C(x, xs.concat(that))));
	}
	count(): number {
		return this.reduce(x => x + 1, 0);
	}
	every(p: (_: A) => boolean): boolean {
		let done = false;
		let current: List<A> = this;
		let acc = true;
		while (!done) {
			current.fold(
				() => {
					done = true;
				},
				(x, xs) => {
					acc = acc && p(x);
					if (!acc) done = true;
					current = xs;
				}
			);
		}
		return acc;
	}
	filter(p: (_: A) => boolean): List<A> {
		return new List((N, C) => this.fold(N, (x, xs) => (p(x) ? C(x, xs) : xs.filter(p).fold(N, C))));
	}
	filterMap<B>(f: (_: A) => Maybe<B>): List<B> {
		return new List((N, C) =>
			this.fold(N, (x, xs) =>
				f(x).fold(() => xs.filterMap(f).fold(N, C), y => C(y, xs.filterMap(f)))
			)
		);
	}
	forEach(f: (_: A) => void): void {
		let current: false | List<A> = this;
		do {
			current = current.fold<false | List<A>>(
				() => false,
				(x, xs) => {
					f(x);
					return xs;
				}
			);
		} while (current);
	}
	ifCons(f: (head: A, tail: List<A>) => void): void {
		this.fold(() => {}, f);
	}
	ifNil(f: () => void): void {
		this.fold(f, () => {});
	}
	isEmpty(): boolean {
		return this.fold(() => true, () => false);
	}
	limit(n: number): List<A> {
		return new List((N, C) => (n <= 0 ? N() : this.fold(N, (x, xs) => C(x, xs.limit(n - 1)))));
	}
	map<B>(f: (_: A) => B): List<B> {
		return new List((N, C) => this.fold(N, (x, xs) => C(f(x), xs.map(f))));
	}
	reduce<B>(f: (acc: B, _: A) => B, seed: B) {
		let acc = seed;
		this.forEach(x => {
			acc = f(acc, x);
		});
		return acc;
	}
	refine<B extends A>(p: (value: A) => value is B): List<B> {
		return this.filter(p) as List<B>;
	}
	toArray(): A[] {
		const result: A[] = [];
		this.forEach(x => result.push(x));
		return result;
	}

	static empty<A = never>(): List<A> {
		return new List((N, _) => N());
	}
	static fromArray<A>(xs: ArrayLike<A>): List<A> {
		let limit = 1e3;
		const len = xs.length;
		function go(i: number): List<A> {
			if (!limit--) throw new Error('x');
			return new List((N, C) => {
				if (i < len) {
					return C(xs[i], go(i + 1));
				}
				return N();
			});
		}
		return go(0);
	}
	static fromIterable<A>(xs: Iterable<A>): List<A> {
		let iter: Iterator<A>;
		function go(): List<A> {
			return new List((N, C) => {
				if (!iter) {
					iter = xs[Symbol.iterator]();
				}
				const result = iter.next();
				if (result.done) return N();
				return C(result.value, go());
			});
		}
		return go();
	}
}

class Maybe<A> {
	constructor(readonly fold: <B>(Nothing: () => B, Just: (_: A) => B) => B) {}
	alt(that: Maybe<A>): Maybe<A> {
		return this.fold(() => that, () => this);
	}
	altL(lazy: () => Maybe<A>): Maybe<A> {
		return this.fold(lazy, () => this);
	}
	ap<B>(that: Maybe<(_: A) => B>): Maybe<B> {
		return that.chain(f => this.map(f));
	}
	filter(p: (_: A) => boolean): Maybe<A> {
		return this.fold(() => Nothing, x => (p(x) ? Just(x) : Nothing));
	}
	ifJust(f: (_: A) => void): void {
		return this.fold(() => {}, f);
	}
	ifNothing(f: () => void): void {
		return this.fold(f, () => {});
	}
	isJust(): boolean {
		return this.fold(() => false, () => true);
	}
	isNothing(): boolean {
		return this.fold(() => true, () => false);
	}
	chain<B>(f: (_: A) => Maybe<B>): Maybe<B> {
		return this.fold(() => Nothing, f);
	}
	getOrElse(defaultValue: A): A {
		return this.fold(() => defaultValue, x => x);
	}
	getOrElseL(lazy: () => A): A {
		return this.fold(lazy, x => x);
	}
	map<B>(f: (_: A) => B): Maybe<B> {
		return this.chain(x => Just(f(x)));
	}
	mapNullable<B>(f: (_: A) => B | null | undefined): Maybe<B> {
		return this.chain(x => Maybe.fromNullable(f(x)));
	}
	refine<B extends A>(p: (value: A) => value is B): Maybe<B> {
		return this.filter(p) as Maybe<B>;
	}

	static fromNullable<A>(value: A | null | undefined): Maybe<A> {
		return value == null ? Nothing : Just(value);
	}
	static of<A>(value: A): Maybe<A> {
		return Just(value);
	}
}
function Just<A>(value: A): Maybe<A> {
	return new Maybe((_, J) => J(value));
}
const Nothing: Maybe<never> = new Maybe((N, _) => N());

const enum OrderingTag {
	LT = -1,
	EQ = 0,
	GT = +1,
}
class Ordering {
	constructor(readonly value: OrderingTag) {}

	concat(that: Ordering): Ordering {
		return this.value === OrderingTag.EQ ? that : this;
	}

	static compare<T>(a: T, b: T): Ordering {
		return new Ordering(a < b ? OrderingTag.LT : a > b ? OrderingTag.GT : OrderingTag.EQ);
	}
	static empty(): Ordering {
		return new Ordering(OrderingTag.EQ);
	}
}

class ServicoPreferencias {
	private _preferencias: Promise<{ [k in PreferenciasExtensao]: boolean | undefined }>;
	private _listeners = new Map<PreferenciasExtensao, ((_: boolean) => any)[]>();
	constructor() {
		browser.storage.onChanged.addListener((changes, areaName) => {
			if (areaName !== 'local') return;
			const changed = Object.keys(changes) as (PreferenciasExtensao)[];
			this._preferencias.then(preferencias => {
				let novasPreferencias = Object.assign({}, preferencias);
				changed.forEach(key => {
					const value = ((changes as any)[key] as browser.storage.StorageChange)
						.newValue as boolean;
					const listeners = this._listeners.get(key) || [];
					listeners.forEach(listener => {
						Promise.resolve(listener(value)).catch(err => console.error(err));
					});
					novasPreferencias[key] = value;
				});
				this._preferencias = Promise.resolve(novasPreferencias);
			});
		});
		this._preferencias = browser.storage.local.get();
	}
	async on<T>(nome: PreferenciasExtensao, listener: (_: boolean) => T | Promise<T>): Promise<T> {
		this._listeners.set(nome, (this._listeners.get(nome) || []).concat([listener]));
		return this._preferencias
			.then(prefs => prefs[nome])
			.then(value => (value === undefined ? true : value))
			.then(listener);
	}
}

const Preferencias = new ServicoPreferencias();

const enum PreferenciasExtensao {
	PESQUISA_RAPIDA = 'pesquisa-rapida',
	TABELA_PROCESSOS = 'tabela-processos',
	ICONES_ACOES = 'icones-acoes',
	ENTRAR = 'entrar',
	TABELA_LOCALIZADORES = 'tabela-localizadores',
	DOCUMENTOS_GEDPRO = 'documentos-gedpro',
	EVENTOS_REFERIDOS = 'eventos-referidos',
	ULTIMO_CLICADO = 'ultimo-clicado',
	FECHAR_JANELAS = 'fechar-janelas',
}

function adicionarEstilos(css: string) {
	const template = document.createElement('template');
	template.innerHTML = `<style>${css}</style>`;
	const style = document.importNode(template.content, true).firstElementChild as HTMLStyleElement;
	document.head.appendChild(style);
	return style;
}

function adicionarLinkStylesheet(path: string, media: 'print' | 'screen' = 'screen') {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.media = media;
	const promise = new Promise<HTMLLinkElement>((resolve, reject) => {
		function removeListeners() {
			link.removeEventListener('load', onload);
			link.removeEventListener('error', onerror);
		}
		function onload() {
			removeListeners();
			resolve(link);
		}
		function onerror(e: Event) {
			removeListeners();
			reject(e);
		}
		link.addEventListener('load', onload);
		link.addEventListener('error', onerror);
	});
	link.href = browser.runtime.getURL(path);
	document.head.appendChild(link);
	return promise;
}

function carregarEstilosPersonalizados() {
	const promises: Promise<HTMLLinkElement>[] = [];
	query('.infraBarraSistema').ifJust(() => {
		promises.push(adicionarLinkStylesheet('chrome/skin/eprocV2.css'));
		promises.push(adicionarLinkStylesheet('chrome/skin/print.css', 'print'));
		query<HTMLLinkElement>('link[href^="css/estilos.php?skin="]').ifJust(estilosPersonalizados => {
			const result = /\?skin=([^&]*)/.exec(estilosPersonalizados.href) as RegExpExecArray;
			const skins = new Map([['elegant', 'candy'], ['minimalist', 'icecream']]);
			const skin = skins.has(result[1]) ? (skins.get(result[1]) as string) : 'stock';
			promises.push(adicionarLinkStylesheet(`chrome/skin/${skin}-extra.css`));
		});
	});
	return Promise.all(promises);
}

function carregarGedpro() {
	let carregado: false | { mostrar(): void; ocultar(): void } = false;
	return Preferencias.on(PreferenciasExtensao.DOCUMENTOS_GEDPRO, habilitada => {
		if (habilitada) {
			if (!carregado) {
				// TODO: implementar
				carregado = liftA3(
					query<HTMLFieldSetElement>('fieldset#fldMinutas'),
					query<HTMLAnchorElement>(
						'#fldAcoes center a[href^="controlador.php?acao=acessar_processo_gedpro&"]'
					).map(x => new URL(x.href, location.href).href),
					Maybe.fromNullable(new URL(location.href).searchParams.get('num_processo')),
					(minutas, urlGedpro, processo) => criarAreaGedpro(minutas, urlGedpro, processo)
				).getOrElse({ mostrar() {}, ocultar() {} });
			}
			carregado.mostrar();
		} else if (carregado) {
			carregado.ocultar();
		}
	});
}

function centralizarListaPerfis() {
	let carregado: false | HTMLStyleElement = false;
	return Preferencias.on(PreferenciasExtensao.ENTRAR, habilitada => {
		if (habilitada) {
			if (!carregado) {
				carregado = adicionarEstilos('#fldLogin { position: static; margin: 6% auto; }');
			}
		} else if (carregado) {
			document.head.removeChild(carregado);
			carregado = false;
		}
	});
}

function closest<K extends keyof HTMLElementTagNameMap>(
	selector: K
): (element: Element) => Maybe<HTMLElementTagNameMap[K]>;
function closest<T extends Element>(selector: string): (element: Element) => Maybe<T>;
function closest(selector: string) {
	return (element: Element) => Maybe.fromNullable(element.closest(selector));
}

function complementarEventosReferidos() {
	let carregado:
		| false
		| {
				eventosReferentes: Map<number, HTMLTableCellElement[]>;
				eventosReferidos: Map<number, string>;
		  } = false;
	return Preferencias.on(PreferenciasExtensao.EVENTOS_REFERIDOS, habilitada => {
		if (habilitada) {
			if (!carregado) {
				const eventosReferentes = new Map<number, HTMLTableCellElement[]>();
				const eventosReferidos = new Map<number, string>();
				query<HTMLTableElement>('table#tblEventos').map(tabela => {
					queryAll<HTMLTableRowElement>(
						'tr[class^="infraTr"], tr[bgcolor="#FFFACD"]',
						tabela
					).forEach(tr => {
						const colunaDescricao = Just(tr.cells.length - 3)
							.filter(x => x >= 0)
							.map<HTMLTableCellElement>(i => tr.cells[i]);
						const eventoReferente = colunaDescricao
							.chain(obterTexto)
							.mapNullable(x => x.match(/Refer\. ao Evento: (\d+)$/))
							.map(x => Number(x[1]));
						liftA2(eventoReferente, colunaDescricao, (ev, col) => {
							eventosReferentes.set(ev, (eventosReferentes.get(ev) || []).concat([col]));
						}).altL(() => {
							if (query('.infraEventoPrazoParte', tr).isNothing()) return Nothing;
							const numeroEvento = Just(tr.cells.length - 5)
								.filter(x => x >= 0)
								.map<HTMLTableCellElement>(i => tr.cells[i])
								.chain(obterTexto)
								.mapNullable(x => x.match(/\d+/))
								.map(x => Number(x[0]));
							if (!numeroEvento.map(ev => eventosReferentes.has(ev)).getOrElse(false))
								return Nothing;
							const segundaLinha = colunaDescricao
								.mapNullable(x => x.innerHTML.split('<br>'))
								.filter(xs => xs.length > 1)
								.map(xs => xs[1]);
							return liftA2(numeroEvento, segundaLinha, (ev, seg) => {
								if (eventosReferentes.has(ev)) {
									eventosReferidos.set(ev, seg);
								}
							});
						});
					});
				});
				carregado = { eventosReferentes, eventosReferidos };
			}
			for (const [ev, colunas] of carregado.eventosReferentes.entries()) {
				const texto = carregado.eventosReferidos.get(ev);
				if (texto) {
					colunas.forEach(coluna => {
						coluna.insertAdjacentHTML(
							'beforeend',
							`<span class="extraReferente noprint"><br>${texto}</span>`
						);
					});
				}
			}
		} else if (carregado) {
			queryAll('.extraReferente').forEach(elt => {
				(elt.parentNode as Node).removeChild(elt);
			});
		}
	});

	function obterTexto(node: Node): Maybe<string> {
		return Just((node.textContent || '').trim()).filter(x => x !== '');
	}
}

function corrigirPesquisaRapida() {
	let carregado:
		| false
		| Maybe<{
				input: HTMLInputElement;
				value: string | null;
				style: string | null;
				onfocus: string | null;
		  }> = false;
	return Preferencias.on(PreferenciasExtensao.PESQUISA_RAPIDA, habilitada => {
		if (habilitada) {
			if (!carregado) {
				carregado = query('#txtNumProcessoPesquisaRapida')
					.refine((x: Element): x is HTMLInputElement => x.matches('input'))
					.filter(input => 'placeholder' in input)
					.map(input => ({
						input,
						value: input.getAttribute('value'),
						style: input.getAttribute('style'),
						onfocus: input.getAttribute('onfocus'),
					}));
			}
			carregado.ifJust(({ input }) => {
				input.setAttribute('placeholder', 'Pesquisa');
				input.removeAttribute('value');
				input.setAttribute('style', 'font-size: 1.1em;');
				input.removeAttribute('onfocus');
			});
		} else if (carregado) {
			carregado.ifJust(({ input, value, style, onfocus }) => {
				input.removeAttribute('placeholder');
				if (value) {
					input.setAttribute('value', value);
					if (input.value === '') input.value = value;
				}
				if (style) input.setAttribute('style', style);
				if (onfocus) input.setAttribute('onfocus', onfocus);
			});
		}
	});
}

function criarAreaGedpro(
	minutas: HTMLFieldSetElement,
	urlGedpro: string,
	processo: string
): { mostrar(): void; ocultar(): void } {
	const template = document.createElement('template');
	template.innerHTML = `<fieldset id="extraFldGedpro" class="infraFieldset noprint">
		<legend class="infraLegendObrigatorio" style="cursor:pointer;">
			<span id="extraGedproToggle" style="font-weight: bold;">
				<img id="extraImgGedproMostrar" src="infra_css/imagens/ver_tudo.gif" title="Mostrar" alt="Mostrar" style="width: 1.1em; height: 1.1em;">
				<img id="extraImgGedproOcultar" src="infra_css/imagens/ver_resumo.gif" title="Ocultar" alt="Ocultar" style="width: 1.1em; height: 1.1em;" hidden>
				<img id="extraImgGedproCarregando" src="imagens/icons/loader.gif" title="Carregando" alt="Carregando" style="width: 1.1em; height: 1.1em;" hidden>
				Gedpro &nbsp;&nbsp;
			</span>
			<img id="extraImgGedproAtualizar" src="imagens/icons/refresh.gif" title="Atualizar" alt="Atualizar" style="width: 0.94em; height: 1.1em;">
		</legend>
		<div id="extraConteudoGedpro" hidden>
			<table class="infraTable" id="extraTblGedpro" style="font-size:12px;" cellpadding="3" border="0">
				<thead>
					<tr>
						<th class="infraTh">Documento</th>
						<th class="infraTh">Número</th>
						<th class="infraTh">Status</th>
						<th class="infraTh">Data Documento</th>
						<th class="infraTh">Criação</th>
						<th class="infraTh">Edição</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td colspan="999">Sem minutas para este usuário</td>
					</tr>
					<tr class="infraTrClara">
						<td>Sentença</td>
						<td>9999999</td>
						<td>Assinado<img src="http://gedpro.jfsc.jus.br/images/assinatura.gif"></td>
						<td>dd/mm/aaaa</td>
						<td>XXX<br>dd/mm/aaaa</td>
						<td>Versão 3 por YYY em<br>dd/mm/aaaa</td>
					</tr>
					<tr class="infraTrEscura">
						<td>Sentença</td>
						<td>9999999</td>
						<td>Assinado<img src="http://gedpro.jfsc.jus.br/images/assinatura.gif"></td>
						<td>dd/mm/aaaa</td>
						<td>XXX<br>dd/mm/aaaa</td>
						<td>Versão 3 por YYY em<br>dd/mm/aaaa</td>
					</tr>
				</tbody>
			</table>
		</div>
	</fieldset>`;
	const fieldset = document.importNode(template.content, true).firstChild as HTMLFieldSetElement;
	const toggle = fieldset.querySelector('#extraGedproToggle') as HTMLSpanElement;
	const imgMostrar = fieldset.querySelector('#extraImgGedproMostrar') as HTMLImageElement;
	const imgOcultar = fieldset.querySelector('#extraImgGedproOcultar') as HTMLImageElement;
	const imgCarregando = fieldset.querySelector('#extraImgGedproCarregando') as HTMLImageElement;
	const imgAtualizar = fieldset.querySelector('#extraImgGedproAtualizar') as HTMLImageElement;
	const conteudo = fieldset.querySelector('#extraConteudoGedpro') as HTMLDivElement;
	const tabela = fieldset.querySelector('#extraTblGedpro') as HTMLTableElement;
	const lineBreak = document.createElement('br');

	let estado: 'INICIAL' | 'CARREGANDO' | 'CARREGADO' | 'FECHADO' = 'INICIAL';
	toggle.addEventListener('click', () => {
		switch (estado) {
			case 'INICIAL':
				carregarDocumentos();
				break;
			case 'CARREGANDO':
				break;
			case 'CARREGADO':
				ocultarDocumentos();
				break;
			case 'FECHADO':
				mostrarDocumentos();
				break;
		}
	});

	imgAtualizar.addEventListener('click', () => {
		switch (estado) {
			case 'INICIAL':
			case 'CARREGADO':
			case 'FECHADO':
				carregarDocumentos();
				break;

			case 'CARREGANDO':
				break;
		}
	});

	function limpar() {
		estado = 'INICIAL';
		imgMostrar.hidden = false;
		imgOcultar.hidden = true;
		imgCarregando.hidden = true;
		conteudo.hidden = true;
	}

	function carregarDocumentos() {
		estado = 'CARREGANDO';
		imgMostrar.hidden = true;
		imgOcultar.hidden = true;
		imgCarregando.hidden = false;
		conteudo.hidden = true;
		obterDocumentosGedpro(urlGedpro, processo).then(
			({ xml, obterPagina }) => {
				const nodes = new GedproNodes(xml);
				console.log('Nós', nodes);
				GedproTabela.visit(nodes);
				minutas.insertAdjacentElement('afterend', GedproTabela.getTable());
				documentosCarregados();
			},
			(error: any) => {
				console.error(error);
				alert('Ocorreu um erro ao tentar obter os documentos do Gedpro.');
				limpar();
			}
		);
	}

	function documentosCarregados() {
		estado = 'CARREGADO';
		imgMostrar.hidden = true;
		imgOcultar.hidden = false;
		imgCarregando.hidden = true;
		conteudo.hidden = false;
	}

	function ocultarDocumentos() {
		estado = 'FECHADO';
		imgMostrar.hidden = false;
		imgOcultar.hidden = true;
		imgCarregando.hidden = true;
		conteudo.hidden = true;
	}

	function mostrarDocumentos() {
		estado = 'CARREGADO';
		imgMostrar.hidden = true;
		imgOcultar.hidden = false;
		imgCarregando.hidden = true;
		conteudo.hidden = false;
	}

	minutas.insertAdjacentElement('afterend', lineBreak);
	lineBreak.insertAdjacentElement('afterend', fieldset);
	return {
		mostrar() {
			fieldset.hidden = false;
			lineBreak.hidden = false;
		},
		ocultar() {
			fieldset.hidden = true;
			lineBreak.hidden = true;
		},
	};
}

function decorarTabelaLocalizadores(linhas: List<HTMLTableRowElement>) {
	let carregado:
		| false
		| {
				linhas: Map<HTMLTableRowElement, string>;
				listeners: Map<HTMLTableRowElement, () => void>;
		  } = false;
	return Preferencias.on(PreferenciasExtensao.TABELA_LOCALIZADORES, habilitada => {
		if (habilitada) {
			if (!carregado) {
				const linhasSalvas = new Map<HTMLTableRowElement, string>();
				const listeners = new Map<HTMLTableRowElement, () => void>();
				linhas.forEach(linha => {
					const maybeLink = getLink(linha);
					const maybeURL = maybeLink.chain(getUrl);
					const processos = maybeLink.chain(getQtdProcessos).getOrElse(0);
					linhasSalvas.set(linha, processos.toString());
					maybeURL.map(url => {
						listeners.set(linha, () => (location.href = url));
					});
				});
				carregado = { linhas: linhasSalvas, listeners };
			}
			for (const [linha, processos] of carregado.linhas.entries()) {
				linha.classList.add('extraLocalizador');
				linha.setAttribute('data-processos', processos);
			}
			for (const [linha, listener] of carregado.listeners.entries()) {
				linha.addEventListener('click', listener);
			}
		} else if (carregado) {
			for (const linha of carregado.linhas.keys()) {
				linha.classList.remove('extraLocalizador');
				linha.removeAttribute('data-processos');
			}
			for (const [linha, listener] of carregado.listeners.entries()) {
				linha.removeEventListener('click', listener);
			}
		}
	});

	function getLink(tr: HTMLTableRowElement) {
		return Maybe.fromNullable(tr.cells[1]).chain(cell => query<HTMLAnchorElement>('a', cell));
	}

	function getUrl(a: HTMLAnchorElement) {
		return Maybe.fromNullable(a.href)
			.filter(x => x !== '')
			.alt(Maybe.fromNullable(a.getAttribute('onclick')).map(onclick => `javascript:${onclick}`));
	}

	function getQtdProcessos(a: HTMLAnchorElement) {
		return Maybe.fromNullable(a.textContent)
			.map(Number)
			.filter(x => !isNaN(x));
	}
}

function decorarTabelaLocalizadoresPainel() {
	return decorarTabelaLocalizadores(
		queryAll('#fldProcessos tr[class^="infraTr"], #fldLocalizadores tr[class^="infraTr"]')
	);
}

function decorarTabelaMeusLocalizadores() {
	return decorarTabelaLocalizadores(
		queryAll<HTMLTableRowElement>('#divInfraAreaTabela tr[class^="infraTr"]')
	);
}

function destacarUltimoLinkClicado() {
	let carregado: false | ((_: MouseEvent) => void) = false;
	return Preferencias.on(PreferenciasExtensao.ULTIMO_CLICADO, habilitada => {
		if (habilitada) {
			if (!carregado) {
				carregado = evt => {
					Maybe.fromNullable(evt.target)
						.refine(
							(elt): elt is HTMLAnchorElement =>
								(elt as Node).nodeType === Node.ELEMENT_NODE &&
								(elt as Element).matches('a[data-doc]')
						)
						.ifJust(link => {
							query('#extraUltimoLinkClicado').ifJust(link => link.removeAttribute('id'));
							link.setAttribute('id', 'extraUltimoLinkClicado');
						});
				};
			}
			document.body.addEventListener('click', carregado);
		} else if (carregado) {
			document.body.removeEventListener('click', carregado);
		}
	});
}

function liftA2<A, B, C>(mx: Maybe<A>, my: Maybe<B>, f: (x: A, y: B) => C): Maybe<C>;
function liftA2<A, B, C>(ax: Apply<A>, ay: Apply<B>, f: (x: A, y: B) => C): Apply<C> {
	return ay.ap(ax.map((x: A) => (y: B) => f(x, y)));
}

function liftA3<A, B, C, D>(
	mx: Maybe<A>,
	my: Maybe<B>,
	mz: Maybe<C>,
	f: (x: A, y: B, z: C) => D
): Maybe<D>;
function liftA3<A, B, C, D>(
	ax: Apply<A>,
	ay: Apply<B>,
	az: Apply<C>,
	f: (x: A, y: B, z: C) => D
): Apply<D> {
	return az.ap(ay.ap(ax.map((x: A) => (y: B) => (z: C) => f(x, y, z))));
}

function modificarPaginaEspecifica() {
	const url = new URL(location.href);
	const params = url.searchParams;
	if (params.has('acao')) {
		const acao = params.get('acao') as string;
		if (Acoes.has(acao)) {
			const fn = Acoes.get(acao) as () => Promise<void>;
			return fn();
		}
	}
	if (params.has('acao_origem')) {
		const acaoOrigem = params.get('acao_origem') as string;
		if (AcoesOrigem.has(acaoOrigem)) {
			const fn = AcoesOrigem.get(acaoOrigem) as () => Promise<void>;
			return fn();
		}
	}
	return Promise.resolve();
}

function modificarTabelaProcessos() {
	let carregado: false | Map<HTMLElement, string | null> = false;
	return Preferencias.on(PreferenciasExtensao.TABELA_PROCESSOS, habilitada => {
		if (habilitada) {
			if (!carregado) {
				const table = queryAll(`a[onclick="infraAcaoOrdenar('NumProcesso','ASC');"]`)
					.filterMap<HTMLElement>(closest('th'))
					.altL(() => queryAll('tr[data-classe]'))
					.limit(1)
					.filterMap(closest('table'));
				carregado = new Map(
					(table as List<HTMLElement>)
						.concat(table.chain(tbl => queryAll('th', tbl)))
						.map(elt => [elt, elt.getAttribute('width')] as [HTMLElement, string | null])
						.toArray()
				);
			}
			for (const elt of carregado.keys()) {
				elt.removeAttribute('width');
			}
		} else if (carregado) {
			for (const [elt, largura] of carregado.entries()) {
				if (largura) elt.setAttribute('width', largura);
			}
		}
	});
}

function mostrarIconesNoMenuAcoes() {
	const maybeFieldset = query<HTMLFieldSetElement>('fieldset#fldAcoes');
	const maybeLegend = maybeFieldset.chain(fieldset =>
		query<HTMLLegendElement>(':scope > legend', fieldset)
	);
	return liftA2(maybeFieldset, maybeLegend, async (fieldset, legend) => {
		const acoes = queryAll<HTMLAnchorElement>(':scope > center a', fieldset);
		if (acoes.isEmpty()) return [];

		const botoesNoMenuAcoes = acoes.every(acao => acao.classList.contains('infraButton'));
		if (!botoesNoMenuAcoes) return [];

		const template = document.createElement('template');
		template.innerHTML = `<div class="extraAcoesOpcoes noprint"><input type="checkbox" id="chkMostrarIcones"><label for="chkMostrarIcones"> Mostrar Ícones</label></div>`;
		const content = document.importNode(template.content, true);
		const chkMostrarIcones = content.querySelector('#chkMostrarIcones') as HTMLInputElement;
		const key = PreferenciasExtensao.ICONES_ACOES;
		chkMostrarIcones.addEventListener('change', () => {
			browser.storage.local.set({ [key]: chkMostrarIcones.checked });
		});
		legend.appendChild(content);

		let carregado = false;

		return Preferencias.on(PreferenciasExtensao.ICONES_ACOES, async mostrarIcones => {
			fieldset.classList.toggle('extraAcoesMostrarIcones', mostrarIcones);
			chkMostrarIcones.checked = mostrarIcones;
			if (mostrarIcones && !carregado) {
				const iconeTemplate = document.createElement('template');
				iconeTemplate.innerHTML = '<img alt=" " class="extraIconeAcao noprint">';
				function criarIcone(src: string): (_: HTMLAnchorElement) => Promise<HTMLImageElement> {
					return function criarIcone(link) {
						const icone = document.importNode(iconeTemplate.content, true)
							.firstElementChild as HTMLImageElement;
						return new Promise((resolve, reject) => {
							function onload(_: Event) {
								removeListeners();
								resolve(icone);
							}
							function onerror(e: Event) {
								removeListeners();
								reject(e);
							}
							function removeListeners() {
								icone.removeEventListener('load', onload);
								icone.removeEventListener('error', onerror);
							}
							icone.addEventListener('load', onload);
							icone.addEventListener('error', onerror);
							link.insertAdjacentElement('afterbegin', icone);
							icone.src = src;
						});
					};
				}
				function ChromeIcone(arquivo: string): (_: HTMLAnchorElement) => Promise<HTMLImageElement> {
					return criarIcone(browser.runtime.getURL(`chrome/skin/${arquivo}`));
				}
				function InfraIcone(arquivo: string): (_: HTMLAnchorElement) => Promise<HTMLImageElement> {
					return criarIcone(`infra_css/imagens/${arquivo}`);
				}

				const icones = new Map([
					['acessar_processo_gedpro', ChromeIcone('ie.png')],
					['acesso_usuario_processo_cadastrar', InfraIcone('menos.gif')],
					['arvore_documento_listar', ChromeIcone('tree.gif')],
					['audiencia_listar', ChromeIcone('microphone.png')],
					['criar_mandado', ChromeIcone('knight-crest.gif')],
					['gerenciamento_partes_listar', InfraIcone('grupo.gif')],
					['gerenciamento_partes_situacao_listar', InfraIcone('marcar.gif')],
					['gerenciamento_peritos_listar', ChromeIcone('graduation-hat.png')],
					['intimacao_bloco_filtrar', InfraIcone('versoes.gif')],
					['oficio_requisitorio_listar', ChromeIcone('money.png')],
					['processo_agravar', InfraIcone('atualizar.gif')],
					['processo_apelacao', ChromeIcone('up.png')],
					['processo_cadastrar', InfraIcone('atualizar.gif')],
					['processo_citacao', ChromeIcone('newspaper.png')],
					['processo_consultar', InfraIcone('lupa.gif')],
					['processo_edicao', InfraIcone('assinar.gif')],
					['processo_expedir_carta_subform', InfraIcone('email.gif')],
					['processo_gerenciar_proc_individual_listar', InfraIcone('marcar.gif')],
					['processo_intimacao', InfraIcone('encaminhar.gif')],
					['processo_intimacao_aps_bloco', InfraIcone('transportar.gif')],
					['processo_intimacao_bloco', InfraIcone('encaminhar.gif')],
					['processo_lembrete_destino_cadastrar', InfraIcone('tooltip.gif')],
					['processo_movimento_consultar', InfraIcone('receber.gif')],
					['processo_movimento_desativar_consulta', InfraIcone('remover.gif')],
					['processo_remessa_tr', ChromeIcone('up.png')],
					['processo_requisicao_cef', ChromeIcone('predio.png')],
					['procurador_parte_associar', InfraIcone('mais.gif')],
					['procurador_parte_listar', InfraIcone('mais.gif')],
					['redistribuicao_entre_secoes', InfraIcone('hierarquia.gif')],
					['redistribuicao_processo', InfraIcone('hierarquia.gif')],
					['requisicao_pagamento_cadastrar', ChromeIcone('money.png')],
					['selecionar_processos_agendar_arquivo_completo', InfraIcone('pdf.gif')],
					['selecionar_processos_remessa_instancia_superior', ChromeIcone('up.png')],
					['selecionar_processos_remessa_instancia_superior_stf', ChromeIcone('up.png')],
				]);

				const promises: Promise<HTMLImageElement>[] = [];
				acoes.forEach(link => {
					const url = new URL(link.href);
					const params = url.searchParams;
					if (params.has('acao')) {
						const acao = params.get('acao') as string;
						if (icones.has(acao)) {
							const adicionarIcone = icones.get(acao) as (
								_: HTMLAnchorElement
							) => Promise<HTMLImageElement>;
							promises.push(adicionarIcone(link));
						}
					}
				});

				carregado = true;
				return Promise.all(promises);
			}
			return Promise.resolve([]);
		});
	}).getOrElse(Promise.resolve([]));
}

function onDocumentStart() {
	return Promise.resolve();
}

function onDocumentEnd() {
	return new Promise(res => {
		if (document.readyState === 'loading') {
			document.addEventListener('readystatechange', checkState);
		} else {
			checkState();
		}

		function checkState() {
			if (['interactive', 'complete'].includes(document.readyState)) {
				res();
			}
		}
	});
}

function onDocumentIdle() {
	return new Promise(res => {
		if (['loading', 'interactive'].includes(document.readyState)) {
			document.addEventListener('readystatechange', checkState);
		} else {
			checkState();
		}

		function checkState() {
			if (document.readyState === 'complete') {
				res();
			}
		}
	});
}

type RetornoGedpro = { xml: XMLDocument; obterPagina(_: number): Promise<RetornoGedpro> };

async function obterDocumentosGedpro(urlGedpro: string, processo: string): Promise<RetornoGedpro> {
	let cachedDocsUrl: Promise<string> = Promise.reject();
	return getXml();

	async function getXml(pagina = 1): Promise<RetornoGedpro> {
		cachedDocsUrl = cachedDocsUrl.catch(async () => {
			const link = await getLink(urlGedpro);
			const host = new URL(link).host;
			const loginForm = await getLoginForm(host, link);
			await getLogin(loginForm);
			const grupos = await getGrupos(host);
			return getDocsUrl(host, grupos);
		});
		const docsUrl = await cachedDocsUrl;
		const response = await fetch(`${docsUrl}&pgtree=${pagina}`, {
			credentials: 'include',
		});
		const blob = await response.blob();
		const text = await new Promise<string>(resolve => {
			const reader = new FileReader();
			reader.addEventListener('loadend', () => resolve(reader.result as string), {
				once: true,
			});
			reader.readAsText(blob);
		});
		const parser = new DOMParser();
		const xml = parser.parseFromString(text, 'application/xml') as XMLDocument;
		return {
			xml,
			obterPagina(pagina: number) {
				return getXml(pagina);
			},
		};
	}

	async function getLink(linkUrl: string) {
		const response = await fetch(linkUrl, {
			credentials: 'include',
			method: 'HEAD',
			headers: new Headers({ 'X-Ferramentas-e-Proc': '1' }),
		});
		const link = await response.headers.get('X-Ferramentas-e-Proc-Redirect');
		if (link === null) {
			throw new Error('Não foi possível obter o endereço do Gedpro.');
		}
		return link;
	}

	async function getLoginForm(host: string, link: string): Promise<string> {
		const response = await fetch(link, { credentials: 'include' });
		const text = await response.text();
		const formLogin = /FormLogin\.asp\?[^"]+/.exec(text);
		const mainframePage = /\/mainframe\.asp\?[^"]+/.exec(text);
		if (formLogin) {
			return `http://${host}/${formLogin[0]}`;
		} else if (mainframePage) {
			return getLoginForm(host, `http://${host}${mainframePage[0]}`);
		} else {
			throw new Error('Não foi possível obter o link de requisição de login.');
		}
	}

	async function getLogin(loginForm: string) {
		const response = await fetch(loginForm, { credentials: 'include' });
		const text = await response.text();
		if (/<!-- Erro /.test(text)) {
			throw new Error('Não é possível fazer login no GEDPRO.');
		} else {
			return true;
		}
	}

	async function getGrupos(host: string) {
		const response = await fetch(
			`http://${host}/arvore2.asp?modulo=Textos do Processo&processo=${processo}&numeroProcessoVisual=NPV&localizadorProcesso=LP`,
			{ credentials: 'include' }
		);
		const text = await response.text();
		const match = text.match(/&grupos=([^&]+)&/);
		if (!match) {
			alert(
				'Não foi possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.'
			);
			return '11,28,82';
		}
		return match[1];
	}

	function getDocsUrl(host: string, grupos: string) {
		return `http://${host}/XMLInterface.asp?processo=${processo}&ProcessoVisual=PV&grupos=${grupos}`;
	}
}

async function obterPreferenciaExtensao<T>(nome: string, valorPadrao: T): Promise<T> {
	const result = await browser.storage.local.get({ [nome]: valorPadrao });
	return result[nome];
}

function query<T extends Element>(selector: string, context: NodeSelector = document): Maybe<T> {
	return Maybe.fromNullable(context.querySelector<T>(selector));
}

function queryAll<T extends Element>(selector: string, context: NodeSelector = document): List<T> {
	return List.fromArray(context.querySelectorAll<T>(selector));
}

function telaProcesso() {
	return Promise.all([carregarGedpro(), complementarEventosReferidos()]).then(() => {});
}

async function verificarCompatibilidadeVersao() {
	if (!unsafeWindow.FeP) return;
	const numeroVersaoCompativel = unsafeWindow.FeP.numeroVersaoCompativel;
	const numeroVersaoInstalada = browser.runtime.getManifest().version;
	const [comp, inst] = [numeroVersaoCompativel, numeroVersaoInstalada].map(x =>
		x.split('.').map(x => parseInt(x, 10))
	);
	while (comp.length < inst.length) comp.push(0);
	while (inst.length < comp.length) inst.push(0);
	const result = inst.reduce(
		(acc, x, i) => acc.concat(Ordering.compare(x, comp[i])),
		Ordering.empty()
	);
	const versaoUsuarioCompativel = result.value !== OrderingTag.LT;
	unsafeWindow.FeP.versaoUsuarioCompativel = versaoUsuarioCompativel;
	if (!versaoUsuarioCompativel) {
		// Permite que o e-Proc detecte a extensão instalada
		document.head.appendChild(document.createElement('style'));
		throw new Error('Extensão é incompatível com a versão atual do e-Proc.');
	}
}

main().catch(e => {
	console.warn('Ocorreu um erro');
	console.error(e);
});
