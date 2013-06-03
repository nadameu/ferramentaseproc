var EXPORTED_SYMBOLS = [];

Components.utils['import']('resource://eproc/Uri.jsm');

var httpRequestObserver = {

    observe: function(subject, topic, data)
    {
        if (topic == "http-on-examine-response") {
            if (typeof Components == 'undefined') return;
            var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
            var uri = new Uri(httpChannel.name);
            if (uri.isV2() && uri.getControlador() == 'controlador' && /^acao=acessar_documento_(implementacao|publico)/.test(uri.getQuery())) {
                var titulo = uri.getQuery().match(/&titulo_janela=([^&]+)/);
                var extension = uri.getQuery().match(/&tipo_doc=([^&]+)/);
                if (titulo && extension) {
                    replacePattern = 'filename="' + decodeURIComponent(titulo[1]).replace(/ /g, '_').replace('_-_', '-') + '.' + extension[1] + '"';
                } else {
                    replacePattern = 'filename="$1"';
                }
                httpChannel.setResponseHeader('Content-Disposition', httpChannel.getResponseHeader('Content-Disposition').replace(/filename=([^"]*)$/, replacePattern), false);
            } else if (uri.isV1() && /^download\//.test(uri.getArquivo())) {
                httpChannel.setResponseHeader('Content-Disposition', 'inline', false);
            }
        }
    },

    get observerService() {
        return Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
    },

    register: function()
    {
        this.observerService.addObserver(this, "http-on-examine-response", false);
    },

    unregister: function()
    {
        this.observerService.removeObserver(this, "http-on-examine-response");
    }
};
httpRequestObserver.register();
