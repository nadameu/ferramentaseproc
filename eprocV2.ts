const unsafeWindow = window.wrappedJSObject;

async function main() {
	await onDocumentEnd();
	await verificarCompatibilidadeVersao();
	await carregarEstilosPersonalizados();
	return Promise.all([
		// TODO: fechar todas as janelas
		modificarTabelaProcessos(),
		modificarPaginaEspecifica(),
	]);
}

const Acoes = new Map<string, () => Promise<void>>([
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
interface Applicative<A> extends Apply<A> {
	constructor: ApplicativeTypeRep;
	ap<B>(that: Applicative<(_: A) => B>): Applicative<B>;
	map<B>(f: (_: A) => B): Applicative<B>;
}
interface ApplicativeTypeRep {
	of<A>(_: A): Applicative<A>;
}

interface Array<T> {
	traverse<U>(A: typeof Maybe, f: (_: T) => Maybe<U>): Maybe<U[]>;
	traverse<U>(A: ApplicativeTypeRep, f: (_: T) => Applicative<U>): Applicative<U[]>;
}

Array.prototype.traverse = function traverse(A: any, f: Function) {
	return this.reduce(
		(axs, x) => f(x).ap(axs.map((xs: any[]) => (x: any) => (xs.push(x), xs))),
		A.of([])
	);
};

interface GedproNodeBase {
	icones: string[];
	rotulo: string;
}

type GedproNode = GedproNodeBasico | GedproDoc;

interface GedproNodeBasico extends GedproNodeBase {
	isDoc: false;
}

interface GedproDoc extends GedproNodeBase {
	isDoc: true;
	maiorAcesso: number;
	codigo: string;
	status: string;
	statusIcone: string;
	data: string;
	criador: string;
	dataCriacao: string;
	versao: string;
	editor: string;
	dataVersao: string;
}

function parseGedproXml(xml: XMLDocument): GedproNode[] {
	const iconesReg = new Map([
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
	]);

	const iconesStatus = new Map([
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

	const statuses = new Map([
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

	return queryAll('reg', xml)
		.map(fromReg)
		.toArray();

	function fromReg(reg: Element): GedproNode {
		const icones = iconesFromReg(reg);
		const codigoTipoNodo = reg.getAttribute('codigoTipoNodo');
		switch (codigoTipoNodo) {
			case '-1':
				return fromIconesRegDocComposto(icones, reg);

			case '0':
				return fromIconesRegProcesso(icones, reg);

			case '1':
				return fromIconesRegIncidente(icones, reg);

			case '2':
				return fromIconesRegDoc(icones, reg);

			default:
				throw new Error(`Tipo de nó desconhecido: ${codigoTipoNodo}.`);
		}
	}
	function fromIconesRegDocComposto(icones: string[], reg: Element): GedproNodeBasico {
		const [tipo, id, ano] = fromElementAttributes(reg, [
			'nomeTipoDocComposto',
			'identificador',
			'ano',
		]);
		return { isDoc: false, icones, rotulo: `${tipo} ${id}/${ano}` };
	}
	function fromIconesRegProcesso(icones: string[], _: Element): GedproNodeBasico {
		return { isDoc: false, icones, rotulo: 'Documentos do Gedpro' };
	}
	function fromIconesRegIncidente(icones: string[], reg: Element): GedproNodeBasico {
		const [rotulo] = fromElementAttributes(reg, ['descricaoIncidente']);
		return { isDoc: false, icones, rotulo };
	}
	function fromIconesRegDoc(icones: string[], reg: Element): GedproDoc {
		const [
			rotulo,
			codigo,
			statusDocumento,
			data,
			criador,
			dataCriacao,
			versao,
			editor,
			dataVersao,
		] = fromElementAttributes(reg, [
			'nomeTipoDocumentoExibicao',
			'codigoDocumento',
			'statusDocumento',
			'dataDocumento',
			'siglaCriador',
			'dataCriacao',
			'numeroVersaoDocumento',
			'siglaEditor',
			'dataHoraEdicao',
		]);
		const maiorAcesso = Maybe.fromNullable(reg.getAttribute('MaiorAcesso'))
			.map(Number)
			.filter(x => !isNaN(x))
			.getOrElse(0);
		const status = statuses.get(statusDocumento);
		const statusIcone = iconesStatus.get(statusDocumento);
		if (status === undefined || statusIcone === undefined) {
			console.warn('Dados informados:', reg);
			throw new Error('Status do documento inválido.');
		}
		return {
			isDoc: true,
			icones,
			rotulo,
			maiorAcesso,
			codigo,
			status,
			statusIcone,
			data,
			criador,
			dataCriacao,
			versao,
			editor,
			dataVersao,
		};
	}
	function iconesFromReg(reg: Element): string[] {
		return Maybe.fromNullable(reg.getAttribute('icones'))
			.chain(icones => Maybe.fromNullable(icones.match(/.{3}/g)).map(xs => Array.from(xs)))
			.chain(xs => xs.traverse(Maybe, icone => Maybe.fromNullable(iconesReg.get(icone))))
			.fold(
				() => {
					throw new Error('Nó não possui ícones.');
				},
				icones => icones
			);
	}
	function fromElementAttributes(reg: Element, attributes: string[]): string[] {
		return attributes.map(attr => {
			const value = reg.getAttribute(attr);
			if (value === null) {
				console.warn('Dados informados:', reg);
				throw new Error(`Atributo não encontrado: "${attr}".`);
			}
			return value;
		});
	}
}

function renderGedproNodes(host: string, nodes: GedproNode[]): HTMLTableElement {
	const template = document.createElement('template');
	template.innerHTML = `<table class="infraTable" id="extraTblGedpro" style="font-size:12px;" cellpadding="3" border="0">
	<thead>
		<tr>
			<th class="infraTh">Documento</th>
			<th class="infraTh">Número</th>
			<th class="infraTh" colspan="2">Status</th>
			<th class="infraTh">Data Documento</th>
			<th class="infraTh">Criação</th>
			<th class="infraTh">Edição</th>
		</tr>
	</thead>
</table>`;
	const tabela = document.importNode(template.content, true).firstChild as HTMLTableElement;
	const tbody = tabela.createTBody();
	const templateLinhaBasico = document.createElement('template');
	templateLinhaBasico.innerHTML = `<tr><td colspan="7"></td></tr>`;
	const templateLinhaDoc = document.createElement('template');
	templateLinhaDoc.innerHTML = `<tr>
	<td></td>
	<td></td>
	<td></td>
	<td></td>
	<td></td>
	<td></td>
	<td></td>
</tr>`;
	let classeLinha: 'infraTrClara' | 'infraTrEscura' = 'infraTrEscura';
	const templateIcone = document.createElement('template');
	templateIcone.innerHTML = '<img class="extraGedproImg">';
	nodes.forEach(node => {
		tbody.appendChild(renderNode(node));
	});
	return tabela;

	function imageFromNomeArquivo(nomeArquivo: string): HTMLImageElement {
		const icone = document.importNode(templateIcone.content, true).firstChild as HTMLImageElement;
		icone.src = `http://${host}/images/${nomeArquivo}.gif`;
		return icone;
	}
	function renderNode(node: GedproNode): HTMLTableRowElement {
		const linha = document.importNode(
			(node.isDoc ? templateLinhaDoc : templateLinhaBasico).content,
			true
		).firstChild as HTMLTableRowElement;
		classeLinha = classeLinha === 'infraTrEscura' ? 'infraTrClara' : 'infraTrEscura';
		linha.classList.add(classeLinha);
		const celulaRotulo = linha.cells[0];
		node.icones.forEach(icone => {
			celulaRotulo.insertAdjacentElement('beforeend', imageFromNomeArquivo(icone));
		});
		celulaRotulo.insertAdjacentText('beforeend', node.rotulo);
		if (node.isDoc) return renderDoc(linha, node);
		return linha;
	}

	function renderDoc(linha: HTMLTableRowElement, node: GedproDoc): HTMLTableRowElement {
		let classeRotulo = 'extraGedproRotuloGray';
		if (node.maiorAcesso >= 2) {
			classeRotulo = 'extraGedproRotuloBlue';
			if (node.maiorAcesso >= 8) {
				classeRotulo = 'extraGedproRotuloGreen';
			}
			const link = document.createElement('a');
			link.className = 'infraLinkDocumento';
			link.dataset.doc = node.codigo;
			link.href = `http://${host}/visualizarDocumentos.asp?origem=pesquisa&ignoraframes=sim&codigoDocumento=${
				node.codigo
			}`;
			link.target = '_blank;';
			link.textContent = node.codigo;
			linha.cells[1].appendChild(link);
		} else {
			linha.cells[1].textContent = node.codigo;
		}
		linha.cells[0].classList.add(classeRotulo);
		linha.cells[2].textContent = node.status;
		linha.cells[3].appendChild(imageFromNomeArquivo(node.statusIcone));
		linha.cells[4].textContent = node.data;
		linha.cells[5].textContent = node.criador;
		linha.cells[5].insertAdjacentHTML('beforeend', '<br>');
		linha.cells[5].insertAdjacentText('beforeend', node.dataCriacao);
		linha.cells[6].textContent = `Versão ${node.versao} por ${node.editor} em`;
		linha.cells[6].insertAdjacentHTML('beforeend', '<br>');
		linha.cells[6].insertAdjacentText('beforeend', node.dataVersao);
		return linha;
	}
}

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
		const len = xs.length;
		function go(i: number): List<A> {
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
	TABELA_PROCESSOS = 'tabela-processos',
	TABELA_LOCALIZADORES = 'tabela-localizadores',
	DOCUMENTOS_GEDPRO = 'documentos-gedpro',
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
	query('.infraBarraSistema, nav.navbar').ifJust(() => {
		promises.push(adicionarLinkStylesheet('css/eprocV2.css'));
		promises.push(adicionarLinkStylesheet('css/print.css', 'print'));
	});
	return Promise.all(promises);
}

function carregarGedpro() {
	let carregado: false | { mostrar(): void; ocultar(): void } = false;
	return Preferencias.on(PreferenciasExtensao.DOCUMENTOS_GEDPRO, habilitada => {
		if (habilitada) {
			if (!carregado) {
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

function closest<K extends keyof HTMLElementTagNameMap>(
	selector: K
): (element: Element) => Maybe<HTMLElementTagNameMap[K]>;
function closest<T extends Element>(selector: string): (element: Element) => Maybe<T>;
function closest(selector: string) {
	return (element: Element) => Maybe.fromNullable(element.closest(selector));
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
			<div id="extraTabelaGedpro"></div>
			<br>
			<button id="extraGedproMaisDocs" hidden>Carregar mais documentos</button>
			<img id="extraImgGedproCarregandoMais" src="imagens/icons/loader.gif" title="Carregando" alt="Carregando" hidden>
		</div>
	</fieldset>`;
	const fieldset = document.importNode(template.content, true).firstChild as HTMLFieldSetElement;
	const toggle = fieldset.querySelector('#extraGedproToggle') as HTMLSpanElement;
	const imgMostrar = fieldset.querySelector('#extraImgGedproMostrar') as HTMLImageElement;
	const imgOcultar = fieldset.querySelector('#extraImgGedproOcultar') as HTMLImageElement;
	const imgCarregando = fieldset.querySelector('#extraImgGedproCarregando') as HTMLImageElement;
	const imgAtualizar = fieldset.querySelector('#extraImgGedproAtualizar') as HTMLImageElement;
	const conteudo = fieldset.querySelector('#extraConteudoGedpro') as HTMLDivElement;
	const espacoTabela = fieldset.querySelector('#extraTabelaGedpro') as HTMLDivElement;
	const maisDocs = fieldset.querySelector('#extraGedproMaisDocs') as HTMLButtonElement;
	const imgCarregandoMais = fieldset.querySelector(
		'#extraImgGedproCarregandoMais'
	) as HTMLImageElement;
	const lineBreak = document.createElement('br');

	let estado: 'INICIAL' | 'CARREGANDO' | 'CARREGANDO_MAIS' | 'CARREGADO' | 'FECHADO' = 'INICIAL';
	toggle.addEventListener('click', () => {
		switch (estado) {
			case 'INICIAL':
				carregarDocumentos();
				break;
			case 'CARREGANDO':
			case 'CARREGANDO_MAIS':
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
			case 'CARREGANDO_MAIS':
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

	function carregandoDocumentos() {
		estado = 'CARREGANDO';
		imgMostrar.hidden = true;
		imgOcultar.hidden = true;
		imgCarregando.hidden = false;
		conteudo.hidden = true;
		espacoTabela.textContent = '';
	}

	function carregandoMais() {
		estado = 'CARREGANDO_MAIS';
		imgMostrar.hidden = true;
		imgOcultar.hidden = true;
		imgCarregando.hidden = true;
		conteudo.hidden = false;
		maisDocs.hidden = true;
		imgCarregandoMais.hidden = false;
	}

	function carregarDocumentos() {
		carregandoDocumentos();
		obterDocumentosGedproFactory(urlGedpro, processo)
			.then(({ host, obterPagina }) => {
				let estado: false | { tabela: HTMLTableElement; pagina: number } = false;
				maisDocs.addEventListener('click', evt => {
					evt.preventDefault();
					if (estado) {
						carregarPagina(estado.pagina + 1).catch(onError);
					}
				});
				return carregarPagina(1);

				async function carregarPagina(pagina: number) {
					if (estado) {
						carregandoMais();
					}
					const xml = await obterPagina(pagina);
					const nodes = parseGedproXml(xml);
					const tabela = renderGedproNodes(host, nodes);
					if (!estado) {
						// Primeira vez que a tabela é carregada
						espacoTabela.appendChild(tabela);
					} else {
						// Já existe uma tabela com dados
						const tbody = tabela.querySelector('tbody') as HTMLTableSectionElement;
						tbody.removeChild(tbody.querySelector('tr') as HTMLTableRowElement);
						estado.tabela.appendChild(tbody);
					}
					if (nodes.length >= 21) {
						// Há mais documentos
						estado = { tabela, pagina };
						documentosCarregados(true);
					} else {
						// Não há mais documentos
						estado = false;
						documentosCarregados(false);
					}
				}
			})
			.catch(onError);

		function onError(error: any) {
			console.error(error);
			alert('Ocorreu um erro ao tentar obter os documentos do Gedpro.');
			limpar();
		}
	}

	function documentosCarregados(haMaisPaginas: boolean) {
		estado = 'CARREGADO';
		window.wrappedJSObject.analisarDocs();
		imgMostrar.hidden = true;
		imgOcultar.hidden = false;
		imgCarregando.hidden = true;
		conteudo.hidden = false;
		imgCarregandoMais.hidden = true;
		maisDocs.hidden = !haMaisPaginas;
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

type RetornoGedpro = {
	host: string;
	obterPagina(_: number): Promise<XMLDocument>;
};

async function obterDocumentosGedproFactory(
	urlGedpro: string,
	processo: string
): Promise<RetornoGedpro> {
	let cachedDocsUrl: Promise<string> = Promise.reject();
	return getXml();

	async function getXml(): Promise<RetornoGedpro> {
		cachedDocsUrl = cachedDocsUrl.catch(async () => {
			const link = await getLink(urlGedpro);
			const host = new URL(link).host;
			const loginForm = await getLoginForm(host, link);
			await getLogin(loginForm);
			const grupos = await getGrupos(host);
			return getDocsUrl(host, grupos);
		});
		const docsUrl = await cachedDocsUrl;
		const host = new URL(docsUrl).host;
		return {
			host,
			async obterPagina(pagina: number): Promise<XMLDocument> {
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
				return xml;
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

function query<T extends Element>(selector: string, context: ParentNode = document): Maybe<T> {
	return Maybe.fromNullable(context.querySelector<T>(selector));
}

function queryAll<T extends Element>(selector: string, context: ParentNode = document): List<T> {
	return List.fromArray(context.querySelectorAll<T>(selector));
}

function telaProcesso() {
	return carregarGedpro();
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
