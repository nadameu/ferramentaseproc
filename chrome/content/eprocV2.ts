const unsafeWindow = window.wrappedJSObject;

async function main() {
	verificarCompatibilidadeVersao();
	mudarEstilosSeForPaginaComBarra();
	corrigirCamposAutoCompletar();
}

class List<A> {
	constructor(readonly fold: <B>(Nil: () => B, Cons: (head: A, tail: List<A>) => B) => B) {}
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
	toArray(): A[] {
		const result: A[] = [];
		this.forEach(x => result.push(x));
		return result;
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
	ap<B>(that: Maybe<(_: A) => B>): Maybe<B> {
		return that.chain(this.map);
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

function adicionarLinkStylesheet(path: string, media: 'print' | 'screen' = 'screen') {
	const link = document.createElement('link');
	link.rel = 'stylesheet';
	link.media = media;
	link.href = browser.runtime.getURL(path);
	document.head.appendChild(link);
}

function corrigirCamposAutoCompletar() {
	queryAll(
		'label[onclick^="listarTodos"], label[onclick^="listarEventos"], #txtEntidade, #txtPessoaEntidade'
	).forEach(auto => {
		const id = auto.id.replace('lblListar', 'txt');
		query(`#${id}`)
			.refine((x: Element): x is HTMLInputElement => x.matches('input'))
			.ifJust(auto => {
				auto.style.width = `${auto.clientWidth}px`;
			});
	});
}

function mudarEstilosSeForPaginaComBarra() {
	query('.infraBarraSistema').ifJust(() => {
		adicionarLinkStylesheet('chrome/skin/eprocV2.css');
		adicionarLinkStylesheet('chrome/skin/print.css', 'print');
		query<HTMLLinkElement>('link[href^="css/estilos.php?skin="]').ifJust(estilosPersonalizados => {
			const result = /\?skin=([^&]*)/.exec(estilosPersonalizados.href) as RegExpExecArray;
			const skins = new Map([['elegant', 'candy'], ['minimalist', 'icecream']]);
			const skin = skins.has(result[1]) ? skins.get(result[1]) : 'stock';
			adicionarLinkStylesheet(`chrome/skin/${skin}-extra.css`);
		});
	});
}

function query<T extends Element>(selector: string, context: NodeSelector = document): Maybe<T> {
	return Maybe.fromNullable(context.querySelector<T>(selector));
}

function queryAll<T extends Element>(selector: string, context: NodeSelector = document): List<T> {
	return List.fromArray(context.querySelectorAll<T>(selector));
}

function verificarCompatibilidadeVersao() {
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
