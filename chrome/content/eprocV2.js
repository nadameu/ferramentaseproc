/* global GM_yesCancelNo GM_yesNo GM_analisarVersao GM_showPreferences GM_getBase64 GM_confirmCheck IELauncher */

function $(selector, baseElement = document) {
	return baseElement.querySelector(selector);
}

function $$(selector, baseElement = document) {
	var elements = baseElement.querySelectorAll(selector);
	return Array.from(elements);
}

function CheckBox(nomePreferencia, texto) {
	const checkbox = document.createElement('input');
	checkbox.type = 'checkbox';
	checkbox.checked = GM_getValue(nomePreferencia, false);
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
			GM_setValue(nomePreferencia, selecionado);
			alterarClasse(selecionado);
		});
		alterarClasse(checkbox.checked);
	};
}

var Gedpro = (function() {
	var linkElement, link, grupos, docsUrl, host;
	var statuses = [],
		buscando = false;
	var GedproNodes = function(doc) {
		$$('reg', doc).forEach(function(reg) {
			var node = GedproNode.fromReg(reg);
			this.maiorIcone = Math.max(this.maiorIcone, node.icones.length);
			this.push(node);
		}, this);
	};
	GedproNodes.prototype = [];
	GedproNodes.prototype.constructor = GedproNodes;
	GedproNodes.prototype.maiorIcone = 0;
	GedproNodes.prototype.accept = function(visitor) {
		visitor.visitNodes(this);
		this.forEach(function(node) {
			visitor.visit(node);
		}, this);
	};
	var GedproIcones = function(str) {
		for (var i = 0; i < str.length; i += 3) {
			var icone = new GedproIcone(str.substr(i, 3));
			this.push(icone);
		}
	};
	GedproIcones.prototype = [];
	GedproIcones.prototype.constructor = GedproIcones;
	var GedproIcone = function(str) {
		if (str in GedproIcone.ARQUIVOS) {
			this.arquivo = GedproIcone.ARQUIVOS[str];
		}
	};
	GedproIcone.prototype = {
		arquivo: 'Vazio',
		toImg: function() {
			var img = document.createElement('img');
			img.className = 'extraGedproImg';
			img.src = `http://${host}/images/${this.arquivo}.gif`;
			return img;
		},
	};
	GedproIcone.ARQUIVOS = {
		iWO: 'Word',
		iPO: 'Papiro',
		PDF: 'pdfgedpro',
		iPF: 'PastaAberta',
		'iL+': 'L-',
		'iT+': 'T-',
		iL0: 'L',
		iT0: 'T',
		i00: 'Vazio',
		iI0: 'I',
		'0': 'documento', // Em edi\u00e7\u00e3o
		'1': 'chave', // Bloqueado
		'2': 'valida', // Pronto para assinar
		'3': 'assinatura', // Assinado
		'4': 'fase', // Movimentado
		'5': 'procedimentos', // Devolvido
		'6': 'localizador', // Arquivado
		'7': 'excluidos', // Anulado
		'8': 'abrirbloco', // Conferido
	};
	var GedproNode = function(reg) {
		if (typeof reg == 'undefined') return;
		this.icones = new GedproIcones(reg.getAttribute('icones'));
	};
	GedproNode.prototype = {
		rotulo: '',
		accept: function(visitor) {
			visitor.visitNode(this);
		},
	};
	GedproNode.fromReg = function(reg) {
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
	};
	var GedproDoc = function(reg) {
		GedproNode.apply(this, arguments);
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
	};
	GedproDoc.prototype = new GedproNode();
	GedproDoc.prototype.constructor = GedproDoc;
	GedproDoc.prototype.getClasse = function() {
		if (this.maiorAcesso >= 8) {
			return 'extraGedproRotuloGreen';
		} else if (this.maiorAcesso >= 2) {
			return 'extraGedproRotuloBlue';
		}
		return 'extraGedproRotuloGray';
	};
	GedproDoc.prototype.accept = function(visitor) {
		visitor.visitDoc(this);
	};
	GedproDoc.STATUSES = {
		0: 'Em edi\u00e7\u00e3o',
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
	var GedproProcesso = function() {
		GedproNode.apply(this, arguments);
		this.rotulo = 'Documentos do GEDPRO';
	};
	GedproProcesso.prototype = new GedproNode();
	GedproProcesso.prototype.constructor = GedproProcesso;
	var GedproIncidente = function(reg) {
		GedproNode.apply(this, arguments);
		this.rotulo = reg.getAttribute('descricaoIncidente');
	};
	GedproIncidente.prototype = new GedproNode();
	GedproIncidente.prototype.constructor = GedproIncidente;
	var GedproDocComposto = function(reg) {
		GedproNode.apply(this, arguments);
		this.rotulo = `${reg.getAttribute(
			'nomeTipoDocComposto'
		)} ${reg.getAttribute('identificador')}/${reg.getAttribute('ano')}`;
	};
	GedproDocComposto.prototype = new GedproNode();
	GedproDocComposto.prototype.constructor = GedproDocComposto;
	var GedproTabela = (function() {
		var table;
		var getTable = function() {
			if (! table) {
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
			if (! tHead) {
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
			[
				'Documento',
				'N\u00famero',
				'Status',
				'Data Documento',
				'Cria\u00e7\u00e3o',
				'Edi\u00e7\u00e3o',
			].forEach(function(text) {
				var th = document.createElement('th');
				th.className = 'infraTh';
				th.textContent = text;
				tr.appendChild(th);
			});
			tr.cells[2].colSpan = 2;
		};
		var tBody;
		var getTBody = function() {
			if (! tBody) {
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
			if (! tFoot) {
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
			trClassName =
				trClassName == 'infraTrClara' ? 'infraTrEscura' : 'infraTrClara';
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
				cell.appendChild(document.createTextNode('P\u00e1gina '));
				for (var p = 1; p <= maiorPagina; p++) {
					if (p == pagina) {
						var span = document.createElement('span');
						span.className = 'extraGedproPaginaAtual';
						span.textContent = pagina;
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
									window.wrappedJSObject.documentosAbertos[
										`${Eproc.processo}${node.codigo}`
									];
								if (typeof win == 'object' && ! win.closed) {
									return win.focus();
								}
								window.wrappedJSObject.documentosAbertos[
									`${Eproc.processo}${node.codigo}`
								] = window.open(
									`http://${host}/visualizarDocumentos.asp?origem=pesquisa&ignoraframes=sim&codigoDocumento=${node.codigo}`,
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
				row.insertCell(
					row.cells.length
				).innerHTML = `${doc.criador}<br/>${doc.dataCriacao}`;
				row.insertCell(
					row.cells.length
				).innerHTML = `Vers\u00e3o ${doc.versao} por ${doc.editor} em<br/>${doc.dataVersao}`;
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
				window.alert(
					'A solicita\u00e7\u00e3o j\u00e1 foi enviada. Por favor aguarde.'
				);
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
				docsUrl = `http://${host}/XMLInterface.asp?processo=${Eproc.processo}&ProcessoVisual=PV&grupos=${grupos}`;
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
					'N\u00e3o foi poss\u00edvel obter os grupos do usu\u00e1rio.\nEstar\u00e3o acess\u00edveis apenas os documentos com visibilidade p\u00fablica.'
				);
				return setPublicGroups();
			};
			Gedpro.getLogin(
				function() {
					Gedpro.pushStatus('Obtendo grupos do usu\u00e1rio...');
					GM_xmlhttpRequest({
						method: 'GET',
						url: `http://${host}/arvore2.asp?modulo=Textos do Processo&processo=${Eproc.processo}&numeroProcessoVisual=NPV&localizadorProcesso=LP`,
						onload: function(obj) {
							Gedpro.popStatus();
							try {
								[, grupos] = obj.responseText.match(/&grupos=([^&]+)&/);
							} catch (e) {
								return onerror();
							}
							Gedpro.getGrupos(callback);
						},
						onerror: onerror,
					});
				},
				function() {
					Gedpro.warn(
						'N\u00e3o \u00e9 poss\u00edvel obter os grupos do usu\u00e1rio.\nEstar\u00e3o acess\u00edveis apenas os documentos com visibilidade p\u00fablica.'
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
				var xhr = new window.XMLHttpRequest();
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
							Gedpro.error(
								'N\u00e3o foi poss\u00edvel obter o endere\u00e7o do GEDPRO.'
							);
						}
					}
				};
				Gedpro.pushStatus('Obtendo endere\u00e7o do GEDPRO...');
				xhr.send();
			});
		},
		getLinkElement: function(callback) {
			if (linkElement) {
				return callback(linkElement);
			}
			var links = $$(
				'a[href^="view/movimentacao/acessar_processo_gedpro.php?acao=acessar_processo_gedpro&"]'
			);
			if (links.length == 1) {
				linkElement = links[0];
				Gedpro.getLinkElement(callback);
			}
		},
		getLoginForm: function(callback) {
			var getLinkCallback;
			getLinkCallback = function(link) {
				Gedpro.pushStatus('Obtendo link de requisi\u00e7\u00e3o de login...');
				GM_xmlhttpRequest({
					method: 'GET',
					url: link,
					onload: function(obj) {
						Gedpro.popStatus();
						var formLogin = /FormLogin\.asp\?[^"]+/.exec(obj.responseText);
						var mainframePage = /\/mainframe\.asp\?[^"]+/.exec(
							obj.responseText
						);
						if (formLogin) {
							var loginForm = `http://${host}/${formLogin}`;
							return callback(loginForm);
						} else if (mainframePage) {
							var mainframe = `http://${host}${mainframePage}`;
							getLinkCallback(mainframe);
						} else {
							Gedpro.error(
								'N\u00e3o foi poss\u00edvel obter o link de requisi\u00e7\u00e3o de login.'
							);
						}
					},
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
					Gedpro.error('N\u00e3o \u00e9 poss\u00edvel fazer login no GEDPRO.');
				};
			Gedpro.getLoginForm(function(loginForm) {
				Gedpro.pushStatus('Verificando possibilidade de login...');
				GM_xmlhttpRequest({
					method: 'GET',
					url: loginForm,
					onload: function(obj) {
						Gedpro.popStatus();
						if (/<!-- Erro /.test(obj.responseText)) {
							onerror();
						} else {
							return callback(loginForm);
						}
					},
				});
			});
		},
		getXml: function(pagina, callback) {
			Gedpro.getDocsUrl(function(docsUrl) {
				Gedpro.pushStatus(
					`Carregando p\u00e1gina ${pagina} da \u00e1rvore de documentos...`
				);
				GM_xmlhttpRequest({
					method: 'GET',
					url: `${docsUrl}&pgtree=${pagina}`,
					mimeType: 'application/xml; charset=ISO-8859-1',
					onload: function(obj) {
						Gedpro.popStatus();
						var parser = new window.DOMParser();
						var xml = parser.parseFromString(
							obj.responseText,
							'application/xml'
						);
						callback(xml);
					},
					onerror: function() {
						Gedpro.error(
							`N\u00e3o foi poss\u00edvel carregar a p\u00e1gina ${pagina} da \u00e1rvore de documentos.`
						);
					},
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
			if (typeof win == 'object' && ! win.closed) {
				windows.push(win);
			}
		}
		var menuFechar = $('#extraFechar');
		if (windows.length) {
			var tela = /^processo_selecionar/.test(this.acao)
				? 'Este processo'
				: 'Esta tela';
			var msg = `${tela} possui ${windows.length} ${windows.length > 1
				? 'janelas abertas'
				: 'janela aberta'}.\nDeseja fech\u00e1-${windows.length > 1
				? 'las'
				: 'la'}?`;
			var resposta;
			if (typeof e != 'undefined') {
				resposta = GM_yesCancelNo('Janelas abertas', msg);
			} else {
				resposta = GM_yesNo('Janelas abertas', msg);
			}
			if (resposta == 'YES') {
				for (var w = windows.length - 1; w >= 0; w--) {
					windows[w].close();
				}
				if (menuFechar) {
					menuFechar.style.visibility = 'hidden';
				}
			} else if (resposta == 'CANCEL' && typeof e != 'undefined') {
				e.preventDefault();
				e.stopPropagation();
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
		var juizoTh = findTh('SigOrgaoJuizo', 'Ju\u00edzo');
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
			table.setAttribute('width', '');
			$$('th', table).forEach(function(th) {
				th.setAttribute('width', '');
			});
			Array.prototype.forEach.call(table.rows, function(tr) {
				if (! tr.className.match(/infraTr(Clara|Escura)/)) return;
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
		extra.innerHTML =
			'div.infraAreaDados { height: auto !important; overflow: inherit; }';
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
		if (! extraStyle) {
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
	init: function() {
		if (window.wrappedJSObject.FeP) {
			GM_analisarVersao(window.wrappedJSObject.FeP);
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
			Eproc.mudaEstilos();
		}
		var pesquisaRapida = $('#txtNumProcessoPesquisaRapida');
		if (pesquisaRapida) {
			if ('placeholder' in pesquisaRapida) {
				pesquisaRapida.setAttribute('placeholder', 'N\u00ba. processo');
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
			a.addEventListener(
				'click',
				function() {
					GM_showPreferences();
				},
				false
			);
			var img = document.createElement('img');
			img.className = 'infraImg';
			img.src = `data:image/png;base64,${GM_getBase64(
				'chrome://eproc/skin/stapler-16.png'
			)}`;
			a.appendChild(img);
			div.appendChild(a);
			var upperDiv;
			if (pesquisaRapida) {
				for (
					upperDiv = pesquisaRapida.parentNode;
					upperDiv.className != 'infraAcaoBarraSistema';
					upperDiv = upperDiv.parentNode
				);
				upperDiv.parentNode.insertBefore(
					div,
					upperDiv.nextSibling.nextSibling.nextSibling
				);
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
		Gedpro.getLinkElement(function(linkGedpro) {
			var onclick;
			try {
				onclick = linkGedpro.getAttribute('onclick');
				[, linkGedpro.href] = onclick.match(/window.open\('([^']+)'/);
				linkGedpro.target = '_blank';
			} catch (e) {
				// do nothing
			}
			linkGedpro.removeAttribute('onclick');
			var onclickFunction = new Function('e', onclick);
			linkGedpro.addEventListener(
				'click',
				function(e) {
					e.preventDefault();
					e.stopPropagation();
					var abrirComIE = GM_getValue('v2.ie.enable', true);
					var botao = $('#extraConfiguracaoComplemento');
					var mensagemMostrada = GM_getValue('v2.ie.mensagemmostrada', false);
					if (botao && ! mensagemMostrada) {
						var naoMostrar = {
							value: false,
						};
						var confirmacao = GM_confirmCheck(
							'Navegador padr\u00e3o',
							`Seu computador est\u00e1 configurado para abrir o Gedpro com o ${abrirComIE
								? 'Internet Explorer'
								: 'Firefox'}.\nCaso deseje mudar esta configura\u00e7\u00e3o, clique em "Cancelar".`,
							'N\u00e3o mostrar esta mensagem novamente',
							naoMostrar
						);
						if (naoMostrar.value === true) {
							GM_setValue('v2.ie.mensagemmostrada', true);
						}
						if (! confirmacao) {
							botao.scrollIntoView();
							var tooltip = new Tooltip(
								'<p style="font-weight: bold;">CONFIGURA\u00e7\u00d5ES</p><p>Este \u00edcone permite acessar as configura\u00e7\u00f5es a qualquer momento.</p><p>Na aba "e-Proc V2", marque ou desmarque a op\u00e7\u00e3o "Abrir Gedpro com Internet Explorer".</p>'
							);
							tooltip.vincular(botao);
							window.addEventListener('resize', tooltip.desenhar, false);
							botao.addEventListener(
								'click',
								function() {
									tooltip.ocultar();
								},
								false
							);
							return;
						}
					}
					if (abrirComIE) {
						Gedpro.getLink(function(url) {
							IELauncher(url);
						});
					} else {
						onclickFunction.apply(this, arguments);
					}
				},
				false
			);
		});
		if (this.acao && this[this.acao]) {
			this[this.acao]();
		} else if (
			this.parametros.acao_origem &&
			this[`${this.parametros.acao_origem}_destino`]
		) {
			this[`${this.parametros.acao_origem}_destino`]();
		}
		window.addEventListener(
			'beforeunload',
			function() {
				delete this.Eproc;
			},
			false
		);

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
			this.setSrc(`../infra_css/imagens/${arquivo}`);
		}
		InfraIcone.prototype = new Icone();

		function ChromeIcone(arquivo) {
			Icone.call(this);
			var mime = `image/${/...$/.exec(arquivo)}`;
			this.setSrc(
				`data:${mime};base64,${GM_getBase64(`chrome://eproc/skin/${arquivo}`)}`
			);
		}
		ChromeIcone.prototype = new Icone();
		var acoes = getAcoes();
		var botoesDesabilitados = Eproc.prefUsuario(5) == 'N';
		if (acoes && ! botoesDesabilitados) {
			var fieldset = $('#fldAcoes');
			var legend = $('legend', fieldset);
			if (legend) {
				var opcoes = document.createElement('div');
				opcoes.className = 'extraAcoesOpcoes noprint';
				legend.appendChild(opcoes);
				var chkMostrarIcones = new CheckBox(
					'v2.mostraricones',
					'Mostrar \u00edcones'
				);
				chkMostrarIcones.vincularElementoClasse(
					fieldset,
					'extraAcoesMostrarIcones'
				);
				opcoes.appendChild(chkMostrarIcones.getLabel());
			}
			acoes.forEach(function(acao) {
				if (! acao.classList.contains('infraButton')) {
					acao.classList.add('extraLinkAcao');
				}
				var sublinhados = $$('u', acao);
				if (sublinhados.length == 1) {
					var u = sublinhados[0];
					u.parentNode.replaceChild(u.childNodes[0], u);
				}
				if (! acao.href) {
					if (/window\.open/.test(acao.getAttribute('onclick'))) {
						acao.href = /window\.open\(['"]([^'"]+)/.exec(
							acao.getAttribute('onclick')
						)[1];
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
				if (
					acao.nextSibling &&
					acao.nextSibling.nodeType == document.TEXT_NODE
				) {
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
	mudaEstilos: function() {
		function getCss(name) {
			var css = window.atob(GM_getBase64(`chrome://eproc/skin/${name}.css`));
			return css;
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

		function addStyleSheet(name) {
			var estilo = getStyleElement(name);
			var media = name == 'print' ? 'print' : 'screen';
			estilo.media = media;
			if (typeof name == 'undefined') name = 'screen';
			var css = `.no${name} { display: none; }\n`;
			if (name == 'screen') name = 'eprocV2';
			css += getCss(name);
			estilo.innerHTML = css;
		}
		addStyleSheet();
		addStyleSheet('print');

		$$(
			'label[onclick^="listarTodos"], label[onclick^="listarEventos"], #txtEntidade, #txtPessoaEntidade'
		).forEach(function(auto) {
			var id = auto.id.replace('lblListar', 'txt');
			auto = $(`#${id}`);
			if (auto) {
				auto.style.width = `${auto.clientWidth}px`;
			}
		}, this);

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
	principal_destino: function() {
		Eproc.corrigirCss('');
		var linhas = $$(
			'#fldProcessos tr[class^="infraTr"], #fldLocalizadores tr[class^="infraTr"]'
		);
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
		var botao = $('#lnkConfiguracaoSistema');
		var novasConfiguracoesMostradas = GM_getValue(
			'v2.novasconfiguracoes4mostradas',
			false
		);
		if (botao) {
			if (! novasConfiguracoesMostradas) {
				var resposta = GM_yesNo(
					'Novas configura\u00e7\u00f5es',
					'Voc\u00ea deve configurar algumas op\u00e7\u00f5es antes de continuar.\n\nDeseja abrir a tela de configura\u00e7\u00f5es agora?'
				);
				if (resposta == 'YES') {
					window.location.href = botao.href;
				}
			}
			var xhr = new window.XMLHttpRequest();
			xhr.open('GET', botao.href);
			xhr.onreadystatechange = function() {
				if (this.readyState == 4 && this.status == 200) {
					var div = document.createElement('div');
					div.innerHTML = this.responseText;
					var storage = window.wrappedJSObject.localStorage;
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
			var processos = form.querySelectorAll(
				'.infraTable > tbody > tr[class^=infraTr]'
			);
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
			linkCargaDocs = new VirtualLink(
				'Carregar documentos do GEDPRO',
				Gedpro.getDocs
			);
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
				this.textContent = 'Falta de permiss\u00e3o de acesso?';
				this.addEventListener('click', Gedpro.getNewLogin, false);
			};
			div.appendChild(linkCargaDocs);
			var fldMinutas = $('#fldMinutas');
			fldMinutas.parentNode.insertBefore(
				document.createElement('br'),
				fldMinutas.nextSibling
			);
			fldMinutas.parentNode.insertBefore(
				div,
				fldMinutas.nextSibling.nextSibling
			);
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
		iconTrueColor['MP3'] = '../infra_css/imagens/audio.gif';
		iconTrueColor['MPG'] = '../infra_css/imagens/video.gif';
		iconTrueColor['MPEG'] = '../infra_css/imagens/video.gif';
		iconTrueColor['WMV'] = '../infra_css/imagens/video.gif';
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
			if (! table.tHead) {
				table.createTHead();
				var firstRow = table.rows[0];
				if (firstRow.cells[0].tagName == 'TH') {
					table.tHead.appendChild(firstRow);
				}
			}
			$$('th', table).forEach(function(th) {
				th.setAttribute('width', '');
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
			$$('tr[class^="infraTr"], tr[bgcolor="#FFFACD"]', table).forEach(function(
				tr
			) {
				var colunaDescricao = tr.cells[tr.cells.length - 3];
				var texto = colunaDescricao.textContent;
				var numeroEvento = /^\d+/.exec(
					tr.cells[tr.cells.length - 5].textContent
				);
				if (/Refer\. ao Evento: \d+$/.test(texto)) {
					var eventoReferido = /\d+$/.exec(texto);
					if (! (eventoReferido in eventosReferidos)) {
						eventosReferidos[eventoReferido] = [];
					}
					eventosReferidos[eventoReferido].push(tr);
				} else if (numeroEvento in eventosReferidos) {
					var parte = $('.infraEventoPrazoParte', tr);
					if (parte) {
						eventosReferidos[numeroEvento].forEach(function(linha) {
							linha.cells[
								linha.cells.length - 3
							].innerHTML += `<br>${`${colunaDescricao.innerHTML}<br>`.split(
								'<br>'
							)[1]}`;
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
			var fecharLink = new VirtualLink(
				'Fechar as janelas abertas',
				Eproc.closeAllWindows
			);
			fechar.appendChild(fecharLink);
			menu.appendChild(fechar);
			var fecharFixado = false,
				fecharAltura,
				fecharY,
				posicaoIdeal,
				paginaY;
			var desafixar = function() {
				fechar.style.position = '';
				fechar.style.top = '';
				fechar.style.width = '';
				fecharFixado = false;
			};
			var tempoLimite,
				aguardando = false;
			var atrasar = function(callback, ms) {
				tempoLimite = window.performance.now() + ms;
				aguardando ||
					(window.requestAnimationFrame(function aguardar(timestamp) {
						timestamp < tempoLimite
							? window.requestAnimationFrame(aguardar)
							: (callback(), aguardando = false);
					}),
						aguardando = true);
			};
			var atualizando = false;
			var atualizar = function() {
				fecharY - paginaY < posicaoIdeal
					? fecharFixado ||
						(fechar.style.position = 'fixed',
							fechar.style.top = `${posicaoIdeal }px`,
							fechar.style.width = `${menu.clientWidth }px`,
							fecharFixado = true)
					: fecharFixado && desafixar();
				atualizando = false;
			};
			var onScroll = function() {
				paginaY = window.pageYOffset;
				atualizando ||
					(window.requestAnimationFrame(atualizar), atualizando = true);
			};
			window.addEventListener('scroll', onScroll, false);
			var calcularDimensoes = function() {
				desafixar();
				fecharAltura = fechar.clientHeight;
				fecharY = fechar.offsetTop;
				posicaoIdeal = (window.innerHeight - fecharAltura) / 2;
				onScroll();
			};
			var onResize = function() {
				atrasar(calcularDimensoes, 200);
			};
			window.addEventListener('resize', onResize, false);
			$('#lnkInfraMenuSistema').addEventListener('click', onResize, false);
			onResize();
		}
	},
	isSegundoGrau: function() {
		return this.getEstado() === null;
	},
	getEstado: function() {
		var linkSecao = $('#divInfraBarraTribunalE a');
		var estado = (linkSecao
			? linkSecao.hostname
			: window.location.hostname).match(/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/);
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
		var storage = window.wrappedJSObject.localStorage;
		if (`ch${num}` in storage) {
			return storage[`ch${num}`];
		}
		return null;
	},
	usuario_personalizacao_configuracao: function() {
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
		var storage = window.wrappedJSObject.localStorage;
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
		var novasConfiguracoesMostradas = GM_getValue(
			'v2.novasconfiguracoes4mostradas',
			false
		);
		if (botao && ! novasConfiguracoesMostradas) {
			window.alert(
				'Por favor, verifique se todas as configura\u00e7\u00f5es est\u00e3o de acordo com suas prefer\u00eancias.'
			);
			novasConfiguracoesMostradas = GM_setValue(
				'v2.novasconfiguracoes4mostradas',
				true
			);
			var tooltip = new Tooltip(
				'Este \u00edcone permite acessar novamente as configura\u00e7\u00f5es a qualquer momento.'
			);
			tooltip.vincular(botao);
			window.addEventListener('resize', tooltip.desenhar, false);
			botao.addEventListener('mouseover', tooltip.ocultar, false);
		}
	},
};

function Tooltip(texto) {
	var adicionarElementos;
	var div = document.createElement('div');
	div.innerHTML =
		'<img src="imagens/tooltip/arrow3.gif" style="position: absolute;"/>';
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
		div.style.left = `${x +
			elementoVinculado.offsetWidth / 2 -
			div.offsetWidth +
			10}px`;
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
