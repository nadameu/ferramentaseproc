function $(selector, baseElement)
{
	if (typeof baseElement == 'undefined') {
		baseElement = document;
	}
	return baseElement.querySelector(selector);
}
function $$(selector, baseElement)
{
	if (typeof baseElement == 'undefined') {
		baseElement = document;
	}
	var elements = baseElement.querySelectorAll(selector);
	return Array.prototype.slice.call(elements);
}
var Util = {
	extend: function(obj, props)
	{
		var args = Array.prototype.slice.call(arguments);
		obj = args.shift();
		while ((props = args.shift()) != null) {
			var n;
			for (n in props) {
				obj[n] = props[n];
			}
		}
		return obj;
	}
};
function CheckBox(preferencia, texto)
{
	var checkbox, label;

	var me = this;
	var createConjunto = function()
	{
		checkbox = me.createCheckbox(me.preferencia());
		label = me.createLabel(checkbox, texto);
	};

	Util.extend(this, {
		getCheckbox: function()
		{
			if (! checkbox) {
				createConjunto();
			}
			return checkbox;
		},
		getLabel: function()
		{
			if (! label) {
				createConjunto();
			}
			return label;
		},
		preferencia: function(valor)
		{
			if (typeof valor != 'undefined') {
				return GM_setValue(preferencia, valor);
			} else {
				return GM_getValue(preferencia, false);
			}
		}
	});

}
CheckBox.prototype = {
	createCheckbox: function(valor) {
		var checkbox = document.createElement('input');
		checkbox.type = 'checkbox';
		checkbox.checked = valor;
		return checkbox;
	},
	createLabel: function(checkbox, texto) {
		var label = document.createElement('label');
		label.className = 'infraLabel noprint';
		label.appendChild(checkbox);
		label.appendChild(document.createTextNode(' ' + texto));
		return label;
	},
	vincularElementoClasse: function(elemento, classe)
	{
		var me = this;
		this.vincularModificacao(function(e)
		{
			var valor = e.target.checked;
			me.preferencia(valor);
			alterarClasse(valor);
		});
		function alterarClasse(valor)
		{
			valor ? elemento.classList.add(classe) : elemento.classList.remove(classe);
		}
		alterarClasse(this.preferencia());
	},
	vincularModificacao: function(fn)
	{
		this.getCheckbox().addEventListener('change', fn, false);
	}
};
var Gedpro = (function()
{
	var linkElement, link, login, grupos, docsUrl, host;
	var statuses = [], buscando = false;
	var GedproNodes = function(doc)
	{
		$$('reg', doc).forEach(function(reg)
		{
			var node = GedproNode.fromReg(reg);
			this.maiorIcone = Math.max(this.maiorIcone, node.icones.length);
			this.push(node);
		}, this);
	};
	GedproNodes.prototype = [];
	GedproNodes.prototype.constructor = GedproNodes;
	GedproNodes.prototype.maiorIcone = 0;
	GedproNodes.prototype.accept = function(visitor)
	{
		visitor.visitNodes(this);
		this.forEach(function(node)
		{
			visitor.visit(node);
		}, this);
	};
	var GedproIcones = function(str)
	{
		for (var i = 0; i < str.length; i += 3) {
			var icone = new GedproIcone(str.substr(i, 3));
			this.push(icone);
		}
	};
	GedproIcones.prototype = [];
	GedproIcones.prototype.constructor = GedproIcones;
	var GedproIcone = function(str)
	{
		if (str in GedproIcone.ARQUIVOS) {
			this.arquivo = GedproIcone.ARQUIVOS[str];
		}
	};
	GedproIcone.prototype = {
		arquivo: 'Vazio',
		toImg: function()
		{
			var img = document.createElement('img');
			img.className = 'extraGedproImg';
			img.src = 'http://' + host + '/images/' + this.arquivo + '.gif';
			return img;
		}
	};
	GedproIcone.ARQUIVOS = {
		'iWO': 'Word',
		'iPO': 'Papiro',
		'PDF': 'pdfgedpro',
		'iPF': 'PastaAberta',
		'iL+': 'L-',
		'iT+': 'T-',
		'iL0': 'L',
		'iT0': 'T',
		'i00': 'Vazio',
		'iI0': 'I',
		'0': 'documento', // Em edição
		'1': 'chave', // Bloqueado
		'2': 'valida', // Pronto para assinar
		'3': 'assinatura', // Assinado
		'4': 'fase', // Movimentado
		'5': 'procedimentos', // Devolvido
		'6': 'localizador', // Arquivado
		'7': 'excluidos', // Anulado
		'8': 'abrirbloco', // Conferido
	};
	var GedproNode = function(reg)
	{
		if (typeof reg == 'undefined') return;
		this.icones = new GedproIcones(reg.getAttribute('icones'));
	};
	GedproNode.prototype = {
		rotulo: '',
		accept: function(visitor)
		{
			visitor.visitNode(this);
		}
	};
	GedproNode.fromReg = function(reg)
	{
		switch (reg.getAttribute('codigoTipoNodo')) {
			case '-1':
				return new GedproDocComposto(reg);
				break;

			case '0':
				return new GedproProcesso(reg);
				break;

			case '1':
				return new GedproIncidente(reg);
				break;

			case '2':
				return new GedproDoc(reg);
				break;

		}
	};
	var GedproDoc = function(reg)
	{
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
	GedproDoc.prototype = new GedproNode;
	GedproDoc.prototype.constructor = GedproDoc;
	GedproDoc.prototype.getClasse = function()
	{
		if (this.maiorAcesso >= 8) {
			return 'extraGedproRotuloGreen';
		} else if (this.maiorAcesso >= 2) {
			return 'extraGedproRotuloBlue';
		} else {
			return 'extraGedproRotuloGray';
		}
	};
	GedproDoc.prototype.accept = function(visitor)
	{
		visitor.visitDoc(this);
	};
	GedproDoc.STATUSES = {
		0: 'Em edição',
		1: 'Bloqueado',
		2: 'Pronto para assinar',
		3: 'Assinado',
		4: 'Movimentado',
		5: 'Devolvido',
		6: 'Arquivado',
		7: 'Anulado',
		8: 'Conferido',
		9: 'Para conferir'
	};
	var GedproProcesso = function(reg)
	{
		GedproNode.apply(this, arguments);
		this.rotulo = 'Documentos do GEDPRO';
	};
	GedproProcesso.prototype = new GedproNode;
	GedproProcesso.prototype.constructor = GedproProcesso;
	var GedproIncidente = function(reg)
	{
		GedproNode.apply(this, arguments);
		this.rotulo = reg.getAttribute('descricaoIncidente');
	};
	GedproIncidente.prototype = new GedproNode;
	GedproIncidente.prototype.constructor = GedproIncidente;
	var GedproDocComposto = function(reg)
	{
		GedproNode.apply(this, arguments);
		this.rotulo = reg.getAttribute('nomeTipoDocComposto') + ' ' + reg.getAttribute('identificador') + '/' + reg.getAttribute('ano');
	};
	GedproDocComposto.prototype = new GedproNode;
	GedproDocComposto.prototype.constructor = GedproDocComposto;
	var GedproTabela = (function()
	{
		var maiorIcone = 0;
		var table;
		var getTable = function()
		{
			if (! table) {
				createTable();
			}
			return table;
		}
		var createTable = function()
		{
			table = document.createElement('table');
			table.className = 'infraTable';
		};
		var tHead;
		var getTHead = function()
		{
			if (! tHead) {
				createTHead();
			}
			return tHead;
		}
		var numCells = 7;
		var createTHead = function()
		{
			var table = getTable();
			table.deleteTHead();
			tHead = table.createTHead();
			var tr = tHead.insertRow(0);
			['Documento','Número','Status','Data Documento','Criação','Edição'].forEach(function (text, i)
			{
				var th = document.createElement('th');
				th.className = 'infraTh';
				th.textContent = text;
				tr.appendChild(th);
			});
			tr.cells[2].colSpan = 2;
		};
		var tBody;
		var getTBody = function()
		{
			if (! tBody) {
				createTBody();
			}
			return tBody;
		};
		var createTBody = function()
		{
			var table = getTable();
			if (table.tBodies.length) {
				$$('tbody', table).forEach(function(tBody)
				{
					table.removeChild(tBody);
				});
			}
			tBody = document.createElement('tbody');
			table.appendChild(tBody);
			trClassName = null;
		};
		var tFoot;
		var getTFoot = function()
		{
			if (! tFoot) {
				createTFoot();
			}
			return tFoot;
		};
		var createTFoot = function()
		{
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
		var createRow = function()
		{
			var tBody = getTBody();
			var tr = tBody.insertRow(tBody.rows.length);
			trClassName = (trClassName == 'infraTrClara') ? 'infraTrEscura' : 'infraTrClara';
			tr.className = trClassName;
			return tr;
		};
		var pagina = 1, maiorPagina = pagina;
		return {
			getPagina: function(estaPagina)
			{
				pagina = estaPagina;
				maiorIcone = 0;
				getTHead();
				createTBody();
				createTFoot();
				return table;
			},
			getTable: function()
			{
				return getTable();
			},
			visit: function(obj)
			{
				obj.accept(this);
			},
			visitNodes: function(nodes)
			{
				var possuiMaisDocumentos = (nodes.length >= 21);
				if (pagina > maiorPagina) {
					maiorPagina = pagina;
				} else if (pagina == maiorPagina && possuiMaisDocumentos) {
					maiorPagina++;
				}
				maiorIcone = nodes.maiorIcone;
				getTHead();
				var cell = getTFoot().rows[0].cells[0];
				function criaLinkPaginacaoGedpro(pagina, texto)
				{
					var link = document.createElement('a');
					link.href = '#cargaDocsGedpro';
					link.textContent = texto;
					link.addEventListener('click', function(e) {
						return Gedpro.getDocs(pagina);
					}, false);
					cell.appendChild(link);
				}
				cell.appendChild(document.createTextNode('Página '));
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
			visitNode: function(node)
			{
				var tr = createRow();
				var tdRotulo = tr.insertCell(0);
				tdRotulo.colSpan = numCells;
				node.icones.forEach(function(icone)
				{
					tdRotulo.appendChild(icone.toImg());
				});
				tdRotulo.appendChild(document.createTextNode(' ' + node.rotulo));
				return tr;
			},
			visitDoc: function(doc)
			{
				var row = this.visitNode(doc);
				var tdRotulo = row.cells[row.cells.length - 1];
				tdRotulo.removeAttribute('colspan');
				tdRotulo.className = doc.getClasse();
				if (tdRotulo.className != 'extraGedproRotuloGray') {
					tdRotulo.addEventListener('click', (function(node) {
						return function(e)
						{
							e.preventDefault();
							e.stopPropagation();
							var menuFechar = $('#extraFechar');
							if (menuFechar) {
								menuFechar.style.visibility = 'visible';
							}
							var win = window.wrappedJSObject.documentosAbertos['' + Eproc.processo + node.codigo];
							if (typeof win == 'object' && !win.closed) {
								return win.focus();
							} else {
								window.wrappedJSObject.documentosAbertos['' + Eproc.processo + node.codigo] = window.open('http://' + host + '/visualizarDocumentos.asp?origem=pesquisa&ignoraframes=sim&codigoDocumento=' + node.codigo, '' + Eproc.processo + node.codigo, 'menubar=0,resizable=1,status=0,toolbar=0,location=0,directories=0,scrollbars=1');
							}
						};
					})(doc), false);
				}
				row.insertCell(row.cells.length).innerHTML = doc.codigo;
				row.insertCell(row.cells.length).innerHTML = doc.status;
				row.insertCell(row.cells.length).appendChild(doc.statusIcone.toImg());
				row.insertCell(row.cells.length).innerHTML = doc.data;
				row.insertCell(row.cells.length).innerHTML = doc.criador + '<br/>' + doc.dataCriacao;
				row.insertCell(row.cells.length).innerHTML = 'Versão ' + doc.versao + ' por ' + doc.editor + ' em<br/>' + doc.dataVersao;
				return row;
			}
		};
	})();
	return {
		error: function(msg)
		{
			window.alert(msg);
			buscando = false;
		},
		getDocs: function(pagina)
		{
			if (buscando) {
				window.alert('A solicitação já foi enviada. Por favor aguarde.');
				return;
			}
			buscando = true;
			pagina = (typeof pagina == 'number') ? pagina : 1;
			var table = GedproTabela.getPagina(pagina);
			Gedpro.getXml(pagina, function(xml)
			{
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
		getDocsUrl: function(callback)
		{
			if (docsUrl) {
				return callback(docsUrl);
			}
			Gedpro.getGrupos(function(grupos)
			{
				docsUrl = 'http://' + host + '/XMLInterface.asp?processo=' + Eproc.processo + '&ProcessoVisual=PV&grupos=' + grupos;
				Gedpro.getDocsUrl(callback);
			});
		},
		getGrupos: function(callback)
		{
			if (grupos) {
				return callback(grupos);
			}
			var setPublicGroups = function()
			{
				grupos = '11,28,82';
				Gedpro.getGrupos(callback);
			}
			var onerror = function()
			{
				Gedpro.warn('Não foi possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.');
				return setPublicGroups();
			};
			Gedpro.getLogin(function(login)
			{
				Gedpro.pushStatus('Obtendo grupos do usuário...');
				GM_xmlhttpRequest({
					method: 'GET',
					url: 'http://' + host + '/arvore2.asp?modulo=Textos do Processo&processo=' + Eproc.processo + '&numeroProcessoVisual=NPV&localizadorProcesso=LP',
					onload: function(obj)
					{
						Gedpro.popStatus();
						var match;
						try {
							[match, grupos] = obj.responseText.match(/\&grupos=([^\&]+)\&/);
						} catch (e) {
							return onerror();
						}
						Gedpro.getGrupos(callback);
					},
					onerror: onerror
				});
			}, function()
			{
				Gedpro.warn('Não é possível obter os grupos do usuário.\nEstarão acessíveis apenas os documentos com visibilidade pública.');
				return setPublicGroups();
			});
		},
		getLink: function(callback)
		{
			if (link) {
				return callback(link);
			}
			Gedpro.getLinkElement(function(linkElement)
			{
				var urlGetter = linkElement.href;
				var xhr = new window.XMLHttpRequest();
				xhr.open('HEAD', urlGetter);
				xhr.setRequestHeader('X-Ferramentas-e-Proc', '1');
				xhr.onreadystatechange = function(ev)
				{
					if (this.readyState == 4) {
						Gedpro.popStatus();
						if (this.status == 200 && (link = this.getResponseHeader('X-Ferramentas-e-Proc-Redirect'))) {
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
		getLinkElement: function(callback)
		{
			if (linkElement) {
				return callback(linkElement);
			}
			var links = $$('a[onclick^="window.open(\'processo/acessar_processo_gedpro.php?acao=acessar_processo_gedpro"], a[href^="processo/acessar_processo_gedpro.php?acao=acessar_processo_gedpro"]');
			if (links.length == 1) {
				linkElement = links[0];
				Gedpro.getLinkElement(callback);
			}
		},
		getLoginForm: function(callback)
		{
			var getLinkCallback;
			getLinkCallback = function(link)
			{
				Gedpro.pushStatus('Obtendo link de requisição de login...');
				GM_xmlhttpRequest({
					method: 'GET',
					url: link,
					onload: function(obj)
					{
						Gedpro.popStatus();
						var formLogin = /FormLogin\.asp\?[^"]+/.exec(obj.responseText);
						var mainframePage = /\/mainframe\.asp\?[^"]+/.exec(obj.responseText);
						if (formLogin) {
							var loginForm = 'http://' + host + '/' + formLogin;
							return callback(loginForm);
						} else if (mainframePage) {
							var mainframe = 'http://' + host + mainframePage;
							getLinkCallback(mainframe);
						} else {
							Gedpro.error('Não foi possível obter o link de requisição de login.');
						}
					}
				});
			}
			Gedpro.getLink(getLinkCallback);
		},
		getNewLogin: function(e)
		{
			e.preventDefault();
			e.stopPropagation();
			Gedpro.getLogin(function(login)
			{
				Gedpro.info('Feche o documento e tente novamente agora.');
			});
		},
		getLogin: function(callback, onerror)
		{
			onerror = onerror || function()
			{
				Gedpro.error('Não é possível fazer login no GEDPRO.');
			};
			Gedpro.getLoginForm(function(loginForm)
			{
				Gedpro.pushStatus('Verificando possibilidade de login...');
				GM_xmlhttpRequest({
					method: 'GET',
					url: loginForm,
					onload: function(obj)
					{
						Gedpro.popStatus();
						if (/<!-- Erro /.test(obj.responseText)) {
							onerror();
						} else {
							return callback(loginForm);
						}
					}
				});
			});
		},
		getXml: function(pagina, callback)
		{
			Gedpro.getDocsUrl(function(docsUrl)
			{
				Gedpro.pushStatus('Carregando página ' + pagina + ' da árvore de documentos...');
				GM_xmlhttpRequest({
					method: 'GET',
					url: docsUrl + '&pgtree=' + pagina,
					mimeType: 'application/xml; charset=ISO-8859-1',
					onload: function(obj)
					{
						Gedpro.popStatus();
						var parser = new window.DOMParser();
						var xml = parser.parseFromString(obj.responseText, "application/xml");
						callback(xml);
					},
					onerror: function(obj)
					{
						Gedpro.error('Não foi possível carregar a página ' + pagina + ' da árvore de documentos.');
					}
				});
			});
		},
		info: function(msg)
		{
			var timer;
			timer = window.setInterval(function()
			{
				window.clearInterval(timer);
				window.alert(msg);
			}, 100);
		},
		popStatus: function()
		{
			var linkCargaDocs = $('#linkCargaDocs');
			if (linkCargaDocs) {
				var oldText = linkCargaDocs.textContent;
				var status = statuses.pop();
				linkCargaDocs.textContent = status;
				return oldText;
			}
		},
		pushStatus: function(status)
		{
			var linkCargaDocs = $('#linkCargaDocs');
			if (linkCargaDocs) {
				var oldText = linkCargaDocs.textContent;
				statuses.push(oldText);
				linkCargaDocs.textContent = status;
			}
		},
		warn: function(msg)
		{
			Gedpro.info(msg);
		}
	};
})();
var Eproc = {
	acao: '',
	pagina: '',
	processo: 0,
	windows: [],
	clicar: function(elemento)
	{
		var evento = document.createEvent('MouseEvents');
		evento.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		elemento.dispatchEvent(evento);
	},
	closeAllWindows: function(e)
	{
		var windows = [];
		for (w in window.wrappedJSObject.documentosAbertos) {
			var win = window.wrappedJSObject.documentosAbertos[w];
			if (typeof win == 'object' && !win.closed) {
				windows.push(win);
			}
		}
		if (windows.length) {
			var tela = /^processo_selecionar/.test(this.acao) ? 'Este processo' : 'Esta tela';
			var msg = tela + ' possui ' + windows.length + ' ' + (windows.length > 1 ? 'janelas abertas' : 'janela aberta') + '.\nDeseja fechá-' + (windows.length > 1 ? 'las' : 'la') + '?';
			if (typeof e != 'undefined') {
				var resposta = GM_yesCancelNo('Janelas abertas', msg);
			} else {
				var resposta = GM_yesNo('Janelas abertas', msg);
			}
			if (resposta == 'YES') {
				for (var w = windows.length - 1; w >= 0; w--) {
					windows[w].close();
				}
				var menuFechar = $('#extraFechar');
				if (menuFechar) {
					menuFechar.style.visibility = 'hidden';
				}
			} else if (resposta == 'CANCEL' && typeof e != 'undefined') {
				e.preventDefault();
				e.stopPropagation();
			}
		} else {
			var menuFechar = $('#extraFechar');
			if (menuFechar) {
				menuFechar.style.visibility = 'hidden';
			}
		}
	},
	colorirLembretes: function()
	{
		var tables = $$('.infraTable[summary="Lembretes"]');
		if (tables.length == 0) return;
		var unidades = $$('label[id="lblInfraUnidades"]');
		if (unidades.length == 0) {
			unidades = $$('label[id="lblInfraUnidades"]', window.parent.document);
		}
		if (unidades.length == 1) {
			unidades = unidades[0];
		} else if (unidades.length > 1) {
			unidades = unidades[1];
		}
		if (('tagName' in unidades) && unidades.tagName == 'LABEL') {
			var usuarioAtual = unidades.textContent;
		} else {
			var usuarioAtual = '';
		}
		tables.forEach(function(table)
		{
			var div = document.createElement('div');
			div.className = 'extraLembretes noprint';
			$$('tr.infraTrClara, tr.infraTrEscura', table).forEach(function(tr, r)
			{
				var orgaoDestino = tr.cells[2].textContent;
				var destino = tr.cells[3].textContent || orgaoDestino;
				var inicio = tr.cells[6].textContent == ' - ' ? null : tr.cells[6].textContent;
				var fim = tr.cells[7].textContent == ' - ' ? null : tr.cells[7].textContent;
				var floater = document.createElement('div');
				floater.className = 'extraLembrete';
				if (/TODOS OS ÓRGÃOS/.test(destino)) {
					destino = 'TODOS';
					floater.classList.add('extraLembreteTodos');
				} else if (/TODOS DO ÓRGÃO/.test(destino)) {
					destino = orgaoDestino;
				} else if (new RegExp(destino).test(usuarioAtual)) {
					destino = 'VOCÊ';
					floater.classList.add('extraLembreteVoce');
				}
				floater.innerHTML =
					'<div class="extraLembretePara">Para: '
						+ destino
						+ (tr.cells[8].textContent == 'Não' ? ' (<abbr '
							+ 'onmouseover="return infraTooltipMostrar('
							+ '\'Este lembrete não será exibido na movimentação processual\','
							+ '\'Movimentação processual\',' + '400);" '
							+ 'onmouseout="return infraTooltipOcultar();">N</abbr>)' : '')
						+ (inicio ? ' (<abbr ' + 'onmouseover="return infraTooltipMostrar('
							+ '\'Visível de ' + inicio + '<br/>até ' + fim + '\','
							+ '\'Prazo de exibição\',' + '400);" '
							+ 'onmouseout="return infraTooltipOcultar();">P</abbr>)' : '')
						+ '</div>' + tr.cells[4].textContent.replace(/\n/g, '<br/>')
						+ '<div class="extraLembreteData">' + tr.cells[5].textContent
						+ '<br/>' + tr.cells[1].textContent + '</div>';
				var props = Eproc.getHiddenProps(tr.cells[4].innerHTML);
				for (n in props.properties) {
					floater.setAttribute('data-' + n, props.properties[n]);
				}
				var celulaBotoes = tr.cells[tr.cells.length - 1];
				if (celulaBotoes.childNodes.length > 2) {
					floater.childNodes[0].appendChild(celulaBotoes.childNodes[2]);
				}
				if (celulaBotoes.childNodes.length > 0) {
					floater.childNodes[0].appendChild(celulaBotoes.childNodes[0]);
				}
				div.appendChild(floater);
			});
			var separator = document.createElement('div');
			separator.className = 'extraSeparador';
			div.appendChild(separator);
			table.parentNode.insertBefore(div, table);
			table.classList.add('noscreen');
		});
	},
	modificarTabelaProcessos: function()
	{
		(function() {
			$$('table').forEach(function(table) {
				var links = $$('a[href^="controlador.php?acao=processo_selecionar&"]', table);
				var inputs = $$('input[type="checkbox"]', table);
				if (links.length > 1 && links.length == inputs.length) {
					Eproc.permitirAbrirEmAbas(table);
				}
			});
		})();
		var findTh = function(campo, texto)
		{
			var th = null, setas = $$('a[onclick="infraAcaoOrdenar(\'' + campo + '\',\'ASC\');"]');
			if (setas.length != 1) {
				$$('.infraTh').forEach(function(possibleTh){
					if (possibleTh.textContent == texto) th = possibleTh;
				});
			} else {
				var th = setas[0].parentNode;
				while (th.tagName.toLowerCase() != 'th') {
					th = th.parentNode;
				}
			}
			return th;
		};
		var classeTh = findTh('DesClasseJudicial', 'Classe');
		var juizoTh = findTh('SigOrgaoJuizo', 'Juízo');
		var th = (classeTh !== null) ? classeTh : juizoTh;
		if (th == null) {
			var tr = $$('tr[data-classe]');
			if (tr.length > 0) {
				for (var table = tr[0].parentNode; table.tagName.toUpperCase() != 'TABLE'; table = table.parentNode);
				$$('.infraTh', table).forEach(function(th)
				{
					if (/^Classe( Judicial)?$/.test(th.textContent)) {
						classeTh = th;
					}
				});
			}
			th = classeTh;
		}
		if (th == null) {
			$$('.infraTh').forEach(function(th)
			{
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
			$$('th', table).forEach(function(th, h)
			{
				th.setAttribute('width', '');
			});
			Array.prototype.forEach.call(table.rows, function(tr)
			{
				if (!tr.className.match(/infraTr(Clara|Escura)/)) return;
				var links = tr.querySelectorAll('a[href]');
				if (juizoTh) {
					var color = null, juizoIndex = juizoTh.cellIndex, juizoCell = tr.cells[juizoIndex], juizoText = juizoCell.textContent, juizo = juizoText[juizoText.length - 1];
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
	corrigirCss: function(rule)
	{
		var extra = Eproc.getStyle('extraCorrecaoCss');
		extra.innerHTML = 'div.infraAreaDados { height: auto !important; overflow: inherit; }';
		extra.innerHTML += rule;
	},
	digitar_documento_vara_nao_piloto: function()
	{
		if (null === $('#titulo_editor')) return;
		var infoWindow = getInfoWindow();
		if (infoWindow) {
			var info = getInfo(infoWindow), processo;
			if (info) {
				$$('label', info).forEach(function(label)
				{
					if (label.textContent == 'Processo:') {
						processo = label.nextSibling.textContent;
					}
				});
				var autores = getCellContent(info, 2);
				var reus = getCellContent(info, 3);
			}
			if (! processo) {
				var infoLocal = getInfoLocal(infoWindow);
				if (infoLocal) {
					var processoMatch = /Processo Nº (\d{7}-\d{2}\.\d{4}.\d{3}.\d{4})/.exec(infoLocal.textContent);
					if (processoMatch) {
						var processo = processoMatch[1];
					}
				}
			}
			if (! processo) {
				var numProcesso = getHiddenNumProcesso(infoWindow);
				if (numProcesso) {
					var processoMatch = /^(\d{7})(\d{2})(\d{4})(\d{3})(\d{4})$/.exec(numProcesso.value);
					if (processoMatch) {
						var resultado = processoMatch.shift();
						var antesDoHifen = processoMatch.shift();
						var depoisDoHifen = processoMatch.join('.');
						var processo = antesDoHifen + '-' + depoisDoHifen;
					}
				}
			}
		}
		function getInfoWindow()
		{
			return window.wrappedJSObject.opener;
		}
		function getInfo(infoWindow)
		{
			var info = $('#tbInfoProcesso', infoWindow.document);
			if ((! info) || (info.rows.length == 1)) {
				return null;
			}
			return info;
		}
		function getCellContent(info, cellIndex)
		{
			var lista = info.rows[1].cells[cellIndex].innerHTML.replace(/<br[^>]*><label[^>]*>[^<]*<\/label>/g, '').split(/(?:<br[^>]*>){2}/);
			var ultimo = lista.pop();
			if (ultimo != '') {
				lista.push(ultimo);
			}
			return lista;
		}
		function getInfoLocal(infoWindow)
		{
			return $('#divInfraBarraLocalizacao', infoWindow.document);
		}
		function getHiddenNumProcesso(infoWindow)
		{
			return $('#hdnNumProcesso', infoWindow.document);
		}
		function BotaoDigitacao(sTexto, sTitulo, sConteudo, iTipo, oElemento)
		{
			this.nome = sTexto;
			this.titulo = sTitulo;
			this.texto = sConteudo;
			this.tipo = iTipo;
		}
		BotaoDigitacao.prototype = {
			nome: '',
			titulo: '',
			texto: '',
			tipo: 0,
			criarBotao: function()
			{
				var oBotao = document.createElement('button');
				oBotao.textContent = this.nome;
				var me = this;
				oBotao.addEventListener('click', function() { return me.onClick.apply(me, arguments); }, false);
				return oBotao;
			},
			getImageUrl: function()
			{
				var link = document.createElement('a');
				link.href = 'imagens/brasao_pb.jpg';
				link.protocol = 'http:';
				var imgUrl = link.href;
				this.getImageUrl = function() { return imgUrl; };
				return this.getImageUrl();
			},
			insertBefore: function(oElemento)
			{
				oElemento.parentNode.insertBefore(this.criarBotao(), oElemento);
			},
			insertAfter: function(oElemento)
			{
				this.insertBefore(oElemento.nextSibling);
			},
			onClick: function(e)
			{
				var oTexto = window.wrappedJSObject.CKEDITOR.instances.txt_fck;
				corrigir.call(null, oTexto);
				if (!oTexto.checkDirty() || window.confirm('Todo o texto já digitado será apagado.\nConfirma?')) {
					var sTexto = '<html lang="pt-BR" dir="ltr">\n';
					sTexto += '  <head>\n';
					sTexto += '    <title>' + this.titulo.replace(/<[^>]+>/g, '') + '</title>\n';
					sTexto += '    <style type="text/css">\n';
					sTexto += '.header { font-family: Calibri, Helvetica, sans-serif; font-size: 9pt; }\n';
					sTexto += '.dados { font-family: Times; font-size: 13pt; font-weight: bold; }\n';
					sTexto += '.title { font-family: Times; font-size: 14pt; font-weight: bold; }\n';
					sTexto += '.text { font-family: Times; font-size: 13pt; }\n';
					sTexto += '.signature { font-family: Times; font-size: 12pt; font-weight: bold; font-style: italic; }\n';
					sTexto += '    </style>\n';
					sTexto += '  </head>\n';
					sTexto += '  <body bgcolor="white">\n';
					sTexto += '    <div class="header" align="center"><img width="85" height="86" src="' + this.getImageUrl() + '" alt="Brasão da República"><br/>';
					sTexto += 'PODER JUDICIÁRIO<br/>';
					sTexto += '&nbsp;<strong>JUSTIÇA FEDERAL</strong>&nbsp;<br/>';
					sTexto += GM_getValue('v1.secao') + '<br/>';
					sTexto += GM_getValue('v1.subsecao') + '<br/>';
					sTexto += GM_getValue('v1.vara') + '</div>\n';
					sTexto += '    <p class="text" align="justify">&nbsp;</p>\n';
					if (processo) {
						sTexto += '    <div class="dados" align="left">PROCESSO: ' + processo + '</div>\n';
						if (info) {
							var AUTOR_ABRE, AUTOR_FECHA;
							[AUTOR_ABRE, AUTOR_FECHA] = ['<div class="dados" align="left">AUTOR: ', '</div>'];
							sTexto += '    ' + AUTOR_ABRE + autores.join(AUTOR_FECHA + AUTOR_ABRE) + AUTOR_FECHA + '\n';
							var REU_ABRE, REU_FECHA;
							[REU_ABRE, REU_FECHA] = ['<div class="dados" align="left">RÉU: ', '</div>'];
							sTexto += '    ' + REU_ABRE + reus.join(REU_FECHA + REU_ABRE) + REU_FECHA + '\n';
						}
						sTexto += '    <p class="text" align="justify">&nbsp;</p>\n';
					}
					sTexto += '    <p class="title" align="center">' + this.titulo + '</p>\n';
					sTexto += '    <p class="text" align="justify">&nbsp;</p>\n';
					sTexto += '    <p class="text" align="justify">' + this.texto + '</p>\n';
					sTexto += '    <p class="text" align="justify">&nbsp;</p>\n';
					sTexto += '    <p class="text" align="justify">&nbsp;</p>\n';
					sTexto += '    <p class="text" align="justify">&nbsp;</p>\n';
					sTexto += '    <p class="signature" align="center">documento assinado eletronicamente</p>\n';
					sTexto += '</body>\n';
					sTexto += '</html>\n';
					oTexto.setData(sTexto, function() {
						oTexto.updateElement();
						oTexto.resetDirty();
					});
					$('#selTipoArquivo').value = this.tipo;
				}
			}
		};
		var titulo = $('#titulo_editor');
		titulo.parentNode.insertBefore(document.createElement('p'), titulo.nextSibling);
		new BotaoDigitacao('Sentença', 'SENTENÇA', 'TextoDaSentença', '14').insertBefore(titulo.nextSibling);
		new BotaoDigitacao('Despacho', 'DESPACHO', 'TextoDoDespacho', '15').insertBefore(titulo.nextSibling);
		new BotaoDigitacao('Decisão', 'DECISÃO', 'TextoDaDecisão', '32').insertBefore(titulo.nextSibling);
		new BotaoDigitacao('Certidão', 'CERTIDÃO', 'CERTIFICO que .', '16').insertBefore(titulo.nextSibling);
		new BotaoDigitacao('Ato Ordinatório', 'ATO ORDINATÓRIO', 'De ordem do MM. Juiz Federal, .', '109').insertBefore(titulo.nextSibling);
		new BotaoDigitacao('Ato de Secretaria', 'ATO DE SECRETARIA', 'De ordem do MM. Juiz Federal, a Secretaria da Vara .', '18').insertBefore(titulo.nextSibling);
		titulo.parentNode.insertBefore(document.createElement('p'), titulo.nextSibling);

		var corrigido = false;
		var corrigir = function(ed)
		{
			if (corrigido) return;
			ed.config.fullPage = true;
			corrigido = true;
		};
		var command = function()
		{
			if ('CKEDITOR' in window.wrappedJSObject) {
				corrigir.call(null, window.wrappedJSObject.CKEDITOR.instances.txt_fck);
			}
		};
		window.addEventListener('load', command, false);
	},
	entrar: function()
	{
		Eproc.corrigirCss('#fldLogin { position: static; margin: 6% auto; }');
	},
	getHiddenProps: function(texto)
	{
		var reComentario = /<!--\s+(.*?)\s+-->/g, codigoOculto;
		var properties = {}, clean = texto;
		while ((codigoOculto = reComentario.exec(texto)) !== null) {
			var tmpObj = {}, isValid = true;
			var tmpCodigo = /^{(.*)}$/.exec(codigoOculto[1]);
			if (! tmpCodigo) {
				isValid = false;
			} else {
				var props = tmpCodigo[1].trim().split(',');
				props.forEach(function(prop)
				{
					var name, value;
					var parts = prop.split(':');
					if (parts.length == 2) {
						[name, value] = parts;
					} else {
						isValid = false;
						return null;
					}
					tmpObj[name.trim()] = value.trim();
				});
			}
			if (isValid) {
				clean = clean.replace(codigoOculto[0], '');
				for (n in tmpObj) {
					properties[n] = tmpObj[n];
				}
			}
		}
		return {
			original: texto,
			clean: clean,
			properties: properties,
			toString: function()
			{
				var props = [];
				for (n in this.properties) {
					props.push(n + ':' + this.properties[n]);
				}
				if (props.length == 0) {
					return this.clean;
				}
				return '<!-- {' + props.join(',') + '} -->' + this.clean;
			}
		};
	},
	getStyle: function(id)
	{
		var extraStyle = $('#' + id);
		if (! extraStyle) {
			extraStyle = document.createElement('style');
			extraStyle.id = id;
			$('head').appendChild(extraStyle);
		}
		return extraStyle;
	},
	getMenu: function()
	{
		var menu = $('#main-menu');
		if (menu) return menu;
		else return false;
	},
	init: function()
	{
		if (window.wrappedJSObject.FeP) {
			GM_analisarVersao(window.wrappedJSObject.FeP);
		}
		this.pagina = window.location.pathname.split('/eprocV2/')[1];
		this.parametros = {};
		for (var p = 0, params = window.location.search.split('?').splice(0).join('').split('&'), param; (p < params.length) && (param = params[p]); p++) {
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
		var barraSistema = $('.infraBarraSistema'), lembretes = $$('.infraTable[summary="Lembretes"]');
		if (barraSistema || lembretes.length) {
			Eproc.mudaEstilos();
		}
		var pesquisaRapida = $('#txtNumProcessoPesquisaRapida');
		if (pesquisaRapida) {
			if ('placeholder' in pesquisaRapida) {
				pesquisaRapida.setAttribute('placeholder', 'Nº. processo');
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
			a.addEventListener('click', function(e)
			{
				GM_showPreferences();
			}, false);
			var img = document.createElement('img');
			img.className = 'infraImg'
			img.src = 'data:image/png;base64,' + GM_getBase64('chrome://eproc/skin/stapler-16.png');
			a.appendChild(img);
			div.appendChild(a);
			if (pesquisaRapida) {
				for (var upperDiv = pesquisaRapida.parentNode; upperDiv.className != 'infraAcaoBarraSistema'; upperDiv = upperDiv.parentNode);
				upperDiv.parentNode.insertBefore(div, upperDiv.nextSibling.nextSibling.nextSibling);
			} else if ($('#lnkSairSistema')) {
				for (var upperDiv = $('#lnkSairSistema').parentNode; upperDiv.className != 'infraAcaoBarraSistema'; upperDiv = upperDiv.parentNode);
				upperDiv.parentNode.insertBefore(div, upperDiv);
			} else {
				barra.appendChild(div);
			}
		}
		switch (this.acao) {
			case 'processo_lembrete_destino_listar_subfrm':
			case 'processo_selecionar':
				this.colorirLembretes();
				break;
		}
		this.modificarTabelaProcessos();
		Gedpro.getLinkElement(function(linkGedpro)
		{
			try {
				var onclick = linkGedpro.getAttribute('onclick');
				[, linkGedpro.href] = onclick.match(/window.open\('([^']+)'/);
				linkGedpro.target = '_blank';
			} catch (e) {
			}
			linkGedpro.removeAttribute('onclick');
			var onclickFunction = new Function('e', onclick);
			linkGedpro.addEventListener('click', function(e)
			{
				e.preventDefault();
				e.stopPropagation();
				var abrirComIE = GM_getValue('v2.ie.enable', true);
				var botao = $('#extraConfiguracaoComplemento');
				var mensagemMostrada = GM_getValue('v2.ie.mensagemmostrada', false);
				if (botao && !mensagemMostrada) {
					var naoMostrar = {value: false};
					var confirmacao = GM_confirmCheck('Navegador padrão', 'Seu computador está configurado para abrir o Gedpro com o ' + (abrirComIE ? 'Internet Explorer' : 'Firefox') + '.\nCaso deseje mudar esta configuração, clique em "Cancelar".', 'Não mostrar esta mensagem novamente', naoMostrar);
					if (naoMostrar.value == true) {
						GM_setValue('v2.ie.mensagemmostrada', true);
					}
					if (! confirmacao) {
						botao.scrollIntoView();
						var tooltip = new Tooltip('<p style="font-weight: bold;">CONFIGURAÇÕES</p><p>Este ícone permite acessar as configurações a qualquer momento.</p><p>Na aba "e-Proc V2", marque ou desmarque a opção "Abrir Gedpro com Internet Explorer".</p>');
						tooltip.vincular(botao);
						window.addEventListener('resize', tooltip.desenhar, false);
						botao.addEventListener('click', function(e)
						{
							tooltip.ocultar();
						}, false);
						return;
					}
				}
				if (abrirComIE) {
					Gedpro.getLink(function(url)
					{
						IELauncher(url);
					});
				} else {
					onclickFunction.apply(this, arguments);
				}
			}, false);
		});
		if (this.acao && this[this.acao]) {
			this[this.acao]();
		} else if (this.parametros.acao_origem && this[this.parametros.acao_origem + '_destino']) {
			this[this.parametros.acao_origem + '_destino']();
		}
		window.addEventListener('beforeunload', function(e)
		{
			delete this.Eproc;
		}, false);
		function Icone()
		{
			var getIcone = function()
			{
				var icone = document.createElement('img');
				icone.width = 16;
				icone.height = 16;
				icone.className = 'extraIconeAcao noprint';
				getIcone = function() { return icone; };
				return getIcone();
			}

			this.addToLink = function(link)
			{
				link.insertBefore(getIcone(), link.firstChild);
			};

			this.setSrc = function(src)
			{
				getIcone().src = src;
			};
		}
		function InfraIcone (arquivo)
		{
			Icone.call(this);
			this.setSrc('../infra_css/imagens/' + arquivo);
		}
		InfraIcone.prototype = new Icone;
		function ChromeIcone (arquivo)
		{
			Icone.call(this);
			var mime = 'image/' + /...$/.exec(arquivo);
			this.setSrc('data:' + mime + ';base64,' + GM_getBase64('chrome://eproc/skin/' + arquivo));
		}
		ChromeIcone.prototype = new Icone;
		var acoes = getAcoes();
		var botoesDesabilitados = Eproc.prefUsuario(5) == 'N';
		if (acoes && ! botoesDesabilitados) {
			var fieldset = $('#fldAcoes');
			var legend = $('legend', fieldset);
			if (legend) {
				var span = document.createElement('span');
				span.className = 'extraAcoesLegend';
				span.textContent = legend.textContent;
				legend.textContent = '';
				legend.appendChild(span);
				var opcoes = document.createElement('div');
				opcoes.className = 'extraAcoesOpcoes noprint';
				legend.appendChild(opcoes);
				var createCheckBox = function(preferencia, classe, id, texto)
				{
					var valor = GM_getValue(preferencia);
					if (valor) {
						fieldset.classList.add(classe);
					}
					var label = document.createElement('label');
					label.htmlFor = id;
					var checkbox = document.createElement('input');
					checkbox.id = id;
					checkbox.type = 'checkbox';
					checkbox.checked = valor;
					checkbox.addEventListener('change', (function(preferencia, classe)
					{
						return function(e)
						{
							var valor = e.target.checked;
							GM_setValue(preferencia, valor);
							var fieldset = $('#fldAcoes');
							if (valor) {
								fieldset.classList.add(classe);
							} else {
								fieldset.classList.remove(classe);
							}
						};
					})(preferencia, classe), false);
					label.appendChild(checkbox);
					label.appendChild(document.createTextNode(' ' + texto));
					opcoes.appendChild(label);
				};
				var chkMostrarIcones = new CheckBox('v2.mostraricones', 'Mostrar ícones');
				chkMostrarIcones.vincularElementoClasse(fieldset, 'extraAcoesMostrarIcones');
				opcoes.appendChild(chkMostrarIcones.getLabel());
				var chkDestacarAcoes = new CheckBox('v2.destacaracoes', 'Destacar ações mais comuns');
				chkDestacarAcoes.vincularElementoClasse(fieldset, 'extraAcoesDestacar');
				opcoes.appendChild(chkDestacarAcoes.getLabel());
				var divAcoesDestacadas = document.createElement('div');
				divAcoesDestacadas.className = 'extraAcoesDestacadas noprint';
				fieldset.appendChild(divAcoesDestacadas);
			}
			acoes.forEach(function(acao)
			{
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
						acao.href = /window\.open\(['"]([^'"]+)/.exec(acao.getAttribute('onclick'))[1];
					} else {
						acao.href = '#';
					}
					acao.addEventListener('click', function(e) { e.preventDefault(); }, false);
				}
				var acaoControlador = /\?acao=([^&]+)/.exec(acao.href);
				var destacar = false, dispararOriginal = false;
				if (acaoControlador && acaoControlador.length == 2) {
					var icone = null;
					switch (acaoControlador[1]) {
						case 'acessar_processo_gedpro':
							icone = new ChromeIcone('ie.png');
							destacar = true;
							dispararOriginal = true;
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
							destacar = true;
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
							destacar = true;
							break;

						case 'processo_intimacao_aps_bloco':
							icone = new InfraIcone('transportar.gif');
							destacar = true;
							break;

						case 'processo_lembrete_destino_cadastrar':
							icone = new InfraIcone('tooltip.gif');
							destacar = true;
							break;

						case 'processo_movimento_consultar':
							icone = new InfraIcone('receber.gif');
							destacar = true;
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
				if (destacar) {
					var copia = acao.cloneNode(true);
					acao.classList.add('extraLinkAcaoDestacadaOriginal');
					divAcoesDestacadas.appendChild(copia);
					if (dispararOriginal) {
						copia.addEventListener('click', (function(original)
						{
							return function(evento)
							{
								evento.preventDefault();
								evento.stopPropagation();
								Eproc.clicar(original);
							};
						})(acao), false);
					}
				}
			});
		}
		function getAcoes()
		{
			var acoes = $$('#fldAcoes a');
			if (acoes.length == 0) return false;
			return acoes;
		}
	},
	mudaEstilos: function()
	{
		function getCss(name)
		{
			var css = window.atob(GM_getBase64('chrome://eproc/skin/' + name + '.css'));
			return css;
		}
		function getStyleElement(skin)
		{
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
		function addStyleSheet(name)
		{
			var estilo = getStyleElement(name);
			var media = (name == 'print') ? 'print' : 'screen';
			estilo.media = media;
			if (typeof name == 'undefined') name = 'screen';
			var css = '.no' + name + ' { display: none; }\n';
			if (name == 'screen') name = 'eprocV2';
			css += getCss(name);
			estilo.innerHTML = css;
		}
		addStyleSheet();
		addStyleSheet('print');

		$$('label[onclick^="listarTodos"], label[onclick^="listarEventos"], #txtEntidade, #txtPessoaEntidade').forEach(function(auto)
		{
			var id = auto.id.replace('lblListar', 'txt');
			auto = $('#' + id);
			if (auto) {
				auto.style.width = auto.clientWidth + 'px';
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
				default:
					skin = 'stock';
					break;

			}
			addStyleSheet(skin + '-extra');
		}
	},
	permitirAbrirEmAbas: function(table)
	{
		if ($$('a[href^="controlador.php?acao=processo_selecionar&"]', table).length <= 1) {
			return;
		}
		var link = new VirtualLink('Abrir os processos selecionados em abas/janelas', function(e)
		{
			var marcadas = 0, links = [];
			$$('tr.infraTrMarcada', table).forEach(function(linha)
			{
				var linkProcesso = $('a[href^="controlador.php?acao=processo_selecionar"]', linha).href;
				links.push(linkProcesso);
				marcadas++;
			});
			if (marcadas > 0) {
				if (marcadas < 10 || (GM_yesNo('Abrindo ' + marcadas + ' abas/janelas', 'Tem certeza de que deseja abrir ' + marcadas + ' novas abas/janelas?\nSeu sistema pode deixar de responder.') == 'YES')) {
					links.forEach(function(linkProcesso)
					{
						window.open(linkProcesso);
					});
				}
			}
		});
		var div = document.createElement('div');
		div.style.margin = '.5em 0';
		div.appendChild(link);
		table.parentNode.insertBefore(div, table);
	},
	usuario_tipo_monitoramento_localizador_listar: function(){
		var linhas = $$('#divInfraAreaTabela tr[class^="infraTr"]');
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
	},
	principal_destino: function()
	{
		Eproc.corrigirCss('');
		var linhas = $$('#fldProcessos tr[class^="infraTr"], #fldLocalizadores tr[class^="infraTr"]');
		if (linhas) {
			this.decorarLinhasTabelaLocalizadores(linhas);
		}
		var botao = $('#lnkConfiguracaoSistema');
		var novasConfiguracoesMostradas = GM_getValue('v2.novasconfiguracoes4mostradas', false);
		if (botao) {
			if (! novasConfiguracoesMostradas) {
				var resposta = GM_yesNo('Novas configurações', 'Você deve configurar algumas opções antes de continuar.\n\nDeseja abrir a tela de configurações agora?');
				if (resposta == 'YES') {
					window.location.href = botao.href;
				}
			}
			var xhr = new window.XMLHttpRequest();
			xhr.open('GET', botao.href);
			xhr.onreadystatechange = function()
			{
				if (this.readyState == 4 && this.status == 200) {
					var div = document.createElement('div');
					div.innerHTML = this.responseText;
					var storage = window.wrappedJSObject.localStorage;
					if (storage.length) {
						for (let key in storage) {
							storage.removeItem(key);
						}
					}
					$$('input[type=checkbox][id^="ch"]', div).forEach(function(input)
					{
						storage[input.id] = input.checked ? 'S' : 'N';
					});
				}
			};
			xhr.send('');
		}
	},
	decorarLinhasTabelaLocalizadores: function(linhas)
	{
		linhas.forEach(function(linha)
		{
			var link = getLink(linha);
			var url = getUrl(link);
			var processos = getQtdProcessos(link);
			linha.classList.add('extraLocalizador');
			linha.setAttribute('data-processos', processos);
			if (processos > 0) {
				linha.addEventListener('click', function(e)
				{
					window.location.href = url;
				}, false);
			}
		});
		function getLink(tr)
		{
			try {
				return tr.cells[1].querySelector('a');
			} catch (e) {
				return null;
			}
		}
		function getUrl(a)
		{
			try {
				if (a.href) {
					return a.href;
				} else if (a.getAttribute('onclick')) {
					return 'javascript:' + a.getAttribute('onclick');
				}
			} catch(e) {
				return '';
			}
		}
		function getQtdProcessos(a)
		{
			try {
				return a.textContent;
			} catch (e) {
				return 0;
			}
		}
	},
	processo_cadastrar_2: function()
	{
		var auto = $('#txtDesAssunto');
		if (auto) {
			auto.style.width = auto.clientWidth + 'px';
		}
	},
	processo_consulta_listar: function()
	{
		var form = $('#frmProcessoEventoLista');
		form.action = window.location.pathname + window.location.search;
		var docsGedpro = $('#divDocumentosGedpro');
		if (docsGedpro) {
			var linkSecao = $('#divInfraBarraTribunalE').getElementsByTagName('a')[0];
			var estado = linkSecao.hostname.match(/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/), host = 'trf4', linkGedpro = null;
			if (estado) {
				host = 'jf' + estado[1];
			}
			linkGedpro = 'http://gedpro.' + host + '.jus.br/visualizarDocumentos.asp?codigoDocumento=';
			var Doc = function(processo, numero, tipo)
			{
				this.toString = function() { return [tipo, numero].join(' '); };
				this.link = document.createElement('a');
				this.link.textContent = this.toString();
				this.link.href = linkGedpro + numero;
				this.link.target='_blank';
				this.link.setAttribute('data-doc', numero);
			};
			Doc.fromRow = function(row) {
				var processo = row.cells[0].textContent;
				var numero = row.cells[1].textContent.replace(/^ged_/, '');
				var tipo = row.cells[2].textContent;
				return new Doc(processo, numero, tipo);
			}
			var thead = form.querySelector('.infraTable > tbody > tr:first-child');
			var th = document.createElement('th');
			th.className = 'infraTh';
			th.textContent = 'Documento Gedpro';
			thead.appendChild(th);
			var processos = form.querySelectorAll('.infraTable > tbody > tr[class^=infraTr]');
			$$('tr[class^=infraTr]', docsGedpro).forEach(function(row, r)
			{
				var doc = Doc.fromRow(row);
				var newCell = processos[r].insertCell(processos[r].cells.length);
				newCell.appendChild(doc.link);
				row.parentNode.removeChild(row);
			});
			window.wrappedJSObject.analisarDocs();
		}
	},
	processo_evento_paginacao_listar: function()
	{
		this.processo_selecionar();
	},
	processo_lembrete_destino_alterar: function()
	{
		this.processo_lembrete_destino_cadastrar();
	},
	processo_lembrete_destino_cadastrar: function()
	{
		var descricao = $('#txaDescricao');
		if (! descricao) return;
		descricao.name = '';
		var props = Eproc.getHiddenProps(descricao.textContent);
		descricao.value = props.clean;
		var newDescricao = document.createElement('input');
		newDescricao.id = 'newTxaDescricao';
		newDescricao.name = 'txaDescricao';
		newDescricao.type = 'hidden';
		newDescricao.value = props;
		descricao.parentNode.insertBefore(newDescricao, descricao.nextSibling);
		var onDescricaoChange = function(e)
		{
			props.clean = descricao.value;
			newDescricao.value = props;
		};
		descricao.addEventListener('change', onDescricaoChange, false);
		var fieldset = $('#fldNovoLembrete');
		fieldset.appendChild(document.createElement('br'));
		var lblCor = document.createElement('label');
		lblCor.htmlFor = 'extraCorLembrete';
		lblCor.textContent = 'Cor ';
		lblCor.className = 'infraLabelOpcional';
		fieldset.appendChild(lblCor);
		var selCor = document.createElement('select');
		selCor.id = 'extraCorLembrete';
		['', 'vermelho', 'amarelo', 'verde'].forEach(function(cor)
		{
			var option = document.createElement('option');
			option.textContent = cor;
			if (('cor' in props.properties) && (props.properties.cor == cor)) {
				option.selected = true;
			}
			selCor.appendChild(option);
		});
		selCor.addEventListener('change', function(e)
		{
			if (selCor.value == '') {
				delete props.properties.cor;
			} else {
				props.properties.cor = selCor.value;
			}
			onDescricaoChange();
		}, false);
		fieldset.appendChild(selCor);
	},
	processo_lembrete_destino_cadastrar_bloco_subfrm: function()
	{
		this.processo_lembrete_destino_cadastrar();
	},
	processo_seleciona_publica: function()
	{
		this.processo_selecionar();
	},
	processo_selecionar: function()
	{
		Gedpro.getLinkElement(function(linkGedpro)
		{
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
			linkCargaDocs.transform = function()
			{
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
		iconTrueColor['DOC' ] = 'imagens/tree_icons/page_word.gif';
		iconTrueColor['RTF' ] = 'imagens/tree_icons/page_word.gif';
		iconTrueColor['XLS' ] = 'imagens/tree_icons/page_excel.gif';
		iconTrueColor['TXT' ] = 'imagens/tree_icons/page_white.gif';
		iconTrueColor['PDF' ] = 'imagens/tree_icons/page_white_acrobat.gif';
		iconTrueColor['GIF' ] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['JPEG'] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['JPG' ] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['PNG' ] = 'imagens/tree_icons/page_white_picture.gif';
		iconTrueColor['HTM' ] = 'imagens/tree_icons/page_world.gif';
		iconTrueColor['HTML'] = 'imagens/tree_icons/page_world.gif';
		iconTrueColor['MP3' ] = '../infra_css/imagens/audio.gif';
		iconTrueColor['MPG' ] = '../infra_css/imagens/video.gif';
		iconTrueColor['MPEG'] = '../infra_css/imagens/video.gif';
		iconTrueColor['WMV' ] = '../infra_css/imagens/video.gif';
		iconTrueColor['N/A' ] = 'imagens/tree_icons/page_white_error.gif';
		function formatSize(size)
		{
			var kPowers = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
			var kPower = 0;
			while (size >= 1000) {
				size /= 1000;
				kPower++;
			}
			if (kPower > 0) {
				size = Math.floor(size * 10) / 10;
			}
			return size + kPowers[kPower];
		}
		function isFirstPage()
		{
			return $$('#selPaginacaoT').length == 0;
		}
		function getNextPage(div)
		{
			if (typeof div == 'undefined') div = document;
			var pageSelector = $('#selPaginacaoR', div);
			if (! pageSelector) return null;
			var nextPage = $('#selPaginacaoR + a', pageSelector.parentNode);
			if (! nextPage) return null;
			return nextPage;
		}
		$$('.infraTable').forEach(function(table, t, tables)
		{
			if (table.getAttribute('summary') == 'Eventos' || table.rows[0].cells[0].textContent == 'Evento') {
				applyTableModifications(table);
			}
		});
		function applyTableModifications(table)
		{
			if (! table.tHead) {
				table.createTHead();
				var firstRow = table.rows[0];
				if (firstRow.cells[0].tagName == 'TH') {
					table.tHead.appendChild(firstRow);
				}
			}
			var tHeadRow = null;
			$$('th', table).forEach(function(th)
			{
				th.setAttribute('width', '');
			});
			var eventosReferidos = {};
			table.addEventListener('click', function(e) {
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
			}, false);
			$$('tr[class^="infraTr"], tr[bgcolor="#FFFACD"]', table).forEach(function(tr, r, trs)
			{
				var colunaDescricao = tr.cells[tr.cells.length - 3];
				var texto = colunaDescricao.textContent;
				var numeroEvento = /^\d+/.exec(tr.cells[tr.cells.length - 5].textContent);
				if (/Refer\. ao Evento: \d+$/.test(texto)) {
					var eventoReferido = /\d+$/.exec(texto);
					if ( ! (eventoReferido in eventosReferidos)) {
						eventosReferidos[eventoReferido] = [];
					}
					eventosReferidos[eventoReferido].push(tr);
				} else if (numeroEvento in eventosReferidos) {
					var parte = $('.infraEventoPrazoParte', tr);
					if (parte) {
						var tipoParte = parte.getAttribute('data-parte');
						eventosReferidos[numeroEvento].forEach(function(linha)
						{
							linha.cells[linha.cells.length - 3].innerHTML += '<br>' + (colunaDescricao.innerHTML + '<br>').split('<br>')[1];
						});
					}
				}
			});
			table.classList.add('extraTabelaEventos');
			function getLinkMimeType(docLink)
			{
				var type = docLink.getAttribute('data-mimetype');
				return type ? type.toUpperCase() : 'PDF';
			}
		}
		var menu = Eproc.getMenu();
		if (menu) {
			var fechar = document.createElement('li');
			fechar.id = 'extraFechar';
			fechar.style.visibility = 'hidden';
			var fecharLink = new VirtualLink('Fechar as janelas abertas', Eproc.closeAllWindows);
			fechar.appendChild(fecharLink);
			menu.appendChild(fechar);
			var setFecharProperties = function(pos, y, w)
			{
				var staticArgs = Array.prototype.slice.call(arguments);
				['position', 'top', 'width'].forEach(function(property, p)
				{
					fechar.style[property] = staticArgs[p];
				});
			};
			var onWindowScroll = function(e)
			{
				setFecharProperties('', '', '');
				var fecharOffsetTop = fechar.offsetTop;
				var fecharHeight = fechar.clientHeight;
				var minimumOffset = (window.innerHeight - fecharHeight) / 2;
				if (fecharOffsetTop - window.pageYOffset < minimumOffset) {
					setFecharProperties('fixed', minimumOffset + 'px', menu.clientWidth + 'px');
				}
			};
			['scroll', 'resize'].forEach(function(eventName)
			{
				window.addEventListener(eventName, onWindowScroll, false);
			});
			$('#lnkInfraMenuSistema').addEventListener('click', onWindowScroll, false);
		}

	},
	isSegundoGrau: function()
	{
		return this.getEstado() == null;
	},
	getEstado: function()
	{
		var linkSecao = $('#divInfraBarraTribunalE a');
		var estado = (linkSecao ? linkSecao.hostname : window.location.hostname).match(/\.jf(pr|rs|sc)\.(?:gov|jus)\.br/);
		if (estado) return estado[1];
		else return null;
	},
	getNumprocF: function(numproc)
	{
		var numprocF = '';
		for (var i = 0, d; d = numproc.substr(i, 1); i++) {
			if (i == 7) numprocF += '-';
			if (i == 9 || i == 13 || i == 16) numprocF += '.';
			numprocF += d;
		}
		return numprocF;
	},
	prefUsuario: function(num)
	{
		var storage = window.wrappedJSObject.localStorage;
		if (('ch' + num) in storage) {
			return storage['ch' + num];
		} else {
			return null;
		}
	},
	usuario_personalizacao_configuracao: function()
	{
		var corCapa = $('#ch1');
		if (corCapa) {
			document.body.addEventListener('keydown', function(e)
			{
				if (e.shiftKey && e.ctrlKey) {
					corCapa.name = '2';
				}
			}, false);
			document.body.addEventListener('keyup', function(e)
			{
				if (corCapa.name != '1') {
					corCapa.name = '1';
				}
			}, false);
		}
		var storage = window.wrappedJSObject.localStorage;
		$$('input[type=checkbox][id^="ch"]').forEach(function(input)
		{
			input.addEventListener('click', function(e)
			{
				storage['ch' + this.name] = this.checked ? 'S' : 'N';
			}, false);
		});

		var botao = $('#lnkConfiguracaoSistema');
		var novasConfiguracoesMostradas = GM_getValue('v2.novasconfiguracoes4mostradas', false);
		if (botao && !novasConfiguracoesMostradas) {
			window.alert('Por favor, verifique se todas as configurações estão de acordo com suas preferências.');
			var novasConfiguracoesMostradas = GM_setValue('v2.novasconfiguracoes4mostradas', true);
			var tooltip = new Tooltip('Este ícone permite acessar novamente as configurações a qualquer momento.');
			tooltip.vincular(botao);
			window.addEventListener('resize', tooltip.desenhar, false);
			botao.addEventListener('mouseover', tooltip.ocultar, false);
		}
	}
};
function Tooltip(texto)
{
	var div = document.createElement('div');
	div.innerHTML = '<img src="imagens/tooltip/arrow3.gif" style="position: absolute;"/>';
	var img = div.firstChild;
	div.innerHTML = '<div style="position: absolute; background: lightyellow; border: 1px solid black; font-size: 1.2em; width: 30ex; text-align: center; padding: 10px;">' + texto + '</div>';
	div = div.firstChild;
	var elementoVinculado, x = 0, y = 0;
	this.vincular = function(elemento)
	{
		elementoVinculado = elemento;
		this.desenhar();
	};
	this.desenhar = function()
	{
		removerElementos();
		calcularXY(elementoVinculado);
		adicionarElementos();
		posicionarElementos();
	};
	this.ocultar = function()
	{
		removerElementos();
		adicionarElementos = function(){};
	};
	function calcularXY(elemento)
	{
		for (x = 0, y = 0; elemento != null; elemento = elemento.offsetParent) {
			x += elemento.offsetLeft;
			y += elemento.offsetTop;
		}
	}
	function posicionarElementos()
	{
		img.style.top = y + elementoVinculado.offsetHeight + 'px';
		img.style.left = x + elementoVinculado.offsetWidth/2 - 15 + 'px';
		div.style.top = y + elementoVinculado.offsetHeight + 15 - 1 + 'px';
		div.style.left = x + elementoVinculado.offsetWidth/2 - div.offsetWidth + 10 + 'px';
	}
	function removerElementos()
	{
		if (div.parentNode == document.body) {
			document.body.removeChild(div);
			document.body.removeChild(img);
		}
	}
	function adicionarElementos()
	{
		document.body.appendChild(div);
		document.body.appendChild(img);
	}
}
function VirtualLink(texto, funcao)
{
	var vLink = document.createElement('a');
	vLink.href = '#';
	vLink.innerHTML = texto;
	var fn = function(e)
	{
		e.preventDefault();
		e.stopPropagation();
		funcao.call(this);
	};
	vLink.addEventListener('click', fn, false);
	vLink.removeTrigger = function()
	{
		this.removeEventListener('click', fn, false);
	};
	return vLink;
}
Eproc.init();

