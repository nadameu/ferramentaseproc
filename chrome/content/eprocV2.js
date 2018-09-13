"use strict";
const unsafeWindow = window.wrappedJSObject;
async function main() {
    verificarCompatibilidadeVersao();
    mudarEstilosSeForPaginaComBarra();
    corrigirCamposAutoCompletar();
}
class List {
    constructor(fold) {
        this.fold = fold;
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
function mudarEstilosSeForPaginaComBarra() {
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
