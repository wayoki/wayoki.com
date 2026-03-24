(function () {
    window.WayokiThemeSubmitConfig = Object.assign({
        /*
         * Set to a backend URL to enable direct POST submissions.
         * Leave empty to use the built-in Export JSON / Copy JSON fallback.
         */
        endpoint: "https://d5d7krk3tc0hj76ss1qi.cmxivbes.apigw.yandexcloud.net/submit-theme",
        timeoutMs: 12000
    }, window.WayokiThemeSubmitConfig || {});
})();
