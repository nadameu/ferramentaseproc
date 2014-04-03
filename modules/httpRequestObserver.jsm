var EXPORTED_SYMBOLS = [];

Components.utils['import']('resource://eproc/Uri.jsm');

var httpRequestObserver = {

    observe: function(subject, topic, data)
    {
        if (topic == "http-on-examine-response") {
            if (typeof Components == 'undefined') return;
            var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
            var uri = new Uri(httpChannel.name);
            if (uri.isV1() && /^download\//.test(uri.getArquivo())) {
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
