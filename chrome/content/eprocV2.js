"use strict";
const unsafeWindow = window.wrappedJSObject;
async function main() {
    verificarCompatibilidadeVersao();
    carregarEstilosPersonalizados();
    corrigirCamposAutoCompletar();
    corrigirPesquisaRapida();
    modificarTabelaProcessos();
}
class List {
    constructor(fold) {
        this.fold = fold;
    }
    alt(that) {
        return this.isEmpty() ? that : this;
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
        return that.chain(this.map);
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
function adicionarLinkStylesheet(path, media = 'screen') {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.media = media;
    link.href = browser.runtime.getURL(path);
    document.head.appendChild(link);
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
function carregarEstilosPersonalizados() {
    query('.infraBarraSistema').ifJust(() => {
        adicionarLinkStylesheet('chrome/skin/eprocV2.css');
        adicionarLinkStylesheet('chrome/skin/print.css', 'print');
        query('link[href^="css/estilos.php?skin="]').ifJust(estilosPersonalizados => {
            const result = /\?skin=([^&]*)/.exec(estilosPersonalizados.href);
            const skins = new Map([['elegant', 'candy'], ['minimalist', 'icecream']]);
            const skin = skins.has(result[1]) ? skins.get(result[1]) : 'stock';
            adicionarLinkStylesheet(`chrome/skin/${skin}-extra.css`);
        });
    });
}
function modificarTabelaProcessos() {
    function findTh(campo, texto) {
        const setas = queryAll(`a[onclick="infraAcaoOrdenar('${campo}','ASC');"]`);
        if (setas.count() !== 1) {
            return queryAll('th.infraTh').filter(th => th.textContent === texto);
        }
        else {
            return setas.filterMap(link => Maybe.fromNullable(link.closest('th')));
        }
    }
    let classeTh = findTh('DesClasseJudicial', 'Classe');
    const juizoTh = findTh('SigOrgaoJuizo', 'Ju\u00edzo');
    let th = classeTh.alt(juizoTh);
    if (th.isEmpty()) {
        const tr = queryAll('tr[data-classe]');
        if (tr.count() > 0) {
            const table = tr.filterMap(tr => Maybe.fromNullable(tr.closest('table')));
            classeTh = table
                .chain(t => queryAll('th.infraTh', t))
                .filter(th => /^Classe( Judicial)?$/.test(th.textContent || ''));
        }
        th = classeTh;
    }
    if (th.isEmpty()) {
        classeTh = queryAll('th.infraTh').filter(th => /^Classe( Judicial)?$/.test((th.textContent || '').trim()));
        th = classeTh;
    }
    if (!th.isEmpty()) {
        const table = th.filterMap(t => Maybe.fromNullable(t.closest('table')));
        table.forEach(t => {
            t.removeAttribute('width');
        });
        table.chain(t => queryAll('th', t)).forEach(t => {
            t.removeAttribute('width');
        });
        juizoTh.ifCons(j => {
            const juizoIndex = j.cellIndex;
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
                .chain(t => List.fromArray(t.rows))
                .filter(tr => /infraTr(Clara|Escura)/.test(tr.className))
                .forEach(tr => {
                const juizoCell = tr.cells[juizoIndex];
                const juizoText = juizoCell.textContent;
                const juizo = juizoText[juizoText.length - 1];
                if (/^\s*[A-Z]{5}TR/.test(juizoText)) {
                    juizoCell.style.color = colors.has(juizo) ? colors.get(juizo) : 'black';
                }
            });
        });
    }
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
main().then(x => {
    if (x) {
        console.log(x);
    }
}, e => {
    console.warn('Ocorreu um erro');
    console.error(e);
});
