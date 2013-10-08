require(["jquery", "renderers/network", "util/viewport", "jquery-ui"],
function ($, Network, Viewport) {
    var minStrength = 0.7;
    var viewport = new Viewport({
        parent: "#datavis",
        title: "Network",
        maximize: true
    });
    var datasetFilter = function () { return true; };
    var network = new Network({
        element: viewport,
        dock: false,
        nodeLabel: { type: "CLUSTER" },
        infoOn: "hover",
        edgeFilter: function (edge) {
            return edge.source != edge.target &&
                (edge.strength >= minStrength || edge.strength == 0) &&
                datasetFilter(edge);
        }
    });
    viewport.addTool($("<a/>", { href: "#" }).html("Click me!"));
    var toolbox = viewport.toolbox();
    addSlider(toolbox);
    addSearch(toolbox);
    
    $.getJSON("/data/network/kbase/coex").done(function (data) {
        addDatasetDropdown(toolbox, data);
        network.setData(data);
        network.render();
    });
    
    function addSlider($container) {
        var tipTitle = "Minimum edge strength: ";
        var wrapper = $("<div/>", {
            id: "strength-slider",
            class: "btn btn-default tool"
        });
        var slider = $("<div/>", { style: "min-width:70px" });
        wrapper
            .append($("<div/>", { class: "btn-pad" })
                .append($("<i/>", { class: "icon-adjust" })))
            .append($("<div/>", { class: "btn-pad" })
                .append(slider));
        $container.prepend(wrapper);
        $("#strength-slider").tooltip({
           title: tipTitle + minStrength.toFixed(2),
           placement: "bottom"
        });
        slider.slider({
            min: 0, max: 1, step: 0.05, value: 0.8,
            slide: function (event, ui) {
                minStrength = ui.value;
                network.update();
                $("#strength-slider").next().find(".tooltip-inner")
                    .text(tipTitle + minStrength.toFixed(2));
            }
        });
    }
    
    function addSearch($container) {
        var wrapper = $("<div/>", { class: "btn btn-default tool" });
        wrapper
            .append($("<div/>", { class: "btn-pad" })
                .append($("<input/>", { type: "text", class: " input-xs" })))
            .append($("<div/>", { class: "btn-pad" })
                .append($("<i/>", { class: "icon-search" })));
        $container.prepend(wrapper);
    }
    
    function addDatasetDropdown($container, data) {
        var wrapper = $("<div/>", { class: "btn-group tool" });
        var list = $("<ul/>", { class: "dropdown-menu", role: "menu" });
        list.append(dropdownLink("All data sets", "", "all"));
        _.each(data.datasets, function (ds) {
            var dsStr = ds.id.replace(/^kb.*\.ws\/\//, "");
            list.append(dropdownLink(dsStr, ds.description, ds.id));
        });
        list.find("a").on("click", function (event) {
            var id = $(this).data("value");
            if (id == "all")
                datasetFilter = function () { return true; };
            else
                datasetFilter = function (edge) {
                    return edge.datasetId == id;
                }
            network.update();
        })
        wrapper
            .append($("<div/>", {
                class: "btn btn-default btn-sm dropdown-toggle",
                "data-toggle": "dropdown"
            }).text("Data Set ").append($("<span/>", { class: "caret"})))
            .append(list);
        $container.prepend(wrapper);
    }
    
    function dropdownLink(linkText, title, value) {
        return $("<li/>")
            .append($("<a/>", {
                href: "#",
                "data-toggle": "tooltip",
                "data-container": "body",
                "title": title,
                "data-original-title": title,
                "data-value": value
            }).html(linkText));
    }
});
