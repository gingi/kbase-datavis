({
    baseUrl:        "../public/js",
    mainConfigFile: "../public/js/config.js",
    namespace:      "KBVis",
    name:           "KBVis",
    create:         true,
    wrap: {
        start: "(function () {",
        end: "window.KBVis = KBVis; jQuery.noConflict(true); }());"
    },
    paths: {
        requireLib: "require"
    },
    include: [
        "requireLib",
        "renderers/heatmap",
        "renderers/manhattan",
        "renderers/network",
        "renderers/table",
        "charts/bar",
        "charts/pie",
        "util/dock",
        "util/dragbox",
        "util/dropdown",
        "util/spin",
        "util/progress",
        "util/hud",
        "util/viewport",
        "util/slider",
        "transformers/netindex",
        "text!templates/checkbox.html",
        "text!templates/slider.html",
        "text!templates/error-alert.html",
        "text!sample-data/network1.json"
    ],
    onBuildRead: function (moduleName, path, contents) {
        if (moduleName == "util/spin") {
            return contents.replace(/\bdefine\b/g, "KBVis.define");
        }
        return contents;
    }
})
