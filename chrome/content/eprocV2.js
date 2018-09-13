"use strict";
const unsafeWindow = window.wrappedJSObject;
async function main() {
    verificarCompatibilidadeVersao();
    await carregarEstilosPersonalizados();
    corrigirCamposAutoCompletar();
    corrigirPesquisaRapida();
    modificarTabelaProcessos();
    modificarPaginaEspecifica();
    await mostrarIconesNoMenuAcoes();
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
class Preferencias {
    static on(nome, f) {
        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local')
                return;
            const changed = Object.keys(changes);
            if (!changed.includes(nome))
                return;
            Promise.resolve(f(changes[nome].newValue)).then(x => {
                if (x)
                    console.log(x);
            }, err => console.error(err));
        });
        return browser.storage.local.get({ [nome]: true }).then(obj => {
            return f(obj[nome]);
        });
    }
}
function adicionarEstilos(css) {
    const style = query('style#extraEstilos').getOrElseL(() => {
        const template = document.createElement('template');
        template.innerHTML = '<style id="extraEstilos"></style>';
        const style = document.importNode(template.content, true).firstElementChild;
        document.head.appendChild(style);
        return style;
    });
    style.insertAdjacentText('beforeend', css);
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
        function onload(e) {
            removeListeners();
            resolve(e);
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
    adicionarEstilos('#fldLogin { position: static; margin: 6% auto; }');
}
function corrigirCamposAutoCompletar() {
    queryAll('label[onclick^="listarTodos"], label[onclick^="listarEventos"], #txtEntidade, #txtPessoaEntidade').forEach(auto => {
        const id = auto.id.replace('lblListar', 'txt');
        query(`#${id}`)
            .refine((x) => x.matches('input'))
            .ifJust(auto => {
            auto.style.width = `${auto.clientWidth}px`;
        });
    });
}
function corrigirPesquisaRapida() {
    query('#txtNumProcessoPesquisaRapida')
        .refine((x) => x.matches('input'))
        .ifJust(pesquisaRapida => {
        if ('placeholder' in pesquisaRapida) {
            pesquisaRapida.setAttribute('placeholder', 'Pesquisa');
            pesquisaRapida.removeAttribute('value');
            pesquisaRapida.removeAttribute('style');
            pesquisaRapida.removeAttribute('onclick');
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
}
function modificarTabelaProcessos() {
    function encontrarTH(campo, texto) {
        const setas = queryAll(`a[onclick="infraAcaoOrdenar('${campo}','ASC');"]`);
        if (setas.count() === 1) {
            return setas.filterMap(link => Maybe.fromNullable(link.closest('th')));
        }
        else {
            return queryAll('th.infraTh').filter(th => th.textContent === texto);
        }
    }
    function obterTHsValidos(context = document) {
        return queryAll('th.infraTh', context).filter(th => /^Classe( Judicial)?$/.test((th.textContent || '').trim()));
    }
    const juizoTh = encontrarTH('SigOrgaoJuizo', 'Juízo');
    let th = encontrarTH('DesClasseJudicial', 'Classe')
        .alt(juizoTh)
        .altL(() => queryAll('tr[data-classe]')
        .limit(1)
        .filterMap(tr => Maybe.fromNullable(tr.closest('table')))
        .chain(obterTHsValidos))
        .altL(() => obterTHsValidos());
    if (!th.isEmpty()) {
        const table = th.filterMap(t => Maybe.fromNullable(t.closest('table')));
        table.forEach(tbl => {
            tbl.removeAttribute('width');
        });
        table.chain(tbl => queryAll('th', tbl)).forEach(th => {
            th.removeAttribute('width');
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
                    juizoCell.style.color = colors.has(juizo) ? colors.get(juizo) : 'black';
                }
            });
        });
    }
}
function mostrarIconesNoMenuAcoes() {
    const maybeFieldset = query('fieldset#fldAcoes');
    const maybeLegend = maybeFieldset.chain(fieldset => query(':scope > legend', fieldset));
    return liftA2(maybeFieldset, maybeLegend, async (fieldset, legend) => {
        const acoes = queryAll(':scope > center a', fieldset);
        if (acoes.isEmpty())
            return [];
        const botoesNoMenuAcoes = obterPreferenciaEproc(5 /* BOTOES_NO_MENU_ACOES */).getOrElse(acoes.every(acao => acao.classList.contains('infraButton')));
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
function obterPreferenciaEproc(num) {
    return Maybe.fromNullable(window.wrappedJSObject.localStorage.getItem(`ch${num}`))
        .refine((x) => /^[SN]$/.test(x))
        .map(x => x === 'S');
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
function verificarCompatibilidadeVersao() {
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
const Acoes = new Map([
    ['entrar', centralizarListaPerfis],
    ['entrar_cert', centralizarListaPerfis],
]);
const AcoesOrigem = new Map();
main().then(x => {
    if (x) {
        console.log(x);
    }
}, e => {
    console.warn('Ocorreu um erro');
    console.error(e);
});
