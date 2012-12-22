requirejs.config({
    baseUrl: '/js',
    shim: {
        jquery:     { exports: '$' },
        d3:         { exports: 'd3' },
        underscore: { exports: '_' },
        backbone:   {
            exports: 'Backbone',
            deps: [ 'underscore', 'jquery' ]
        }
    },
})
require(['jquery', 'backbone', 'underscore', 'd3', 'util/ajaxstream'], function ($, Backbone, _, d3, Stream) {
    
    var width = $("#container").width();
    var height = Math.max($("#container").height(), 800);
    var svg  = d3.select("#container").append("svg")
        .attr("class", "GnBu")
        .attr("width", width)
        .attr("height", height);
    var quantize = d3.scale.quantile().domain([0, 1]).range(d3.range(9));
        
    var rows = 1, cols = 1;
    var size = 10;
    var stream = new Stream({
        url: "/data/expression",
        chunk: function (json) {
            if (json.meta) {
                rows = json.meta.rows;
                cols = json.meta.cols;
            } else {
                svg.append("rect")
                    .attr("width", size).attr("height", size)
                    .attr("x", (size + 0.5) * json["j"])
                    .attr("y", (size + 0.5) * json["i"])
                    .attr("class", "q" + quantize(json["value"]) + "-9");
            }
        }
    });
});