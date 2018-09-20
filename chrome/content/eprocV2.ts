const unsafeWindow = window.wrappedJSObject;

async function main() {
	await onDocumentEnd();
	await verificarCompatibilidadeVersao();
	await carregarEstilosPersonalizados();
	const promisePesquisa = corrigirPesquisaRapida();
	const promiseTabela = modificarTabelaProcessos();
	modificarPaginaEspecifica();
	const promiseIcones = mostrarIconesNoMenuAcoes();
	return Promise.all([promisePesquisa, promiseTabela, promiseIcones]);
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

function centralizarListaPerfis() {
	let carregado: false | HTMLStyleElement = false;
	Preferencias.on(PreferenciasExtensao.ENTRAR, habilitada => {
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

function criarBotaoDocumentosGedpro(minutas: HTMLFieldSetElement) {
	// TODO: implementar
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
		console.log('Pesquisa rápida', habilitada);
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

function modificarPaginaEspecifica() {
	const url = new URL(location.href);
	const params = url.searchParams;
	if (params.has('acao')) {
		const acao = params.get('acao') as string;
		if (Acoes.has(acao)) {
			const fn = Acoes.get(acao) as () => void;
			return fn();
		}
	}
	if (params.has('acao_origem')) {
		const acaoOrigem = params.get('acao_origem') as string;
		if (AcoesOrigem.has(acaoOrigem)) {
			const fn = AcoesOrigem.get(acaoOrigem) as () => void;
			return fn();
		}
	}
}

function modificarTabelaProcessos() {
	let carregado:
		| false
		| {
				cores: Map<HTMLElement, { original: string | null; nova: string }>;
				larguras: Map<HTMLElement, string | null>;
		  } = false;
	return Preferencias.on(PreferenciasExtensao.TABELA_PROCESSOS, habilitada => {
		if (habilitada) {
			if (!carregado) {
				const cores = new Map<HTMLElement, { original: string | null; nova: string }>();
				const larguras = new Map<HTMLElement, string | null>();
				const juizoTh = encontrarTH('SigOrgaoJuizo', 'Juízo');
				const th = encontrarTH('DesClasseJudicial', 'Classe')
					.alt(juizoTh)
					.altL(() =>
						queryAll<HTMLTableRowElement>('tr[data-classe]')
							.limit(1)
							.filterMap(tr => Maybe.fromNullable(tr.closest('table')))
							.chain(obterTHsValidos)
					)
					.altL(() => obterTHsValidos());
				if (!th.isEmpty()) {
					const table = th.filterMap(t => Maybe.fromNullable(t.closest('table')));
					table.forEach(tbl => {
						larguras.set(tbl, tbl.getAttribute('width'));
					});
					table.chain(tbl => queryAll<HTMLTableHeaderCellElement>('th', tbl)).forEach(th => {
						larguras.set(th, th.getAttribute('width'));
					});
					juizoTh.ifCons(jzo => {
						const juizoIndex = jzo.cellIndex;
						const colors = new Map([
							['A', 'black'],
							['B', 'green'],
							['C', 'red'],
							['D', 'brown'],
							['E', 'orange'],
							['F', 'black'],
							['G', 'green'],
							['H', 'red'],
						]);
						table
							.chain(tbl => List.fromArray(tbl.rows))
							.filter(tr => /infraTr(Clara|Escura)/.test(tr.className))
							.forEach(tr => {
								const juizoCell = tr.cells[juizoIndex];
								const juizoText = juizoCell.textContent || '_';
								const juizo = juizoText[juizoText.length - 1];
								if (/^\s*[A-Z]{5}TR/.test(juizoText)) {
									cores.set(juizoCell, {
										original: juizoCell.style.color,
										nova: Maybe.fromNullable(colors.get(juizo)).getOrElse('black'),
									});
								}
							});
					});
				}
				carregado = { cores, larguras };
			}
			for (const elt of carregado.larguras.keys()) {
				elt.removeAttribute('width');
			}
			for (const [elt, cor] of carregado.cores.entries()) {
				elt.style.color = cor.nova;
			}
		} else if (carregado) {
			for (const [elt, largura] of carregado.larguras.entries()) {
				if (largura) elt.setAttribute('width', largura);
			}
			for (const [elt, cor] of carregado.cores.entries()) {
				elt.style.color = cor.original;
			}
		}
	});

	function encontrarTH(campo: string, texto: string) {
		const setas = queryAll<HTMLAnchorElement>(`a[onclick="infraAcaoOrdenar('${campo}','ASC');"]`);
		if (setas.count() === 1) {
			return setas.filterMap(link => Maybe.fromNullable(link.closest('th')));
		} else {
			return queryAll<HTMLTableHeaderCellElement>('th.infraTh').filter(
				th => th.textContent === texto
			);
		}
	}
	function obterTHsValidos(context: NodeSelector = document): List<HTMLTableHeaderCellElement> {
		return queryAll<HTMLTableHeaderCellElement>('th.infraTh', context).filter(th =>
			/^Classe( Judicial)?$/.test((th.textContent || '').trim())
		);
	}
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
	query<HTMLFieldSetElement>('fieldset#fldMinutas').map(criarBotaoDocumentosGedpro);
	// TODO: último link clicado
	// TODO: fechar todas as janelas
	// TODO: largura da tabela de eventos
	// TODO: eventos referidos
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

main().then(
	x => {
		if (x) {
			console.log(x);
		}
	},
	e => {
		console.warn('Ocorreu um erro');
		console.error(e);
	}
);
