unsafeWindow._eproc = 0.3;
if ((tabelas = document.getElementsByTagName('table')).length > 0 && (tabela = tabelas[0]).getAttribute('height') == 30) {
    tabela.setAttribute('height', 0);
    tabela.setAttribute('cellpadding', 2);
    if ((celula2 = (tabela2 = document.getElementsByTagName('table')[1]).rows[0].cells[0]).getAttribute('bgcolor').toUpperCase() == '#CCCCCC' && celula2.getAttribute('width') == 760) {
        var submenu = document.createElement('div');
        with (submenu.style) {
            display = 'none';
            position = 'absolute';
            background = "#cccccc";
            padding = "2px";
        }
        for (var links = celula2.getElementsByTagName('a'), l = links.length - 1; l >= 0 && (link = links[l]); l--) {
            with (link.style) {
                display = 'block';
                textAlign = 'left';
            }
            submenu.insertBefore(link, submenu.firstChild);
        }
        tabela2.parentNode.removeChild(tabela2);
        with (document.getElementsByTagName('table')[0].rows[0].cells[4].getElementsByTagName('div')[0]) {
            style.textAlign = 'center';
            appendChild(submenu);
            addEventListener('mouseover', function(e)
            {
                this.getElementsByTagName('div')[0].style.display = '';
            }, true);
            addEventListener('mouseout', function(e)
            {
                this.getElementsByTagName('div')[0].style.display = 'none';
            }, true);
        }
    }
    if ((center = document.getElementsByTagName('center')[0]).getElementsByTagName('img')[0].getAttribute('src').match(/imagens\/topico\.gif/)) {
        (celula = tabela.insertRow(1).insertCell(0)).innerHTML = center.innerHTML;
        celula.setAttribute('colspan', 6);
        celula.setAttribute('align', 'center');
        center.parentNode.removeChild(center);
    }
}
// </script>
function IsNumeric(str){
  var ValidChars = "0123456789/-";
  var IsNumber=(str.length>0 ? true:false);
  var Char;
  for(i=0;i<str.length && IsNumber==true;i++){
    Char = str.charAt(i);
    if(ValidChars.indexOf(Char)==-1) IsNumber=false;
  }
  if(!IsNumber) alert('Número do processo não é válido, digite apenas números.');
  return IsNumber;
}
// {{{ Documentos e Janelas
var processo = document.getElementsByTagName('table')[1].innerHTML.match(/altera_lembrete\.php\?num_processo_lembrete=(\d+)/)[1];
window._openWindows = [];
Array.forEach(document.getElementsByTagName('table'), function(table, t, tables)
{
    if (t == 0) {
        table.rows[0].insertCell(5).innerHTML = '<form name=consulta action="consulta_processo.php" method="GET" onSubmit="return IsNumeric(this.num_processo_consulta.value)"><input name=num_processo_consulta type=text size="15" maxlength="15" style="color: #888;" onclick="this.style.color = \'\'; this.value = \'\';" value="N&ordm; do processo"></form>';
        table.rows[1].cells[0].colSpan = 7;
    } else if (t == 1) {
        table.parentNode.insertBefore(table, tables[0].nextSibling);
        table.cellPadding = 0;
        table.cellSpacing = 0;
        cell = table.rows[0].cells[0];
        cell.innerHTML = cell.innerHTML.replace(/<br>/, ' &mdash; ');
        cell = table.rows[8].cells[0];
        cell.innerHTML = cell.innerHTML.replace(/(<\/font>)<br>(<font face="verdana" size="2">)Idade: /g, '$1 - $2').replace(/<\/*p>/, '<br />');
        cell = table.rows[9].cells[1];
        cell.innerHTML = cell.innerHTML.replace(/<br><br>/, '<br />');
        table.rows[10].cells[0].innerHTML += '<br />' + table.rows[11].cells[0].innerHTML;
        table.deleteRow(11);
        if (table.rows[11].cells[0].innerHTML.match(/Relator\(a\):/)) {
            table.rows[10].cells[0].innerHTML += '<br /><br />' + table.rows[11].cells[0].innerHTML;
            table.deleteRow(11);
        }
        if (table.rows.length > 13) {
            table.rows[12].cells[0].innerHTML += table.rows[13].cells[0].innerHTML;
            table.deleteRow(13);
        }
    } else if (t == 2) {
        table.border = 1;
        table.cellPadding = 1;
        table.cellSpacing = 0;
        table.align = '';
        table.setAttribute('width', '');
        table.parentNode.insertBefore(document.createElement('br'), tables[1].nextSibling);
        table.parentNode.insertBefore(table, tables[1].nextSibling.nextSibling);
        table.rows[0].cells[4].setAttribute('width', '');
        Array.forEach(table.rows, function(row, r, rows)
        {
            if (r > 0) {
                row.cells[4].setAttribute('width', '');
                row.cells[4].noWrap = true; //setAttribute('nowrap', 'nowrap');
                documentos = [];
                Array.forEach(row.cells[4].getElementsByTagName('table')[0].rows, function(row2, r2, rows2)
                {
                    Array.forEach(row2.cells, function(cell, c, cells)
                    {
                        documentos.push(cell.innerHTML);
                    });
                });
                row.cells[4].innerHTML = documentos.join('<br />');
                if (!row.cells[4].innerHTML) {
                    row.cells[4].innerHTML = '---';
                }
                Array.forEach(row.cells[4].getElementsByTagName('a'), function(link, l, links)
                {
                    if (/^window.open/.test(link.getAttribute('onclick'))) {
                        params = link.getAttribute('onclick').match(/^window.open\("(.*)"\)$/)[1].split('","');
                        href = link.href.match(/^javascript:void\((.*)\);$/)[1];
                        link.href = params[0];
                        link.target = href;
                        link.setAttribute('onclick', '');
                        link.addEventListener('click', (function()
                        {
                            var _documento = params[0];
                            var _name = href;
                            var _options = params[2];
                            return function(e)
                            {
                                e.preventDefault();
                                openWindow = window._openWindows[_name];
                                if (openWindow && typeof openWindow == 'object' && openWindow.document) {
                                    openWindow.focus();
                                } else {
                                    window._openWindows[_name] = window.open(_documento, _name, _options);
                                }
                            }
                        })(), true);
                    }
                });
            }
        });
    }
});
window.addEventListener('unload', function(e)
{
    open = [];
    for (n in window._openWindows) {
        openWindow = window._openWindows[n];
        if (typeof openWindow == 'object' && openWindow.document) {
            open.push(n);
        }
    }
    if (open.length > 0) {
        if (confirm('Este processo possui ' + open.length + ' documentos abertos.\nDeseja fechá-los?')) {
            Array.forEach(open, function(n)
            {
                window._openWindows[n].close();
            });
        }
    }
}, true);
function removeTags(html)
{
    return html.replace(/<[^>]+>/g, '');
}
// }}}
// {{{ Assunto
var l = document.getElementsByTagName('table')[1].rows[5].cells[0].getElementsByTagName('a')[1];
var a = l.innerHTML.match(/\((\d*)\)/)[1];
[0, 1].forEach(function(l)
{
    var l = document.getElementsByTagName('table')[1].rows[5].cells[0].getElementsByTagName('a')[l];
    l.href = l.href.replace(/des_assunto=/, 'num_assunto=' + (a.length > 0 ? '0' + a : '') + "&$&");
});
//l.href += '&num_assunto=' + 
// }}}
// {{{ Lembretes
setStyle = function(obj, style) {
    for (n in style) {
        obj.style[n] = style[n];
    }
}
document.title = processo;
var x = new XMLHttpRequest();
x.open('GET', 'https://' + location.host + '/eproc/altera_lembrete.php?num_processo_lembrete=' + processo);
x.onreadystatechange = function()
{
    if (x.readyState == 4 && x.status == 200) {
        var d = document.createElement('div');
        d.innerHTML = x.responseText;
        lembretes = document.createElement('div');
        setStyle(lembretes, {
            position: 'fixed',
            top: 0,
            right: 0,
            width: '200px',
            fontFamily: 'Arial',
            fontSize: '10pt',
            textAlign: 'center',
            zIndex: 1000
        });
        for (var rows = d.getElementsByTagName('tr'), j = 0, lj = rows.length; j < lj - 2; j++) {
            l = document.createElement('div');
            setStyle(l, {
                position: 'relative',
                marginBottom: '11pt',
                backgroundColor: '#ff8'
            });
            if (/Ativo/.test(rows[j].cells[3].innerHTML)) {
            } else if (/Inativo/.test(rows[j].cells[3].innerHTML)) {
                l.style.opacity = '.25'
            }
            seq = rows[j].cells[4].getElementsByTagName('a')[0].href.match(/seqlembrete=(\d+)/)[1];
            var texto = rows[j].cells[0].innerHTML.replace(/\n/g, '<br />');
            texto = texto.replace(/(\d{2}\/\d{2,})-(\d)/g, '$1$2').replace(/(\d{15}|\d{2}\/\d{2,})/g, '<a href="https://' + location.host + '/eproc/consulta_processo.php?num_processo_consulta=$&" target="_blank">$&</a>').replace(/(\d{4})\.(\d{2})\.(\d{2})\.(\d{6})-(\d{1})/g, '<a href="https://' + location.host + '/eproc/consulta_processo.php?num_processo_consulta=$1$2$3$4$5" target="_blank">$&</a>');
            l.innerHTML = '<div style="background-color: #f8f880;"><span style="float: left; width: 180px; text-align: center; font-size: 8pt;">' + rows[j].cells[2].innerHTML + '</span><a href="https://' + location.host + '/eproc/apaga_lembrete.php?num_processo=' + processo + '&seq_lembrete=' + seq + '" style="text-decoration: none; width: 20px">[X]</a></div><div style="min-height: 33pt; padding: 11pt 0;">' + texto + '</div><div style="text-align: right; font-size: 8pt;">' + rows[j].cells[1].innerHTML + '</div>';
            l.getElementsByTagName('a')[0].addEventListener('click', function(e)
            {
                if (!confirm('Deseja mesmo apagar este lembrete?')) {
                    e.preventDefault();
                }
            }, true);

            lembretes.appendChild(l);
        }
        document.body.appendChild(lembretes);
    }
}
x.send(null);
// }}}
// {{{ Prazos
var lupas = 0;
Array.forEach(document.getElementsByTagName('img'), function(img)
{
    if (/imagens\/bt_lupa_off.gif$/.test(img.src)) {
        td = img.parentNode.parentNode;
        if (td.tagName.toUpperCase() == 'TD') {
            if(/(CITA|INTIMA)(ÇÃO|DO)/.test(td.innerHTML)) {
                tip = img.getAttribute('onmouseover').split(/ddrivetip\('/)[1].split(/', \d+\);/)[0];
                newTd = td.parentNode.insertCell(td.parentNode.cells.length);
                newTd.style.fontFamily = 'Verdana';
                newTd.style.fontSize = '10pt';
                if (/Data do Evento que fechou/.test(tip)) {
                    newTd.innerHTML = '<b>Evento fechado</b><br />';
                    evento = tip.split(/Data do Evento que fechou/)[1].match(/>([^<]+)<\/font><\/TD><\/TR><\/table>/)[1];
                    if (/DECURSO DE PRAZO/.test(evento) || /RENÚNCIA AO PRAZO/.test(evento)) {
                        newTd.innerHTML += evento;
                    } else {
                        newTd.innerHTML += '<span style="background-color: #ff8;">' + evento + '</span>';
                    }
                    newTd.style.backgroundColor = '#8c8';
                } else if (/Aguardando abertura de prazo/.test(tip)) {
                    newTd.innerHTML = 'Evento não aberto';
                    newTd.style.backgroundColor = '#c88';
                } else if (/Data do evento que abriu/.test(tip)) {
                    newTd.innerHTML = '<b>Evento aberto</b><br />Encerra em ' + tip.split(/Fim do Prazo/)[1].match(/\d+\/\d+\/\d+/)[0];
                    newTd.style.backgroundColor = '#cc8';
                } else if (/Prazo Fechado em Secretaria/.test(tip)) {
                    newTd.innerHTML = '<b>Evento fechado em Secretaria';
                    newTd.style.backgroundColor = '#c3e588';
                } else if (/Fim do Prazo/.test(tip)) {
                    var agora = new Date();
                    var parts = tip.split(/Fim do Prazo/)[1].match(/\d+\/\d+\/\d+ \d+:\d+:\d+/)[0].split(/[\/ :]/);
                    var prazo = new Date(parts[2], parts[1] - 1, parts[0], parts[3], parts[4], parts[5], 0);
                    if (agora <= prazo) {
                        newTd.innerHTML = '<b>Evento aberto</b><br />Encerra em ' + tip.split(/Fim do Prazo/)[1].match(/\d+\/\d+\/\d+/)[0];
                    newTd.style.backgroundColor = '#cc8';
                    } else {
                        newTd.innerHTML = '<b>Evento fechado por data</b><br /><span style="background-color: #ff8;">EM ' + parts[0] + '/' + parts[1] + '/' + parts[2] + '</span>';
                        newTd.style.backgroundColor = '#c3e588';
                    }
                }
            }
        }
    }
});
// }}}
// vim:enc=iso-8859-1
