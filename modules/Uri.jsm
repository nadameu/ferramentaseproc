var EXPORTED_SYMBOLS = ['Uri'];

var Uri = function(uri)
{
    var parts = new RegExp(
        '^(https?)' // scheme
        + '://(jef[23]?|eproc(?:[34]?|2(?:d-(?:um|dois|tres))?|teste|-(?:apresentacao|[12]g-desenv|ws))|homologa-[12]g1|apresentacao-trf4)' // subdominio
        + '\\.(jf(pr|rs|sc)|trf4)' // dominio, estado
        + '\\.(?:gov|jus)\\.br/+(eproc(?:|V1|V2|2trf4|(?:trf4|v2)_[^/]+)|(?:homologa|apresenta)_[12]g|apresentacao_[^/]+)/+' // sistema
        + '(|([^.]+)(?:\\.php)?[^?#]*)' // arquivo, controlador
        + '(?:\\?([^#]*))?' // query
        + '(?:#(.*))?' // hash
        + '$'
    ).exec(uri);

    this.isValid = function()
    {
        return (parts != null);
    };

    if (this.isValid()) {
        var scheme, subdominio, dominio, estado, sistema, arquivo, controlador, query, hash;
        [parts, scheme, subdominio, dominio, estado, sistema, arquivo, controlador, query, hash] = parts;
    }

    var that = this;
    var ifValidElse = function(retIfValid, retOtherwise)
    {
        if (that.isValid()) return retIfValid;
        else return retOtherwise;
    };

    this.isV1 = function()
    {
        return ifValidElse(/^eproc(V1)?$/.test(sistema), false);
    };

    this.isV2 = function()
    {
        return ifValidElse(! /^eproc(V1)?$/.test(sistema), false);
    };

    this.getArquivo = function()
    {
        return ifValidElse(arquivo, null);
    }

    this.getControlador = function()
    {
        return ifValidElse(controlador, null);
    }

    this.getQuery = function()
    {
        return ifValidElse(query, null);
    }

};
