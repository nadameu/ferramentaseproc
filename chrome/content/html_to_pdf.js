unsafeWindow._eproc = 0.3;
var aMeses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
var d = new Date();
var sData = d.getDate() + ' de ' + aMeses[d.getMonth()] + ' de ' + d.getFullYear();

function criaBotao (sTexto, sTitulo, sConteudo, iTipo, oElemento)
{
    var oBotao = document.createElement('button');
    oBotao.innerHTML = sTexto;
    oBotao.addEventListener('click', function(evt)
    {
        var oTexto = unsafeWindow.FCKeditorAPI.GetInstance('txt_fck');
        if (!oTexto.IsDirty() || confirm('Todo o texto já digitado será apagado.\nConfirma?')) {
            oTexto.SetHTML('<html lang="pt-BR" dir="ltr"><head><title>' + sTitulo.replace(/<[^>]+>/g, '') + '</title><style type="text/css">.header { font-family: Arial; font-size: 10pt; } .title { font-family: Times New Roman; font-size: 14pt; font-weight: bold; } .text { font-family: Times New Roman; font-size: 13pt; } .signature { font-family: Times New Roman; font-size: 12pt; font-weight: bold; font-style: italic; }</style></head><body bgcolor="white"><div class="header" align="center"><img width="85" height="86" src="http://eproc.trf4.gov.br/eproc2trf4/imagens/brasao_pb.jpg"></div><div class="header" align="center">PODER JUDICIÁRIO</div><div class="header" align="center"><strong>JUSTIÇA FEDERAL</div><div class="header" align="center"></strong>' + GM_getValue('v1.secao') + '</div><div class="header" align="center">' + GM_getValue('v1.subsecao') + '</div><div class="header" align="center">' + GM_getValue('v1.vara') + '</div><p class="text" align="justify">&nbsp;</p><p class="title" align="center">' + sTitulo + '</p><p class="text" align="justify">&nbsp;</p><p class="text" align="justify">' + sConteudo + '</p><p class="text" align="justify">&nbsp;</p><p class="text" align="justify">&nbsp;</p><p class="text" align="justify">&nbsp;</p><p class="signature" align="center">documento assinado eletronicamente</p></body></html>');
            document.getElementById('tipo_documento').value = iTipo;
        }
    }, true);
    document.body.insertBefore(oBotao, oElemento);
}
unsafeWindow.FCKeditor_OnComplete = function(ed)
{
//    a = []; for (n in x = ed.Config) a.push(n + ' = "' + x[n] + '"'); ed.SetHTML(a.sort().join('<br />'));
    ed.Language = 'pt';
    ed.Events.AttachEvent('OnAfterSetHTML', FCKeditor_OnAfterSetHTML);
    ed.Config.FullPage = true;
    ed.Config.ToolbarSets["mine"] = [
        ['Cut','Copy','Paste','PasteText','PasteWord'],
        ['Undo','Redo'],
        ['Bold','Italic','Underline'],
        ['JustifyLeft','JustifyCenter','JustifyRight','JustifyFull'],
        ['OrderedList','UnorderedList','Outdent','Indent'],
        ['BGColor','TextColor'],
        ['Source']
    ];
    ed.ToolbarSet.Load('mine');
    if (screen.availWidth >= 780 && screen.availHeight >= 630) {
        var w = 780;
        var h = Math.floor((screen.availHeight - 30) / 100) * 100 + 30;
        document.getElementById('txt_fck___Frame').height = h - 330;
        window.moveTo((screen.availWidth - w) / 2, (screen.availHeight - h) / 2);
        window.resizeTo(w, h);
    }
    document.body.insertBefore(document.createTextNode(' '), document.body.firstChild);
    criaBotao('Sentença', 'SENTENÇA', 'TextoDaSentença', '14', document.body.firstChild);
    criaBotao('Despacho', 'DESPACHO', 'TextoDoDespacho', '15', document.body.firstChild);
    criaBotao('Decisão', 'DECISÃO', 'TextoDaDecisão', '32', document.body.firstChild);
    criaBotao('Certidão', 'CERTIDÃO', 'CERTIFICO que .', '16', document.body.firstChild);
    criaBotao('Ato', 'ATO DE SECRETARIA', 'De ordem do MM. Juiz Federal, a Secretaria da Vara .', '18', document.body.firstChild);
}
function FCKeditor_OnAfterSetHTML(ed) {
    ed.ResetIsDirty();
}
// vim:enc=iso-8859-1
