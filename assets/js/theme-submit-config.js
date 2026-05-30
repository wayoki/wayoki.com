(function () {
    window.WayokiThemeSubmitConfig = Object.assign({
        /*
         * Set to a backend URL to enable direct POST submissions.
         * Leave empty to use the built-in Export JSON / Copy JSON fallback.
         */
        endpoint: "",
        timeoutMs: 12000
    }, window.WayokiThemeSubmitConfig || {});
})();
