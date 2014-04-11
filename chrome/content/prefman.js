function EprocPreferences() {
    var startPoint="eproc.";

    var pref=Components.classes["@mozilla.org/preferences-service;1"].
        getService(Components.interfaces.nsIPrefService).
        getBranch(startPoint);

    var defaults=Components.classes["@mozilla.org/preferences-service;1"].
        getService(Components.interfaces.nsIPrefService).
        getDefaultBranch(startPoint);

    var observers={};

    // whether a preference exists
    this.exists=function(prefName) {
        return pref.getPrefType(prefName) != 0;
    }

    // returns the named preference, or defaultValue if it does not exist
    this.getValue=function(prefName, defaultValue) {
        if (pref.prefHasUserValue(prefName)) {
            var prefType=pref.getPrefType(prefName);
            switch (prefType) {
                case pref.PREF_STRING: return pref.getCharPref(prefName);
                case pref.PREF_BOOL: return pref.getBoolPref(prefName);
                case pref.PREF_INT: return pref.getIntPref(prefName);
                case pref.PREF_INVALID: window.alert('Valor inválido para a preferência "' + prefName + '"!');
            }
        } else {
            return this.getDefaultValue(prefName, defaultValue);
        }
    }


    // returns the default value or the preference
    this.getDefaultValue=function(prefName, defaultValue) {
        switch (defaults.getPrefType(prefName)) {
            case defaults.PREF_STRING: return defaults.getCharPref(prefName);
            case defaults.PREF_BOOL: return defaults.getBoolPref(prefName);
            case defaults.PREF_INT: return defaults.getIntPref(prefName);
            case defaults.PREF_INVALID: return (typeof defaultValue != 'undefined') ? defaultValue : window.alert('Valor inválido para a preferência "' + prefName + '"!');
        }
    }

    // sets the named preference to the specified value. values must be strings,
    // booleans, or integers.
    this.setValue=function(prefName, value) {
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
        if (this.exists(prefName) && prefType != typeof(this.getValue(prefName))) {
            this.remove(prefName);
        }

        // set new value using correct method
        switch (prefType) {
            case "string": pref.setCharPref(prefName, value); break;
            case "boolean": pref.setBoolPref(prefName, value); break;
            case "number": pref.setIntPref(prefName, Math.floor(value)); break;
        }
    }

    // deletes the named preference or subtree
    this.remove=function(prefName) {
        pref.deleteBranch(prefName);
    }

    // call a function whenever the named preference subtree changes
    this.watch=function(prefName, watcher) {
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
    }

    // stop watching
    this.unwatch=function(prefName, watcher) {
        if (observers[watcher]) {
            pref.QueryInterface(Components.interfaces.nsIPrefBranchInternal)
                .removeObserver(prefName, observers[watcher]);
        }
    }

    var defaultValue = (navigator.userAgent.indexOf('WOW64') > -1)
        ? 'C:\\Arquivos de programas (x86)\\Internet Explorer\\iexplore.exe'
        : 'C:\\Arquivos de programas\\Internet Explorer\\iexplore.exe';

    var userValue = pref.prefHasUserValue('v2.ielocation')
        ? this.getValue('v2.ielocation')
        : defaultValue;

    defaults.deleteBranch('v2.ielocation');
    defaults.setCharPref('v2.ielocation', defaultValue);
    pref.setCharPref('v2.ielocation', userValue);
}
