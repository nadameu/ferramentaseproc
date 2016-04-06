var EXPORTED_SYMBOLS = [ 'EprocPreferences' ];
var startPoint="eproc.";

Components.utils.import('resource://gre/modules/Services.jsm');

var pref=Services.prefs.getBranch(startPoint);

var defaults=Services.prefs.getDefaultBranch(startPoint);

var observers={};

var EprocPreferences = {
    // whether a preference exists
    exists: function(prefName) {
        return pref.getPrefType(prefName) != 0;
    },

    // returns the named preference, or defaultValue if it does not exist
    getValue: function(prefName, defaultValue) {
        if (pref.prefHasUserValue(prefName)) {
            var prefType=pref.getPrefType(prefName);
            switch (prefType) {
                case pref.PREF_STRING: return pref.getCharPref(prefName);
                case pref.PREF_BOOL: return pref.getBoolPref(prefName);
                case pref.PREF_INT: return pref.getIntPref(prefName);
                case pref.PREF_INVALID: window.alert('Valor inválido para a preferência "' + prefName + '"!');
            }
        } else {
            return EprocPreferences.getDefaultValue(prefName, defaultValue);
        }
    },


    // returns the default value or the preference
    getDefaultValue: function(prefName, defaultValue) {
        switch (defaults.getPrefType(prefName)) {
            case defaults.PREF_STRING: return defaults.getCharPref(prefName);
            case defaults.PREF_BOOL: return defaults.getBoolPref(prefName);
            case defaults.PREF_INT: return defaults.getIntPref(prefName);
            case defaults.PREF_INVALID: return (typeof defaultValue != 'undefined') ? defaultValue : window.alert('Valor inválido para a preferência "' + prefName + '"!');
        }
    },

    // sets the named preference to the specified value. values must be strings,
    // booleans, or integers.
    setValue: function(prefName, value) {
        var prefType=typeof(value);

        switch (prefType) {
            case "string":
            case "boolean":
                break;
            case "number":
                if (value % 1 != 0) {
                    throw new Error("Cannot set preference to non integral number");
                }
                break;
            default:
                throw new Error("Cannot set preference with datatype: " + prefType);
        }

        // underlying preferences object throws an exception if new pref has a
        // different type than old one. i think we should not do this, so delete
        // old pref first if this is the case.
        if (EprocPreferences.exists(prefName) && prefType != typeof(EprocPreferences.getValue(prefName))) {
            EprocPreferences.remove(prefName);
        }

        // set new value using correct method
        switch (prefType) {
            case "string": pref.setCharPref(prefName, value); break;
            case "boolean": pref.setBoolPref(prefName, value); break;
            case "number": pref.setIntPref(prefName, Math.floor(value)); break;
        }
    },

    // deletes the named preference or subtree
    remove: function(prefName) {
        pref.deleteBranch(prefName);
    },

    // call a function whenever the named preference subtree changes
    watch: function(prefName, watcher) {
        // construct an observer
        var observer={
            observe:function(subject, topic, prefName) {
                watcher(prefName);
            }
        };

        // store the observer in case we need to remove it later
        observers[watcher]=observer;

        pref.QueryInterface(Components.interfaces.nsIPrefBranchInternal).
            addObserver(prefName, observer, false);
    },

    // stop watching
    unwatch: function(prefName, watcher) {
        if (observers[watcher]) {
            pref.QueryInterface(Components.interfaces.nsIPrefBranchInternal)
                .removeObserver(prefName, observers[watcher]);
        }
    }
};

(function corrigirEnderecoIE() {

    var env = Components.classes["@mozilla.org/process/environment;1"]
      .getService(Components.interfaces.nsIEnvironment);

    var defaultFolder = 'C:\\Arquivos de programas';
    if (env.exists('ProgramFiles(x86)')) {
        defaultFolder = env.get('ProgramFiles(x86)');
    } else if (env.exists('ProgramFiles')) {
        defaultFolder = env.get('ProgramFiles');
    }
    var defaultValue = defaultFolder + '\\Internet Explorer\\iexplore.exe';

    var userValue = pref.prefHasUserValue('v2.ielocation')
        ? EprocPreferences.getValue('v2.ielocation')
        : defaultValue;

    defaults.deleteBranch('v2.ielocation');
    defaults.setCharPref('v2.ielocation', defaultValue);
    pref.setCharPref('v2.ielocation', userValue);

})();
