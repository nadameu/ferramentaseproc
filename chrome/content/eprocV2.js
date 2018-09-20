"use strict";
const unsafeWindow = window.wrappedJSObject;
async function main() {
    await onDocumentEnd();
    await verificarCompatibilidadeVersao();
    await carregarEstilosPersonalizados();
    return Promise.all([
        corrigirPesquisaRapida(),
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
        let limit = 1e3;
        const len = xs.length;
        function go(i) {
            if (!limit--)
                throw new Error('x');
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
        query('link[href^="css/estilos.php?skin="]').ifJust(estilosPersonalizados => {
            const result = /\?skin=([^&]*)/.exec(estilosPersonalizados.href);
            const skins = new Map([['elegant', 'candy'], ['minimalist', 'icecream']]);
            const skin = skins.has(result[1]) ? skins.get(result[1]) : 'stock';
            promises.push(adicionarLinkStylesheet(`chrome/skin/${skin}-extra.css`));
        });
    });
    return Promise.all(promises);
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
                // TODO: implementar
                carregado = true;
            }
        }
        else if (carregado) {
        }
    });
}
function corrigirColunasTabelaEventos() {
    let carregado = false;
    return Preferencias.on("tabela-eventos" /* TABELA_EVENTOS */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                // TODO: implementar
                carregado = true;
            }
        }
        else if (carregado) {
        }
    });
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
function criarBotaoDocumentosGedpro() {
    let carregado = false;
    return Preferencias.on("documentos-gedpro" /* DOCUMENTOS_GEDPRO */, habilitada => {
        if (habilitada) {
            if (!carregado) {
                // TODO: implementar
                const maybeMinutas = query('fieldset#fldMinutas');
                carregado = true;
            }
        }
        else if (carregado) {
        }
    });
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
                // TODO: implementar
                carregado = true;
            }
        }
        else if (carregado) {
        }
    });
}
function liftA2(ax, ay, f) {
    return ay.ap(ax.map((x) => (y) => f(x, y)));
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
    return Promise.all([
        criarBotaoDocumentosGedpro(),
        destacarUltimoLinkClicado(),
        // TODO: fechar todas as janelas
        corrigirColunasTabelaEventos(),
        complementarEventosReferidos(),
    ]).then(() => { });
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
main().then(x => {
    if (x) {
        console.log(x);
    }
}, e => {
    console.warn('Ocorreu um erro');
    console.error(e);
});
