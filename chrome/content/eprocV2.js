/**
 * @param {string} selector
 * @param {NodeSelector} baseElement
 * @returns {Element}
 */
function $(selector, baseElement = document) {
	return baseElement.querySelector(selector);
}

/**
 * @param {string} selector
 * @param {NodeSelector} baseElement
 */
function $$(selector, baseElement = document) {
	var elements = baseElement.querySelectorAll(selector);
	return Array.from(elements);
}

function CheckBox(nomePreferencia, texto) {
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
		const alterarClasse = selecionado => {
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

var Gedpro = (() => {
	var linkElement, link, grupos, docsUrl, host;
	var statuses = [],
		buscando = false;
	class GedproNodes extends Array {
		/**
		 * @param {XMLDocument} doc
		 */
		constructor(doc) {
			super();
			$$('reg', doc).forEach(reg => {
				this.push(GedproNode.fromReg(reg));
			});
			this.maiorIcone = this.reduce((maior, x) => Math.max(maior, x), 0);
		}

		accept(visitor) {
			visitor.visitNodes(this);
			this.forEach(node => visitor.visit(node));
		}
	}
	GedproNodes.prototype.maiorIcone = 0;

	class GedproIcones extends Array {
		constructor(str) {
			super();
			for (let i = 0; i < str.length; i += 3) {
				this.push(new GedproIcone(str.substr(i, 3)));
			}
		}
	}

	class GedproIcone {
		static get ARQUIVOS() {
			return {
				['iWO']: 'Word',
				['iPO']: 'Papiro',
				['PDF']: 'pdfgedpro',
				['iPF']: 'PastaAberta',
				['iL+']: 'L-',
				['iT+']: 'T-',
				['iL0']: 'L',
				['iT0']: 'T',
				['i00']: 'Vazio',
				['iI0']: 'I',
				['0']: 'documento', // Em edição
				['1']: 'chave', // Bloqueado
				['2']: 'valida', // Pronto para assinar
				['3']: 'assinatura', // Assinado
				['4']: 'fase', // Movimentado
				['5']: 'procedimentos', // Devolvido
				['6']: 'localizador', // Arquivado
				['7']: 'excluidos', // Anulado
				['8']: 'abrirbloco', // Conferido
			};
		}

		constructor(str) {
			if (str in GedproIcone.ARQUIVOS) {
				this.arquivo = GedproIcone.ARQUIVOS[str];
			}
		}

		toImg() {
			const img = document.createElement('img');
			img.className = 'extraGedproImg';
			img.src = `http://${host}/images/${this.arquivo}.gif`;
			return img;
		}
	}
	GedproIcone.prototype.arquivo = 'Vazio';

	class GedproNode {
		constructor(reg) {
			if (reg === undefined) return;
			this.icones = new GedproIcone(reg.getAttribute('icones'));
		}

		accept(visitor) {
			visitor.visitNode(this);
		}

		static fromReg(reg) {
			switch (reg.getAttribute('codigoTipoNodo')) {
				case '-1':
					return new GedproDocComposto(reg);

				case '0':
					return new GedproProcesso(reg);

				case '1':
					return new GedproIncidente(reg);

				case '2':
					return new GedproDoc(reg);
			}
		}
	}
	GedproNode.prototype.rotulo = '';

	class GedproDoc extends GedproNode {
		static get STATUSES() {
			return {
				0: 'Em edição',
				1: 'Bloqueado',
				2: 'Pronto para assinar',
				3: 'Assinado',
				4: 'Movimentado',
				5: 'Devolvido',
				6: 'Arquivado',
				7: 'Anulado',
				8: 'Conferido',
				9: 'Para conferir',
			};
		}
		constructor(reg) {
			super(reg);
			this.rotulo = reg.getAttribute('nomeTipoDocumentoExibicao');
			this.maiorAcesso = reg.getAttribute('MaiorAcesso');
			this.codigo = reg.getAttribute('codigoDocumento');
			var statusDocumento = reg.getAttribute('statusDocumento');
			this.status = GedproDoc.STATUSES[statusDocumento];
			this.statusIcone = new GedproIcone(statusDocumento);
			this.data = reg.getAttribute('dataDocumento');
			this.criador = reg.getAttribute('siglaCriador');
			this.dataCriacao = reg.getAttribute('dataCriacao');
			this.versao = reg.getAttribute('numeroVersaoDocumento');
			this.editor = reg.getAttribute('siglaEditor');
			this.dataVersao = reg.getAttribute('dataHoraEdicao');
		}

		accept(visitor) {
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
		constructor(reg) {
			super(reg);
			this.rotulo = 'Documentos do GEDPRO';
		}
	}

	class GedproIncidente extends GedproNode {
		constructor(reg) {
			super(reg);
			this.rotulo = reg.getAttribute('descricaoIncidente');
		}
	}

	class GedproDocComposto extends GedproNode {
		constructor(reg) {
			super(reg);
			this.rotulo = `${reg.getAttribute('nomeTipoDocComposto')} ${reg.getAttribute(
				'identificador'
			)}/${reg.getAttribute('ano')}`;
		}
	}

	var GedproTabela = (function() {
		var table;
		var getTable = function() {
			if (!table) {
				createTable();
			}
			return table;
		};
		var createTable = function() {
			table = document.createElement('table');
			table.className = 'infraTable';
		};
		var tHead;
		var getTHead = function() {
			if (!tHead) {
				createTHead();
			}
			return tHead;
		};
		var numCells = 7;
		var createTHead = function() {
			var table = getTable();
			table.deleteTHead();
			tHead = table.createTHead();
			var tr = tHead.insertRow(0);
			['Documento', 'Número', 'Status', 'Data Documento', 'Criação', 'Edição'].forEach(function(
				text
			) {
				var th = document.createElement('th');
				th.className = 'infraTh';
				th.textContent = text;
				tr.appendChild(th);
			});
			tr.cells[2].colSpan = 2;
		};
		var tBody;
		var getTBody = function() {
			if (!tBody) {
				createTBody();
			}
			return tBody;
		};
		var createTBody = function() {
			var table = getTable();
			if (table.tBodies.length) {
				$$('tbody', table).forEach(function(tBody) {
					table.removeChild(tBody);
				});
			}
			tBody = document.createElement('tbody');
			table.appendChild(tBody);
			trClassName = null;
		};
		var tFoot;
		var getTFoot = function() {
			if (!tFoot) {
				createTFoot();
			}
			return tFoot;
		};
		var createTFoot = function() {
			var table = getTable();
			table.deleteTFoot();
			tFoot = table.createTFoot();
			var tr = tFoot.insertRow(0);
			var th = document.createElement('th');
			th.className = 'extraGedproPaginacao';
			th.colSpan = numCells;
			tr.appendChild(th);
		};
		var trClassName;
		var createRow = function() {
			var tBody = getTBody();
			var tr = tBody.insertRow(tBody.rows.length);
			trClassName = trClassName == 'infraTrClara' ? 'infraTrEscura' : 'infraTrClara';
			tr.className = trClassName;
			return tr;
		};
		var pagina = 1,
			maiorPagina = pagina;
		return {
			getPagina: function(estaPagina) {
				pagina = estaPagina;
				getTHead();
				createTBody();
				createTFoot();
				return table;
			},
			getTable: function() {
				return getTable();
			},
			visit: function(obj) {
				obj.accept(this);
			},
			visitNodes: function(nodes) {
				var possuiMaisDocumentos = nodes.length >= 21;
				if (pagina > maiorPagina) {
					maiorPagina = pagina;
				} else if (pagina == maiorPagina && possuiMaisDocumentos) {
					maiorPagina++;
				}
				getTHead();
				var cell = getTFoot().rows[0].cells[0];

				function criaLinkPaginacaoGedpro(pagina, texto) {
					var link = document.createElement('a');
					link.href = '#cargaDocsGedpro';
					link.textContent = texto;
					link.addEventListener(
						'click',
						function() {
							return Gedpro.getDocs(pagina);
						},
						false
					);
					cell.appendChild(link);
				}
				cell.appendChild(document.createTextNode('Página '));
				for (var p = 1; p <= maiorPagina; p++) {
					if (p == pagina) {
						var span = document.createElement('span');
						span.className = 'extraGedproPaginaAtual';
						span.textContent = String(pagina);
						cell.appendChild(span);
					} else {
						criaLinkPaginacaoGedpro(p, p);
					}
					cell.appendChild(document.createTextNode(' '));
				}
			},
			visitNode: function(node) {
				var tr = createRow();
				var tdRotulo = tr.insertCell(0);
				tdRotulo.colSpan = numCells;
				node.icones.forEach(function(icone) {
					tdRotulo.appendChild(icone.toImg());
				});
				tdRotulo.appendChild(document.createTextNode(` ${node.rotulo}`));
				return tr;
			},
			visitDoc: function(doc) {
				var row = this.visitNode(doc);
				var tdRotulo = row.cells[row.cells.length - 1];
				tdRotulo.removeAttribute('colspan');
				tdRotulo.className = doc.getClasse();
				if (tdRotulo.className != 'extraGedproRotuloGray') {
					tdRotulo.addEventListener(
						'click',
						(function(node) {
							return function(e) {
								e.preventDefault();
								e.stopPropagation();
								var menuFechar = $('#extraFechar');
								if (menuFechar) {
									menuFechar.style.visibility = 'visible';
								}
								var win =
									window.wrappedJSObject.documentosAbertos[`${Eproc.processo}${node.codigo}`];
								if (typeof win == 'object' && !win.closed) {
									return win.focus();
								}
								window.wrappedJSObject.documentosAbertos[
									`${Eproc.processo}${node.codigo}`
								] = window.open(
									`http://${host}/visualizarDocumentos.asp?origem=pesquisa&ignoraframes=sim&codigoDocumento=${
										node.codigo
									}`,
									`${Eproc.processo}${node.codigo}`,
									'menubar=0,resizable=1,status=0,toolbar=0,location=0,directories=0,scrollbars=1'
								);
							};
						})(doc),
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
	return {
		error: function(msg) {
			window.alert(msg);
			buscando = false;
		},
		getDocs: function(pagina) {
			if (buscando) {
				window.alert('A solicitação já foi enviada. Por favor aguarde.');
				return;
			}
			buscando = true;
			pagina = typeof pagina == 'number' ? pagina : 1;
			Gedpro.getXml(pagina, function(xml) {
				var nodes = new GedproNodes(xml);
				GedproTabela.visit(nodes);
				var pai = $('#cargaDocsGedpro');
				var linkCargaDocs = $('#linkCargaDocs');
				linkCargaDocs.transform();
				var table = GedproTabela.getTable();
				pai.insertBefore(table, linkCargaDocs);
				buscando = false;
			});
		},
		getDocsUrl: function(callback) {
			if (docsUrl) {
				return callback(docsUrl);
			}
			Gedpro.getGrupos(function(grupos) {
				docsUrl = `http://${host}/XMLInterface.asp?processo=${
					Eproc.processo
				}&ProcessoVisual=PV&grupos=${grupos}`;
				Gedpro.getDocsUrl(callback);
			});
		},
		getGrupos: function(callback) {
			if (grupos) {
				return callback(grupos);
			}
			var setPublicGroups = function() {
				grupos = '11,28,82';
				Gedpro.getGrupos(callback);
			};
			var onerror = function() {
				Gedpro.warn(
					'Não foi possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.'
				);
				return setPublicGroups();
			};
			Gedpro.getLogin(
				function() {
					Gedpro.pushStatus('Obtendo grupos do usuário...');
					fetch(
						`http://${host}/arvore2.asp?modulo=Textos do Processo&processo=${
							Eproc.processo
						}&numeroProcessoVisual=NPV&localizadorProcesso=LP`
					)
						.then(data => data.text())
						.then(text => {
							Gedpro.popStatus();
							try {
								[, grupos] = text.match(/&grupos=([^&]+)&/);
							} catch (e) {
								console.error(text);
								return onerror();
							}
							Gedpro.getGrupos(callback);
						})
						.catch(onerror);
				},
				function() {
					Gedpro.warn(
						'Não é possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.'
					);
					return setPublicGroups();
				}
			);
		},
		getLink: function(callback) {
			if (link) {
				return callback(link);
			}
			Gedpro.getLinkElement(function(linkElement) {
				var urlGetter = linkElement.href;
				var xhr = new XMLHttpRequest();
				xhr.open('HEAD', urlGetter);
				xhr.setRequestHeader('X-Ferramentas-e-Proc', '1');
				xhr.onreadystatechange = function() {
					if (this.readyState == 4) {
						Gedpro.popStatus();
						if (
							this.status == 200 &&
							(link = this.getResponseHeader('X-Ferramentas-e-Proc-Redirect'))
						) {
							var a = document.createElement('a');
							a.href = link;
							host = a.host;
							Gedpro.getLink(callback);
						} else {
							Gedpro.error('Não foi possível obter o endereço do GEDPRO.');
						}
					}
				};
				Gedpro.pushStatus('Obtendo endereço do GEDPRO...');
				xhr.send();
			});
		},
		getLinkElement: function(callback) {
			if (linkElement) {
				return callback(linkElement);
			}
			var links = $$('a[href^="controlador.php?acao=acessar_processo_gedpro&"]');
			if (links.length == 1) {
				linkElement = links[0];
				Gedpro.getLinkElement(callback);
			}
		},
		getLoginForm: function(callback) {
			var getLinkCallback;
			getLinkCallback = function(link) {
				Gedpro.pushStatus('Obtendo link de requisição de login...');
				fetch(link)
					.then(data => data.text())
					.then(text => {
						var formLogin = /FormLogin\.asp\?[^"]+/.exec(text);
						var mainframePage = /\/mainframe\.asp\?[^"]+/.exec(text);
						if (formLogin) {
							var loginForm = `http://${host}/${formLogin}`;
							return callback(loginForm);
						} else if (mainframePage) {
							var mainframe = `http://${host}${mainframePage}`;
							getLinkCallback(mainframe);
						} else {
							Gedpro.error('Não foi possível obter o link de requisição de login.');
						}
					});
			};
			Gedpro.getLink(getLinkCallback);
		},
		getNewLogin: function(e) {
			e.preventDefault();
			e.stopPropagation();
			Gedpro.getLogin(function() {
				Gedpro.info('Feche o documento e tente novamente agora.');
			});
		},
		getLogin: function(callback, onerror) {
			onerror =
				onerror ||
				function() {
					Gedpro.error('Não é possível fazer login no GEDPRO.');
				};
			Gedpro.getLoginForm(function(loginForm) {
				Gedpro.pushStatus('Verificando possibilidade de login...');
				fetch(loginForm)
					.then(data => data.text())
					.then(text => {
						Gedpro.popStatus();
						if (/<!-- Erro /.test(text)) {
							onerror();
						} else {
							return callback(loginForm);
						}
					});
			});
		},
		getXml: (pagina, callback) => {
			Gedpro.getDocsUrl(docsUrl => {
				Gedpro.pushStatus(`Carregando página ${pagina} da árvore de documentos...`);
				fetch(`${docsUrl}&pgtree=${pagina}`)
					.then(data => data.text())
					.then(text => {
						Gedpro.popStatus();
						var parser = new DOMParser();
						var xml = parser.parseFromString(text, 'application/xml');
						callback(xml);
					})
					.catch(() => {
						Gedpro.error(`Não foi possível carregar a página ${pagina} da árvore de documentos.`);
					});
			});
		},
		info: function(msg) {
			var timer;
			timer = window.setInterval(function() {
				window.clearInterval(timer);
				window.alert(msg);
			}, 100);
		},
		popStatus: function() {
			var linkCargaDocs = $('#linkCargaDocs');
			if (linkCargaDocs) {
				var oldText = linkCargaDocs.textContent;
				var status = statuses.pop();
				linkCargaDocs.textContent = status;
				return oldText;
			}
		},
		pushStatus: function(status) {
			var linkCargaDocs = $('#linkCargaDocs');
			if (linkCargaDocs) {
				var oldText = linkCargaDocs.textContent;
				statuses.push(oldText);
				linkCargaDocs.textContent = status;
			}
		},
		warn: function(msg) {
			Gedpro.info(msg);
		},
	};
})();
var Eproc = {
	acao: '',
	pagina: '',
	processo: 0,
	windows: [],
	clicar: function(elemento) {
		var evento = document.createEvent('MouseEvents');
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
	closeAllWindows: function(e) {
		var windows = [];
		for (let w in window.wrappedJSObject.documentosAbertos) {
			var win = window.wrappedJSObject.documentosAbertos[w];
			if (typeof win == 'object' && !win.closed) {
				windows.push(win);
			}
		}
		var menuFechar = $('#extraFechar');
		if (windows.length) {
			var tela = /^processo_selecionar/.test(this.acao) ? 'Este processo' : 'Esta tela';
			var msg = `${tela} possui ${windows.length} ${
				windows.length > 1 ? 'janelas abertas' : 'janela aberta'
			}.\nDeseja fechá-${windows.length > 1 ? 'las' : 'la'}?`;
			var resposta = confirm(msg);
			if (resposta === true) {
				for (var w = windows.length - 1; w >= 0; w--) {
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
		var findTh = function(campo, texto) {
			var th = null,
				setas = $$(`a[onclick="infraAcaoOrdenar('${campo}','ASC');"]`);
			if (setas.length !== 1) {
				$$('.infraTh').forEach(function(possibleTh) {
					if (possibleTh.textContent === texto) th = possibleTh;
				});
			} else {
				th = setas[0].parentNode;
				while (th.tagName.toLowerCase() !== 'th') {
					th = th.parentNode;
				}
			}
			return th;
		};
		var classeTh = findTh('DesClasseJudicial', 'Classe');
		var juizoTh = findTh('SigOrgaoJuizo', 'Juízo');
		var th = classeTh || juizoTh;
		if (th === null) {
			var tr = $$('tr[data-classe]');
			if (tr.length > 0) {
				let table;
				for (
					table = tr[0].parentNode;
					table.tagName.toUpperCase() != 'TABLE';
					table = table.parentNode
				);
				$$('.infraTh', table).forEach(function(th) {
					if (/^Classe( Judicial)?$/.test(th.textContent)) {
						classeTh = th;
					}
				});
			}
			th = classeTh;
		}
		if (th === null) {
			$$('.infraTh').forEach(function(th) {
				if (/^Classe( Judicial)?$/.test(th.textContent.trim())) {
					classeTh = th;
				}
			});
			th = classeTh;
		}
		if (th !== null) {
			var table = th.parentNode.parentNode;
			while (table.tagName.toLowerCase() != 'table') {
				table = table.parentNode;
			}
			table.removeAttribute('width');
			$$('th', table).forEach(function(th) {
				th.removeAttribute('width');
			});
			Array.prototype.forEach.call(table.rows, function(tr) {
				if (!tr.className.match(/infraTr(Clara|Escura)/)) return;
				if (juizoTh) {
					var color = null,
						juizoIndex = juizoTh.cellIndex,
						juizoCell = tr.cells[juizoIndex],
						juizoText = juizoCell.textContent,
						juizo = juizoText[juizoText.length - 1];
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
	corrigirCss: function(rule) {
		var extra = Eproc.getStyle('extraCorrecaoCss');
		extra.innerHTML = 'div.infraAreaDados { height: auto !important; overflow: inherit; }';
		extra.innerHTML += rule;
	},
	entrar: function() {
		Eproc.corrigirCss('#fldLogin { position: static; margin: 6% auto; }');
	},
	entrar_cert: function() {
		this.entrar();
	},
	getStyle: function(id) {
		var extraStyle = $(`#${id}`);
		if (!extraStyle) {
			extraStyle = document.createElement('style');
			extraStyle.id = id;
			$('head').appendChild(extraStyle);
		}
		return extraStyle;
	},
	getMenu: function() {
		var menu = $('#main-menu');
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
			var p = 0,
				params = window.location.search
					.split('?')
					.splice(0)
					.join('')
					.split('&'),
				param;
			p < params.length && (param = params[p]);
			p++
		) {
			var nameValue = param.split('=');
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
		var barraSistema = $('.infraBarraSistema');
		if (barraSistema) {
			await Eproc.mudaEstilos();
		}
		var pesquisaRapida = $('#txtNumProcessoPesquisaRapida');
		if (pesquisaRapida) {
			if ('placeholder' in pesquisaRapida) {
				pesquisaRapida.setAttribute('placeholder', 'Pesquisa');
				pesquisaRapida.removeAttribute('value');
				pesquisaRapida.removeAttribute('style');
				pesquisaRapida.removeAttribute('onclick');
			}
		}
		var global = $('#divInfraAreaGlobal');
		if (global) {
			var wrapper = document.createElement('div');
			wrapper.className = 'extraWrapper';
			global.parentNode.insertBefore(wrapper, global);
			wrapper.appendChild(global);
		}
		var barra = $('#divInfraBarraTribunalD');
		if (barra) {
			var div = document.createElement('div');
			div.className = 'infraAcaoBarraSistema';
			var a = document.createElement('a');
			a.id = 'extraConfiguracaoComplemento';
			a.addEventListener('click', () => browser.runtime.sendMessage({ type: 'options' }), false);
			var img = document.createElement('img');
			img.className = 'infraImg';
			img.src = browser.runtime.getURL('chrome/skin/stapler-16.png');
			a.appendChild(img);
			div.appendChild(a);
			var upperDiv;
			if (pesquisaRapida) {
				for (
					upperDiv = pesquisaRapida.parentNode;
					upperDiv.className != 'infraAcaoBarraSistema';
					upperDiv = upperDiv.parentNode
				);
				upperDiv.parentNode.insertBefore(div, upperDiv.nextSibling.nextSibling.nextSibling);
			} else if ($('#lnkSairSistema')) {
				for (
					upperDiv = $('#lnkSairSistema').parentNode;
					upperDiv.className != 'infraAcaoBarraSistema';
					upperDiv = upperDiv.parentNode
				);
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

		function Icone() {
			var getIcone = function() {
				var icone = document.createElement('img');
				icone.width = 16;
				icone.height = 16;
				icone.className = 'extraIconeAcao noprint';
				getIcone = function() {
					return icone;
				};
				return getIcone();
			};

			this.addToLink = function(link) {
				link.insertBefore(getIcone(), link.firstChild);
			};

			this.setSrc = function(src) {
				getIcone().src = src;
			};
		}

		function InfraIcone(arquivo) {
			Icone.call(this);
			this.setSrc(`infra_css/imagens/${arquivo}`);
		}
		InfraIcone.prototype = new Icone();

		function ChromeIcone(arquivo) {
			Icone.call(this);
			this.setSrc(browser.runtime.getURL(`chrome/skin/${arquivo}`));
		}
		ChromeIcone.prototype = new Icone();
		var acoes = getAcoes();
		var botoesDesabilitados = Eproc.prefUsuario(5) == 'N';
		if (acoes && !botoesDesabilitados) {
			var fieldset = $('#fldAcoes');
			var legend = $('legend', fieldset);
			if (legend) {
				var opcoes = document.createElement('div');
				opcoes.className = 'extraAcoesOpcoes noprint';
				legend.appendChild(opcoes);
				var chkMostrarIcones = new CheckBox('v2.mostraricones', 'Mostrar ícones');
				chkMostrarIcones.vincularElementoClasse(fieldset, 'extraAcoesMostrarIcones');
				opcoes.appendChild(chkMostrarIcones.getLabel());
			}
			acoes.forEach(function(acao) {
				if (!acao.classList.contains('infraButton')) {
					acao.classList.add('extraLinkAcao');
				}
				var sublinhados = $$('u', acao);
				if (sublinhados.length == 1) {
					var u = sublinhados[0];
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
				var acaoControlador = /\?acao=([^&]+)/.exec(acao.href);
				if (acaoControlador && acaoControlador.length == 2) {
					var icone = null;
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
					var span = document.createElement('span');
					span.className = 'extraAcoesSeparador';
					span.textContent = acao.nextSibling.textContent;
					acao.parentNode.replaceChild(span, acao.nextSibling);
				}
			});
		}

		function getAcoes() {
			var acoes = $$('#fldAcoes > center a');
			if (acoes.length === 0) return false;
			return acoes;
		}
	},
	mudaEstilos: async function() {
		function getCss(name) {
			return fetch(browser.runtime.getURL(`chrome/skin/${name}.css`)).then(data => data.text());
		}

		function getStyleElement(skin) {
			var styleElementName;
			if (typeof skin == 'undefined') {
				styleElementName = 'extraMain';
			} else if (skin == 'print') {
				styleElementName = 'extraPrint';
			} else if (/-extra$/.test(skin)) {
				styleElementName = 'extraSkinExtra';
			}
			return Eproc.getStyle(styleElementName);
		}

		async function addStyleSheet(name) {
			var estilo = getStyleElement(name);
			var media = name == 'print' ? 'print' : 'screen';
			estilo.media = media;
			if (typeof name == 'undefined') name = 'screen';
			var css = `.no${name} { display: none; }\n`;
			if (name == 'screen') name = 'eprocV2';
			css += await getCss(name);
			estilo.innerHTML = css;
		}
		await addStyleSheet();
		await addStyleSheet('print');

		$$(
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

		var estilosPersonalizados = $('link[href^="css/estilos.php?skin="]');
		if (estilosPersonalizados) {
			var result = /\?skin=([^&]+)/.exec(estilosPersonalizados.href);
			var skin;
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
	usuario_tipo_monitoramento_localizador_listar: function() {
		var linhas = $$('#divInfraAreaTabela tr[class^="infraTr"]');
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
	},
	principal_destino: async function() {
		Eproc.corrigirCss('');
		var linhas = $$('#fldProcessos tr[class^="infraTr"], #fldLocalizadores tr[class^="infraTr"]');
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
		var botao = $('#lnkConfiguracaoSistema');
		var novasConfiguracoesMostradas =
			(await browser.storage.local.get()).novasconfiguracoes4mostradas || true;
		if (botao) {
			if (!novasConfiguracoesMostradas) {
				var resposta = confirm(
					'Você deve configurar algumas opções antes de continuar.\n\nDeseja abrir a tela de configurações agora?'
				);
				if (resposta === true) {
					window.location.href = botao.href;
				}
			}
			var xhr = new XMLHttpRequest();
			xhr.open('GET', botao.href);
			xhr.onreadystatechange = function() {
				if (this.readyState == 4 && this.status == 200) {
					var div = document.createElement('div');
					div.innerHTML = this.responseText;
					var storage = window.localStorage;
					if (storage.length) {
						for (let key in storage) {
							if (/^ch\d+$/.test(key)) {
								storage.removeItem(key);
							}
						}
					}
					$$('input[type=checkbox][id^="ch"]', div).forEach(function(input) {
						storage[input.id] = input.checked ? 'S' : 'N';
					});
				}
			};
			xhr.send('');
		}
	},
	decorarLinhasTabelaLocalizadores: function(linhas) {
		linhas.forEach(function(linha) {
			var link = getLink(linha);
			var url = getUrl(link);
			var processos = getQtdProcessos(link);
			linha.classList.add('extraLocalizador');
			linha.setAttribute('data-processos', processos);
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

		function getLink(tr) {
			try {
				return tr.cells[1].querySelector('a');
			} catch (e) {
				return null;
			}
		}

		function getUrl(a) {
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

		function getQtdProcessos(a) {
			try {
				return a.textContent;
			} catch (e) {
				return 0;
			}
		}
	},
	processo_cadastrar_2: function() {
		var auto = $('#txtDesAssunto');
		if (auto) {
			auto.style.width = `${auto.clientWidth}px`;
		}
	},
	processo_consulta_listar: function() {
		var form = $('#frmProcessoEventoLista');
		form.action = window.location.pathname + window.location.search;
		var docsGedpro = $('#divDocumentosGedpro');
		if (docsGedpro) {
			var linkSecao = $('#divInfraBarraTribunalE').getElementsByTagName('a')[0];
			var estado = linkSecao.hostname.match(/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/),
				host = 'trf4',
				linkGedpro = null;
			if (estado) {
				host = `jf${estado[1]}`;
			}
			linkGedpro = `http://gedpro.${host}.jus.br/visualizarDocumentos.asp?codigoDocumento=`;
			var Doc = function(processo, numero, tipo) {
				this.toString = function() {
					return [tipo, numero].join(' ');
				};
				this.link = document.createElement('a');
				this.link.textContent = this.toString();
				this.link.href = linkGedpro + numero;
				this.link.target = '_blank';
				this.link.setAttribute('data-doc', numero);
			};
			Doc.fromRow = function(row) {
				var processo = row.cells[0].textContent;
				var numero = row.cells[1].textContent.replace(/^ged_/, '');
				var tipo = row.cells[2].textContent;
				return new Doc(processo, numero, tipo);
			};
			var thead = form.querySelector('.infraTable > tbody > tr:first-child');
			var th = document.createElement('th');
			th.className = 'infraTh';
			th.textContent = 'Documento Gedpro';
			thead.appendChild(th);
			var processos = form.querySelectorAll('.infraTable > tbody > tr[class^=infraTr]');
			$$('tr[class^=infraTr]', docsGedpro).forEach(function(row, r) {
				var doc = Doc.fromRow(row);
				var newCell = processos[r].insertCell(processos[r].cells.length);
				newCell.appendChild(doc.link);
				row.parentNode.removeChild(row);
			});
			window.wrappedJSObject.analisarDocs();
		}
	},
	processo_evento_paginacao_listar: function() {
		this.processo_selecionar();
	},
	processo_seleciona_publica: function() {
		this.processo_selecionar();
	},
	processo_selecionar: function() {
		Gedpro.getLinkElement(function() {
			var linkCargaDocs;
			var div = document.createElement('div');
			div.id = 'cargaDocsGedpro';
			linkCargaDocs = new VirtualLink('Carregar documentos do GEDPRO', Gedpro.getDocs);
			linkCargaDocs.id = 'linkCargaDocs';
			if ($$('a.infraButton').length) {
				linkCargaDocs.className = 'infraButton';
			} else {
				linkCargaDocs.className = 'extraLinkAcao';
			}
			var transformed = false;
			linkCargaDocs.transform = function() {
				if (transformed) {
					return;
				}
				transformed = true;
				this.removeTrigger();
				this.classList.remove('extraLinkAcao');
				this.textContent = 'Falta de permissão de acesso?';
				this.addEventListener('click', Gedpro.getNewLogin, false);
			};
			div.appendChild(linkCargaDocs);
			var fldMinutas = $('#fldMinutas');
			fldMinutas.parentNode.insertBefore(document.createElement('br'), fldMinutas.nextSibling);
			fldMinutas.parentNode.insertBefore(div, fldMinutas.nextSibling.nextSibling);
		});
		var iconTrueColor = {};
		iconTrueColor['DOC'] = 'imagens/tree_icons/page_word.gif';
		iconTrueColor['RTF'] = 'imagens/tree_icons/page_word.gif';
		iconTrueColor['XLS'] = 'imagens/tree_icons/page_excel.gif';
		iconTrueColor['TXT'] = 'imagens/tree_icons/page_white.gif';
		iconTrueColor['PDF'] = 'imagens/tree_icons/page_white_acrobat.gif';
		iconTrueColor['GIF'] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['JPEG'] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['JPG'] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['PNG'] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['HTM'] = 'imagens/tree_icons/page_world.gif';
		iconTrueColor['HTML'] = 'imagens/tree_icons/page_world.gif';
		iconTrueColor['MP3'] = 'infra_css/imagens/audio.gif';
		iconTrueColor['MPG'] = 'infra_css/imagens/video.gif';
		iconTrueColor['MPEG'] = 'infra_css/imagens/video.gif';
		iconTrueColor['WMV'] = 'infra_css/imagens/video.gif';
		iconTrueColor['N/A'] = 'imagens/tree_icons/page_white_error.gif';

		$$('.infraTable').forEach(function(table) {
			if (
				table.getAttribute('summary') == 'Eventos' ||
				table.rows[0].cells[0].textContent == 'Evento'
			) {
				applyTableModifications(table);
			}
		});

		function applyTableModifications(table) {
			if (!table.tHead) {
				table.createTHead();
				var firstRow = table.rows[0];
				if (firstRow.cells[0].tagName == 'TH') {
					table.tHead.appendChild(firstRow);
				}
			}
			$$('th', table).forEach(function(th) {
				th.removeAttribute('width');
			});
			var eventosReferidos = {};
			table.addEventListener(
				'click',
				function(e) {
					var docLink = e.target;
					if (docLink.hasAttribute('data-doc')) {
						var lastClicked = $('#lastClicked');
						if (lastClicked) {
							lastClicked.removeAttribute('id');
						}
						docLink.id = 'lastClicked';
						var menuFechar = $('#extraFechar');
						if (menuFechar) {
							menuFechar.style.visibility = 'visible';
						}
					}
				},
				false
			);
			$$('tr[class^="infraTr"], tr[bgcolor="#FFFACD"]', table).forEach(function(tr) {
				var colunaDescricao = tr.cells[tr.cells.length - 3];
				var texto = colunaDescricao.textContent;
				var numeroEvento = /^\d+/.exec(tr.cells[tr.cells.length - 5].textContent)[0];
				if (/Refer\. ao Evento: \d+$/.test(texto)) {
					var eventoReferido = /\d+$/.exec(texto)[0];
					if (!(eventoReferido in eventosReferidos)) {
						eventosReferidos[eventoReferido] = [];
					}
					eventosReferidos[eventoReferido].push(tr);
				} else if (numeroEvento in eventosReferidos) {
					var parte = $('.infraEventoPrazoParte', tr);
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
		var menu = Eproc.getMenu();
		if (menu) {
			var fechar = document.createElement('li');
			fechar.id = 'extraFechar';
			fechar.style.visibility = 'hidden';
			var fecharLink = new VirtualLink('Fechar as janelas abertas', Eproc.closeAllWindows);
			fechar.appendChild(fecharLink);
			menu.appendChild(fechar);
			var fecharFixado = false,
				fecharAltura,
				fecharY,
				posicaoIdeal,
				paginaY;
			var afixar = function() {
				fechar.style.position = 'fixed';
				fechar.style.top = `${posicaoIdeal}px`;
				fechar.style.width = `${menu.clientWidth}px`;
				fecharFixado = true;
			};
			var desafixar = function() {
				fechar.style.position = '';
				fechar.style.top = '';
				fechar.style.width = '';
				fecharFixado = false;
			};
			var debounce = function(callback, ms) {
				var timer, context, args;
				return function() {
					window.clearTimeout(timer);
					context = this;
					args = arguments;
					timer = window.setTimeout(function() {
						return callback.apply(context, args);
					}, ms);
				};
			};
			var throttle = function(callback) {
				var atualizando = false,
					context,
					args;
				var atualizar = function() {
					callback.apply(context, args);
					atualizando = false;
				};
				return function() {
					if (!atualizando) {
						context = this;
						args = arguments;
						window.requestAnimationFrame(atualizar);
						atualizando = true;
					}
				};
			};
			var atualizar = throttle(function() {
				if (fecharY - paginaY < posicaoIdeal) {
					if (!fecharFixado) {
						afixar();
					}
				} else if (fecharFixado) {
					desafixar();
				}
			});
			var onScroll = function() {
				paginaY = window.pageYOffset;
				atualizar();
			};
			window.addEventListener('scroll', onScroll, false);
			var calcularDimensoes = function() {
				desafixar();
				fecharAltura = fechar.clientHeight;
				fecharY = fechar.offsetTop;
				posicaoIdeal = (window.innerHeight - fecharAltura) / 2;
				onScroll();
			};
			var onResize = debounce(calcularDimensoes, 50);
			window.addEventListener('resize', onResize, false);
			$('#lnkInfraMenuSistema').addEventListener('click', onResize, false);
			var inicializar = debounce(calcularDimensoes, 300);
			inicializar();
		}
	},
	isSegundoGrau: function() {
		return this.getEstado() === null;
	},
	getEstado: function() {
		var linkSecao = $('#divInfraBarraTribunalE a');
		var estado = (linkSecao ? linkSecao.hostname : window.location.hostname).match(
			/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/
		);
		if (estado) return estado[1];
		return null;
	},
	getNumprocF: function(numproc) {
		var numprocF = '';
		for (let i = 0, len = numproc.length; i < len; i++) {
			let d = numproc.substr(i, 1);
			if (i == 7) numprocF += '-';
			if (i == 9 || i == 13 || i == 16) numprocF += '.';
			numprocF += d;
		}
		return numprocF;
	},
	prefUsuario: function(num) {
		var storage = window.localStorage;
		if (`ch${num}` in storage) {
			return storage[`ch${num}`];
		}
		return null;
	},
	usuario_personalizacao_configuracao: async function() {
		var corCapa = $('#ch1');
		if (corCapa) {
			document.body.addEventListener(
				'keydown',
				function(e) {
					if (e.shiftKey && e.ctrlKey) {
						corCapa.name = '2';
					}
				},
				false
			);
			document.body.addEventListener(
				'keyup',
				function() {
					if (corCapa.name != '1') {
						corCapa.name = '1';
					}
				},
				false
			);
		}
		var storage = window.localStorage;
		$$('input[type=checkbox][id^="ch"]').forEach(function(input) {
			input.addEventListener(
				'click',
				function() {
					storage[`ch${this.name}`] = this.checked ? 'S' : 'N';
				},
				false
			);
		});

		var botao = $('#lnkConfiguracaoSistema');
		var novasConfiguracoesMostradas =
			(await browser.storage.local.get()).novasconfiguracoes4mostradas || true;
		if (botao && !novasConfiguracoesMostradas) {
			window.alert(
				'Por favor, verifique se todas as configurações estão de acordo com suas preferências.'
			);
			novasConfiguracoesMostradas = true;
			browser.storage.local.set({ novasconfiguracoes4mostradas: true });
			var tooltip = new Tooltip(
				'Este ícone permite acessar novamente as configurações a qualquer momento.'
			);
			tooltip.vincular(botao);
			window.addEventListener('resize', tooltip.desenhar, false);
			botao.addEventListener('mouseover', tooltip.ocultar, false);
		}
	},
};
function analisarVersao(FeP) {
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
	const comparacao = numeroVersaoInstalada.reduce(
		(acc, x, i) => acc.concat(Ordering.compare(x, numeroVersaoCompativel[i])),
		Ordering.empty()
	).value;
	window.wrappedJSObject.FeP.versaoUsuarioCompativel = comparacao !== Ordering.LT;
}

class Ordering {
	static get LT() {
		return -1;
	}
	static get EQ() {
		return 0;
	}
	static get GT() {
		return +1;
	}

	constructor(value) {
		this.value = value;
	}

	concat(that) {
		return this.value === Ordering.EQ ? that : this;
	}

	static empty() {
		return new Ordering(Ordering.EQ);
	}
	static compare(a, b) {
		return new Ordering(a < b ? Ordering.LT : a > b ? Ordering.GT : Ordering.EQ);
	}
}

function Tooltip(texto) {
	var adicionarElementos;
	var div = document.createElement('div');
	div.innerHTML = '<img src="imagens/tooltip/arrow3.gif" style="position: absolute;"/>';
	var img = div.firstChild;
	div.innerHTML = `<div style="position: absolute; background: lightyellow; border: 1px solid black; font-size: 1.2em; width: 30ex; text-align: center; padding: 10px;">${texto}</div>`;
	div = div.firstChild;
	var elementoVinculado,
		x = 0,
		y = 0;
	this.vincular = function(elemento) {
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

	function calcularXY(elemento) {
		for (x = 0, y = 0; elemento !== null; elemento = elemento.offsetParent) {
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

function VirtualLink(texto, funcao) {
	var vLink = document.createElement('a');
	vLink.href = '#';
	vLink.innerHTML = texto;
	var fn = function(e) {
		e.preventDefault();
		e.stopPropagation();
		funcao.call(this);
	};
	vLink.addEventListener('click', fn, false);
	vLink.removeTrigger = function() {
		this.removeEventListener('click', fn, false);
	};
	return vLink;
}
Eproc.init();
