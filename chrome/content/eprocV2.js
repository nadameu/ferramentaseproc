"use strict";
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
const Acoes = new Map([
    ['entrar', centralizarListaPerfis],
    ['entrar_cert', centralizarListaPerfis],
    ['usuario_tipo_monitoramento_localizador_listar', decorarTabelaMeusLocalizadores],
    ['processo_selecionar', telaProcesso],
]);
const AcoesOrigem = new Map([
    ['principal', decorarTabelaLocalizadoresPainel],
]);
Array.prototype.traverse = function traverse(A, f) {
    return this.reduce((axs, x) => f(x).ap(axs.map((xs) => (x) => (xs.push(x), xs))), A.of([]));
};
function parseGedproXml(xml) {
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
        ['0', 'documento'],
        ['1', 'chave'],
        ['2', 'valida'],
        ['3', 'assinatura'],
        ['4', 'fase'],
        ['5', 'procedimentos'],
        ['6', 'localizador'],
        ['7', 'excluidos'],
        ['8', 'abrirbloco'],
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
    function fromReg(reg) {
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
    function fromIconesRegDocComposto(icones, reg) {
        const [tipo, id, ano] = fromElementAttributes(reg, [
            'nomeTipoDocComposto',
            'identificador',
            'ano',
        ]);
        return { isDoc: false, icones, rotulo: `${tipo} ${id}/${ano}` };
    }
    function fromIconesRegProcesso(icones, _) {
        return { isDoc: false, icones, rotulo: 'Documentos do Gedpro' };
    }
    function fromIconesRegIncidente(icones, reg) {
        const [rotulo] = fromElementAttributes(reg, ['descricaoIncidente']);
        return { isDoc: false, icones, rotulo };
    }
    function fromIconesRegDoc(icones, reg) {
        const [rotulo, codigo, statusDocumento, data, criador, dataCriacao, versao, editor, dataVersao,] = fromElementAttributes(reg, [
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
    function iconesFromReg(reg) {
        return Maybe.fromNullable(reg.getAttribute('icones'))
            .chain(icones => Maybe.fromNullable(icones.match(/.{3}/g)).map(xs => Array.from(xs)))
            .chain(xs => xs.traverse(Maybe, icone => Maybe.fromNullable(iconesReg.get(icone))))
            .fold(() => {
            throw new Error('Nó não possui ícones.');
        }, icones => icones);
    }
    function fromElementAttributes(reg, attributes) {
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
function renderGedproNodes(host, nodes) {
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
    const tabela = document.importNode(template.content, true).firstChild;
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
    let classeLinha = 'infraTrEscura';
    const templateIcone = document.createElement('template');
    templateIcone.innerHTML = '<img class="extraGedproImg">';
    nodes.forEach(node => {
        tbody.appendChild(renderNode(node));
    });
    return tabela;
    function imageFromNomeArquivo(nomeArquivo) {
        const icone = document.importNode(templateIcone.content, true).firstChild;
        icone.src = `http://${host}/images/${nomeArquivo}.gif`;
        return icone;
    }
    function renderNode(node) {
        const linha = document.importNode((node.isDoc ? templateLinhaDoc : templateLinhaBasico).content, true).firstChild;
        classeLinha = classeLinha === 'infraTrEscura' ? 'infraTrClara' : 'infraTrEscura';
        linha.classList.add(classeLinha);
        const celulaRotulo = linha.cells[0];
        node.icones.forEach(icone => {
            celulaRotulo.insertAdjacentElement('beforeend', imageFromNomeArquivo(icone));
        });
        celulaRotulo.insertAdjacentText('beforeend', node.rotulo);
        if (node.isDoc)
            return renderDoc(linha, node);
        return linha;
    }
    function renderDoc(linha, node) {
        let classeRotulo = 'extraGedproRotuloGray';
        if (node.maiorAcesso >= 2) {
            classeRotulo = 'extraGedproRotuloBlue';
            if (node.maiorAcesso >= 8) {
                classeRotulo = 'extraGedproRotuloGreen';
            }
            const link = document.createElement('a');
            link.className = 'infraLinkDocumento';
            link.dataset.doc = node.codigo;
            link.href = `http://${host}/visualizarDocumentos.asp?origem=pesquisa&ignoraframes=sim&codigoDocumento=${node.codigo}`;
            link.target = '_blank;';
            link.textContent = node.codigo;
            linha.cells[1].appendChild(link);
        }
        else {
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
class List {
    constructor(fold) {
        this.fold = fold;
    }
    alt(that) {
        return this.isEmpty() ? that : this;
    }
    altL(lazy) {
        return this.isEmpty() ? lazy() : this;
    }
    chain(f) {
        return new List((N, C) => this.fold(N, (x, xs) => f(x)
            .concat(xs.chain(f))
            .fold(N, C)));
    }
    concat(that) {
        return new List((N, C) => this.fold(() => that.fold(N, C), (x, xs) => C(x, xs.concat(that))));
    }
    count() {
        return this.reduce(x => x + 1, 0);
    }
    every(p) {
        let done = false;
        let current = this;
        let acc = true;
        while (!done) {
            current.fold(() => {
                done = true;
            }, (x, xs) => {
                acc = acc && p(x);
                if (!acc)
                    done = true;
                current = xs;
            });
        }
        return acc;
    }
    filter(p) {
        return new List((N, C) => this.fold(N, (x, xs) => (p(x) ? C(x, xs) : xs.filter(p).fold(N, C))));
    }
    filterMap(f) {
        return new List((N, C) => this.fold(N, (x, xs) => f(x).fold(() => xs.filterMap(f).fold(N, C), y => C(y, xs.filterMap(f)))));
    }
    forEach(f) {
        let current = this;
        do {
            current = current.fold(() => false, (x, xs) => {
                f(x);
                return xs;
            });
        } while (current);
    }
    ifCons(f) {
        this.fold(() => { }, f);
    }
    ifNil(f) {
        this.fold(f, () => { });
    }
    isEmpty() {
        return this.fold(() => true, () => false);
    }
    limit(n) {
        return new List((N, C) => (n <= 0 ? N() : this.fold(N, (x, xs) => C(x, xs.limit(n - 1)))));
    }
    map(f) {
        return new List((N, C) => this.fold(N, (x, xs) => C(f(x), xs.map(f))));
    }
    reduce(f, seed) {
        let acc = seed;
        this.forEach(x => {
            acc = f(acc, x);
        });
        return acc;
    }
    refine(p) {
        return this.filter(p);
    }
    toArray() {
        const result = [];
        this.forEach(x => result.push(x));
        return result;
    }
    static empty() {
        return new List((N, _) => N());
    }
    static fromArray(xs) {
        const len = xs.length;
        function go(i) {
            return new List((N, C) => {
                if (i < len) {
                    return C(xs[i], go(i + 1));
                }
                return N();
            });
        }
        return go(0);
    }
    static fromIterable(xs) {
        let iter;
        function go() {
            return new List((N, C) => {
                if (!iter) {
                    iter = xs[Symbol.iterator]();
                }
                const result = iter.next();
                if (result.done)
                    return N();
                return C(result.value, go());
            });
        }
        return go();
    }
}
class Maybe {
    constructor(fold) {
        this.fold = fold;
    }
    alt(that) {
        return this.fold(() => that, () => this);
    }
    altL(lazy) {
        return this.fold(lazy, () => this);
    }
    ap(that) {
        return that.chain(f => this.map(f));
    }
    filter(p) {
        return this.fold(() => Nothing, x => (p(x) ? Just(x) : Nothing));
    }
    ifJust(f) {
        return this.fold(() => { }, f);
    }
    ifNothing(f) {
        return this.fold(f, () => { });
    }
    isJust() {
        return this.fold(() => false, () => true);
    }
    isNothing() {
        return this.fold(() => true, () => false);
    }
    chain(f) {
        return this.fold(() => Nothing, f);
    }
    getOrElse(defaultValue) {
        return this.fold(() => defaultValue, x => x);
    }
    getOrElseL(lazy) {
        return this.fold(lazy, x => x);
    }
    map(f) {
        return this.chain(x => Just(f(x)));
    }
    mapNullable(f) {
        return this.chain(x => Maybe.fromNullable(f(x)));
    }
    refine(p) {
        return this.filter(p);
    }
    static fromNullable(value) {
        return value == null ? Nothing : Just(value);
    }
    static of(value) {
        return Just(value);
    }
}
function Just(value) {
    return new Maybe((_, J) => J(value));
}
const Nothing = new Maybe((N, _) => N());
class Ordering {
    constructor(value) {
        this.value = value;
    }
    concat(that) {
        return this.value === 0 /* EQ */ ? that : this;
    }
    static compare(a, b) {
        return new Ordering(a < b ? -1 /* LT */ : a > b ? 1 /* GT */ : 0 /* EQ */);
    }
    static empty() {
        return new Ordering(0 /* EQ */);
    }
}
class ServicoPreferencias {
    constructor() {
        this._listeners = new Map();
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local')
                return;
            const changed = Object.keys(changes);
            this._preferencias.then(preferencias => {
                let novasPreferencias = Object.assign({}, preferencias);
                changed.forEach(key => {
                    const value = changes[key]
                        .newValue;
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
    async on(nome, listener) {
        this._listeners.set(nome, (this._listeners.get(nome) || []).concat([listener]));
        return this._preferencias
            .then(prefs => prefs[nome])
            .then(value => (value === undefined ? true : value))
            .then(listener);
    }
}
const Preferencias = new ServicoPreferencias();
function adicionarEstilos(css) {
    const template = document.createElement('template');
    template.innerHTML = `<style>${css}</style>`;
    const style = document.importNode(template.content, true).firstElementChild;
    document.head.appendChild(style);
    return style;
}
function adicionarLinkStylesheet(path, media = 'screen') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.media = media;
    const promise = new Promise((resolve, reject) => {
        function removeListeners() {
            link.removeEventListener('load', onload);
            link.removeEventListener('error', onerror);
        }
        function onload() {
            removeListeners();
            resolve(link);
        }
        function onerror(e) {
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
    const promises = [];
    query('.infraBarraSistema').ifJust(() => {
        promises.push(adicionarLinkStylesheet('chrome/skin/eprocV2.css'));
        promises.push(adicionarLinkStylesheet('chrome/skin/print.css', 'print'));
    });
    return Promise.all(promises);
}
function carregarGedpro() {
    let carregado = false;
    return Preferencias.on("documentos-gedpro" /* DOCUMENTOS_GEDPRO */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                carregado = liftA3(query('fieldset#fldMinutas'), query('#fldAcoes center a[href^="controlador.php?acao=acessar_processo_gedpro&"]').map(x => new URL(x.href, location.href).href), Maybe.fromNullable(new URL(location.href).searchParams.get('num_processo')), (minutas, urlGedpro, processo) => criarAreaGedpro(minutas, urlGedpro, processo)).getOrElse({ mostrar() { }, ocultar() { } });
            }
            carregado.mostrar();
        }
        else if (carregado) {
            carregado.ocultar();
        }
    });
}
function centralizarListaPerfis() {
    let carregado = false;
    return Preferencias.on("entrar" /* ENTRAR */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                carregado = adicionarEstilos('#fldLogin { position: static; margin: 6% auto; }');
            }
        }
        else if (carregado) {
            document.head.removeChild(carregado);
            carregado = false;
        }
    });
}
function closest(selector) {
    return (element) => Maybe.fromNullable(element.closest(selector));
}
function complementarEventosReferidos() {
    let carregado = false;
    return Preferencias.on("eventos-referidos" /* EVENTOS_REFERIDOS */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                const eventosReferentes = new Map();
                const eventosReferidos = new Map();
                query('table#tblEventos').map(tabela => {
                    queryAll('tr[class^="infraTr"], tr[bgcolor="#FFFACD"]', tabela).forEach(tr => {
                        const colunaDescricao = Just(tr.cells.length - 3)
                            .filter(x => x >= 0)
                            .map(i => tr.cells[i]);
                        const eventoReferente = colunaDescricao
                            .chain(obterTexto)
                            .mapNullable(x => x.match(/Refer\. ao Evento: (\d+)$/))
                            .map(x => Number(x[1]));
                        liftA2(eventoReferente, colunaDescricao, (ev, col) => {
                            eventosReferentes.set(ev, (eventosReferentes.get(ev) || []).concat([col]));
                        }).altL(() => {
                            if (query('.infraEventoPrazoParte', tr).isNothing())
                                return Nothing;
                            const numeroEvento = Just(tr.cells.length - 5)
                                .filter(x => x >= 0)
                                .map(i => tr.cells[i])
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
                        coluna.insertAdjacentHTML('beforeend', `<span class="extraReferente noprint"><br>${texto}</span>`);
                    });
                }
            }
        }
        else if (carregado) {
            queryAll('.extraReferente').forEach(elt => {
                elt.parentNode.removeChild(elt);
            });
        }
    });
    function obterTexto(node) {
        return Just((node.textContent || '').trim()).filter(x => x !== '');
    }
}
function corrigirPesquisaRapida() {
    let carregado = false;
    return Preferencias.on("pesquisa-rapida" /* PESQUISA_RAPIDA */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                carregado = query('#txtNumProcessoPesquisaRapida')
                    .refine((x) => x.matches('input'))
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
        }
        else if (carregado) {
            carregado.ifJust(({ input, value, style, onfocus }) => {
                input.removeAttribute('placeholder');
                if (value) {
                    input.setAttribute('value', value);
                    if (input.value === '')
                        input.value = value;
                }
                if (style)
                    input.setAttribute('style', style);
                if (onfocus)
                    input.setAttribute('onfocus', onfocus);
            });
        }
    });
}
function criarAreaGedpro(minutas, urlGedpro, processo) {
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
    const fieldset = document.importNode(template.content, true).firstChild;
    const toggle = fieldset.querySelector('#extraGedproToggle');
    const imgMostrar = fieldset.querySelector('#extraImgGedproMostrar');
    const imgOcultar = fieldset.querySelector('#extraImgGedproOcultar');
    const imgCarregando = fieldset.querySelector('#extraImgGedproCarregando');
    const imgAtualizar = fieldset.querySelector('#extraImgGedproAtualizar');
    const conteudo = fieldset.querySelector('#extraConteudoGedpro');
    const espacoTabela = fieldset.querySelector('#extraTabelaGedpro');
    const maisDocs = fieldset.querySelector('#extraGedproMaisDocs');
    const imgCarregandoMais = fieldset.querySelector('#extraImgGedproCarregandoMais');
    const lineBreak = document.createElement('br');
    let estado = 'INICIAL';
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
            let estado = false;
            maisDocs.addEventListener('click', evt => {
                evt.preventDefault();
                if (estado) {
                    carregarPagina(estado.pagina + 1).catch(onError);
                }
            });
            return carregarPagina(1);
            async function carregarPagina(pagina) {
                if (estado) {
                    carregandoMais();
                }
                const xml = await obterPagina(pagina);
                const nodes = parseGedproXml(xml);
                const tabela = renderGedproNodes(host, nodes);
                if (!estado) {
                    // Primeira vez que a tabela é carregada
                    espacoTabela.appendChild(tabela);
                }
                else {
                    // Já existe uma tabela com dados
                    const tbody = tabela.querySelector('tbody');
                    tbody.removeChild(tbody.querySelector('tr'));
                    estado.tabela.appendChild(tbody);
                }
                if (nodes.length >= 21) {
                    // Há mais documentos
                    estado = { tabela, pagina };
                    documentosCarregados(true);
                }
                else {
                    // Não há mais documentos
                    estado = false;
                    documentosCarregados(false);
                }
            }
        })
            .catch(onError);
        function onError(error) {
            console.error(error);
            alert('Ocorreu um erro ao tentar obter os documentos do Gedpro.');
            limpar();
        }
    }
    function documentosCarregados(haMaisPaginas) {
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
function decorarTabelaLocalizadores(linhas) {
    let carregado = false;
    return Preferencias.on("tabela-localizadores" /* TABELA_LOCALIZADORES */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                const linhasSalvas = new Map();
                const listeners = new Map();
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
        }
        else if (carregado) {
            for (const linha of carregado.linhas.keys()) {
                linha.classList.remove('extraLocalizador');
                linha.removeAttribute('data-processos');
            }
            for (const [linha, listener] of carregado.listeners.entries()) {
                linha.removeEventListener('click', listener);
            }
        }
    });
    function getLink(tr) {
        return Maybe.fromNullable(tr.cells[1]).chain(cell => query('a', cell));
    }
    function getUrl(a) {
        return Maybe.fromNullable(a.href)
            .filter(x => x !== '')
            .alt(Maybe.fromNullable(a.getAttribute('onclick')).map(onclick => `javascript:${onclick}`));
    }
    function getQtdProcessos(a) {
        return Maybe.fromNullable(a.textContent)
            .map(Number)
            .filter(x => !isNaN(x));
    }
}
function decorarTabelaLocalizadoresPainel() {
    return decorarTabelaLocalizadores(queryAll('#fldProcessos tr[class^="infraTr"], #fldLocalizadores tr[class^="infraTr"]'));
}
function decorarTabelaMeusLocalizadores() {
    return decorarTabelaLocalizadores(queryAll('#divInfraAreaTabela tr[class^="infraTr"]'));
}
function destacarUltimoLinkClicado() {
    let carregado = false;
    return Preferencias.on("ultimo-clicado" /* ULTIMO_CLICADO */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                carregado = evt => {
                    Maybe.fromNullable(evt.target)
                        .refine((elt) => elt.nodeType === Node.ELEMENT_NODE &&
                        elt.matches('a[data-doc]'))
                        .ifJust(link => {
                        query('#extraUltimoLinkClicado').ifJust(link => link.removeAttribute('id'));
                        link.setAttribute('id', 'extraUltimoLinkClicado');
                    });
                };
            }
            document.body.addEventListener('click', carregado);
        }
        else if (carregado) {
            document.body.removeEventListener('click', carregado);
        }
    });
}
function liftA2(ax, ay, f) {
    return ay.ap(ax.map((x) => (y) => f(x, y)));
}
function liftA3(ax, ay, az, f) {
    return az.ap(ay.ap(ax.map((x) => (y) => (z) => f(x, y, z))));
}
function modificarPaginaEspecifica() {
    const url = new URL(location.href);
    const params = url.searchParams;
    if (params.has('acao')) {
        const acao = params.get('acao');
        if (Acoes.has(acao)) {
            const fn = Acoes.get(acao);
            return fn();
        }
    }
    if (params.has('acao_origem')) {
        const acaoOrigem = params.get('acao_origem');
        if (AcoesOrigem.has(acaoOrigem)) {
            const fn = AcoesOrigem.get(acaoOrigem);
            return fn();
        }
    }
    return Promise.resolve();
}
function modificarTabelaProcessos() {
    let carregado = false;
    return Preferencias.on("tabela-processos" /* TABELA_PROCESSOS */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                const table = queryAll(`a[onclick="infraAcaoOrdenar('NumProcesso','ASC');"]`)
                    .filterMap(closest('th'))
                    .altL(() => queryAll('tr[data-classe]'))
                    .limit(1)
                    .filterMap(closest('table'));
                carregado = new Map(table
                    .concat(table.chain(tbl => queryAll('th', tbl)))
                    .map(elt => [elt, elt.getAttribute('width')])
                    .toArray());
            }
            for (const elt of carregado.keys()) {
                elt.removeAttribute('width');
            }
        }
        else if (carregado) {
            for (const [elt, largura] of carregado.entries()) {
                if (largura)
                    elt.setAttribute('width', largura);
            }
        }
    });
}
function mostrarIconesNoMenuAcoes() {
    const maybeFieldset = query('fieldset#fldAcoes');
    const maybeLegend = maybeFieldset.chain(fieldset => query(':scope > legend', fieldset));
    return liftA2(maybeFieldset, maybeLegend, async (fieldset, legend) => {
        const acoes = queryAll(':scope > center a', fieldset);
        if (acoes.isEmpty())
            return [];
        const botoesNoMenuAcoes = acoes.every(acao => acao.classList.contains('infraButton'));
        if (!botoesNoMenuAcoes)
            return [];
        const template = document.createElement('template');
        template.innerHTML = `<div class="extraAcoesOpcoes noprint"><input type="checkbox" id="chkMostrarIcones"><label for="chkMostrarIcones"> Mostrar Ícones</label></div>`;
        const content = document.importNode(template.content, true);
        const chkMostrarIcones = content.querySelector('#chkMostrarIcones');
        const key = "icones-acoes" /* ICONES_ACOES */;
        chkMostrarIcones.addEventListener('change', () => {
            browser.storage.local.set({ [key]: chkMostrarIcones.checked });
        });
        legend.appendChild(content);
        let carregado = false;
        return Preferencias.on("icones-acoes" /* ICONES_ACOES */, async (mostrarIcones) => {
            fieldset.classList.toggle('extraAcoesMostrarIcones', mostrarIcones);
            chkMostrarIcones.checked = mostrarIcones;
            if (mostrarIcones && !carregado) {
                const iconeTemplate = document.createElement('template');
                iconeTemplate.innerHTML = '<img alt=" " class="extraIconeAcao noprint">';
                function criarIcone(src) {
                    return function criarIcone(link) {
                        const icone = document.importNode(iconeTemplate.content, true)
                            .firstElementChild;
                        return new Promise((resolve, reject) => {
                            function onload(_) {
                                removeListeners();
                                resolve(icone);
                            }
                            function onerror(e) {
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
                function ChromeIcone(arquivo) {
                    return criarIcone(browser.runtime.getURL(`chrome/skin/${arquivo}`));
                }
                function InfraIcone(arquivo) {
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
                const promises = [];
                acoes.forEach(link => {
                    const url = new URL(link.href);
                    const params = url.searchParams;
                    if (params.has('acao')) {
                        const acao = params.get('acao');
                        if (icones.has(acao)) {
                            const adicionarIcone = icones.get(acao);
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
        }
        else {
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
        }
        else {
            checkState();
        }
        function checkState() {
            if (document.readyState === 'complete') {
                res();
            }
        }
    });
}
async function obterDocumentosGedproFactory(urlGedpro, processo) {
    let cachedDocsUrl = Promise.reject();
    return getXml();
    async function getXml() {
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
            async obterPagina(pagina) {
                const response = await fetch(`${docsUrl}&pgtree=${pagina}`, {
                    credentials: 'include',
                });
                const blob = await response.blob();
                const text = await new Promise(resolve => {
                    const reader = new FileReader();
                    reader.addEventListener('loadend', () => resolve(reader.result), {
                        once: true,
                    });
                    reader.readAsText(blob);
                });
                const parser = new DOMParser();
                const xml = parser.parseFromString(text, 'application/xml');
                return xml;
            },
        };
    }
    async function getLink(linkUrl) {
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
    async function getLoginForm(host, link) {
        const response = await fetch(link, { credentials: 'include' });
        const text = await response.text();
        const formLogin = /FormLogin\.asp\?[^"]+/.exec(text);
        const mainframePage = /\/mainframe\.asp\?[^"]+/.exec(text);
        if (formLogin) {
            return `http://${host}/${formLogin[0]}`;
        }
        else if (mainframePage) {
            return getLoginForm(host, `http://${host}${mainframePage[0]}`);
        }
        else {
            throw new Error('Não foi possível obter o link de requisição de login.');
        }
    }
    async function getLogin(loginForm) {
        const response = await fetch(loginForm, { credentials: 'include' });
        const text = await response.text();
        if (/<!-- Erro /.test(text)) {
            throw new Error('Não é possível fazer login no GEDPRO.');
        }
        else {
            return true;
        }
    }
    async function getGrupos(host) {
        const response = await fetch(`http://${host}/arvore2.asp?modulo=Textos do Processo&processo=${processo}&numeroProcessoVisual=NPV&localizadorProcesso=LP`, { credentials: 'include' });
        const text = await response.text();
        const match = text.match(/&grupos=([^&]+)&/);
        if (!match) {
            alert('Não foi possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.');
            return '11,28,82';
        }
        return match[1];
    }
    function getDocsUrl(host, grupos) {
        return `http://${host}/XMLInterface.asp?processo=${processo}&ProcessoVisual=PV&grupos=${grupos}`;
    }
}
async function obterPreferenciaExtensao(nome, valorPadrao) {
    const result = await browser.storage.local.get({ [nome]: valorPadrao });
    return result[nome];
}
function query(selector, context = document) {
    return Maybe.fromNullable(context.querySelector(selector));
}
function queryAll(selector, context = document) {
    return List.fromArray(context.querySelectorAll(selector));
}
function telaProcesso() {
    return Promise.all([carregarGedpro(), complementarEventosReferidos()]).then(() => { });
}
async function verificarCompatibilidadeVersao() {
    if (!unsafeWindow.FeP)
        return;
    const numeroVersaoCompativel = unsafeWindow.FeP.numeroVersaoCompativel;
    const numeroVersaoInstalada = browser.runtime.getManifest().version;
    const [comp, inst] = [numeroVersaoCompativel, numeroVersaoInstalada].map(x => x.split('.').map(x => parseInt(x, 10)));
    while (comp.length < inst.length)
        comp.push(0);
    while (inst.length < comp.length)
        inst.push(0);
    const result = inst.reduce((acc, x, i) => acc.concat(Ordering.compare(x, comp[i])), Ordering.empty());
    const versaoUsuarioCompativel = result.value !== -1 /* LT */;
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
