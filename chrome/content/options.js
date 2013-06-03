var showAbout = function()
{
    try {
        var extensionManager = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
          opener.openDialog("chrome://mozapps/content/extensions/about.xul", "", "chrome,centerscreen,modal", "urn:mozilla:item:eproc@nadameu.com.br", extensionManager.datasource);
   

    } catch(e) {
        Components.utils['import']('resource://gre/modules/AddonManager.jsm');
        AddonManager.getAddonByID("eproc@nadameu.com.br", function(addon)
        {
            openDialog('chrome://mozapps/content/extensions/about.xul', '', 'chrome,centerscreen,modal', addon);
        });
    }
    
};

var Options = {

    action: function(act) {
        for (var i = 0, l = this.options.length, n; (i < l) && (n = this.options[i]); i++) {
            var el = document.getElementById(n.split('.').join('_')), prop;
            switch (el.tagName) {
                case 'checkbox':
                    prop = 'checked';
                    break;

                case 'textbox':
                    prop = 'value';
                    break;

                case 'colorpicker':
                    prop = 'color';
                    break;
            }
            switch (act) {
                case 'get':
                    el[prop] = this.getValue(n, false);
                    break;

                case 'save':
                    this.prefs.setValue(n, el[prop]);
                    break;

                case 'clear':
                    el[prop] = this.getValue(n, true);
                    break;
            }
        }
    },

    cancel: function() {
        return true;    
    },
    
    defaults: function() {
        this.action('clear');
        return false;
    },

    getValue: function(prefName, clear) {
        if (clear) {
            return this.prefs.getDefaultValue(prefName);
        } else {
            return this.prefs.getValue(prefName);
        }
    },
    
    init: function() {
        this.prefs = new EprocPreferences();
        this.options = [
            'v1.enable',
            'v1.consulta_processo.enable',
            'v1.html_to_pdf.enable',
            'v1.secao',
            'v1.subsecao',
            'v1.vara',
            'v1.alteracao_assunto.enable',
            'v1.eproc.enable',
			'v2.enable',
            'v2.ie.enable',
            'v2.ielocation'
        ];
        this.action('get');
        Commands.on_v1_enable();
        Commands.on_v2_enable();
    },

    ok: function() {
        this.action('save');
        return true;
    }

}
var Commands = {

    process: function(main, children)
    {
        children.split(' ').forEach(function(id) { document.getElementById(id).disabled = this.disabled || !this.checked; }, document.getElementById(main));
    },

    on_v1_enable: function()
    {
        Commands.process('v1_enable', 'v1_consulta_processo_enable v1_html_to_pdf_enable v1_alteracao_assunto_enable v1_eproc_enable');
    },

    on_v2_enable: function()
    {
        Commands.process('v2_enable', 'v2_ie_enable v2_ielocation v2_ielocation_label v2_ielocation_button');
    },

    on_v2_ielocation: function()
    {
        var picker = Components.classes["@mozilla.org/filepicker;1"]
                   .createInstance(Components.interfaces.nsIFilePicker);


        picker.init(window, "Informe a localização", 0);
        picker.appendFilter("iexplore.exe", 'iexplore.exe');
        picker.appendFilters(64);
        picker.appendFilters(1);

        if(picker.show()==0) document.getElementById('v2_ielocation').value=picker.file.target; // load path into field
    }

}
