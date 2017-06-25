(function() {
    var XHR = XMLHttpRequest.prototype;
    // Remember references to original methods
    var open = XHR.open;
    var send = XHR.send;

    // Overwrite native methods.
    XHR.open = function(method, url) {
        this._url = url;
        return open.apply(this, arguments);
    };

    // The gerrit response uses this non-parseable cruft at the front to
    // prevent CSRF script injection attacks. Strip it out.
    const cleanCruft = function(j) {
        if (j.startsWith(")]}'")) {
            return j.substring(5);
        }
        return j;
    };

    XHR.send = function(postData) {
        this.addEventListener('load', function() {
            if (this._url.match(/\/changes\/\?/)) {
                let resp = JSON.parse(cleanCruft(this.responseText));
                window.postMessage({ type: "FROM_PAGE", changesResponse: resp}, "*");
            }
        });
        return send.apply(this, arguments);
    };
})();
