define(["underscore"], function (_) {
    "use strict";
    var defaults = {
        maxNodes: 500,
        maxEdges: 2000,
        nodeFilter: function () { return true; },
        edgeFilter: function () { return true; }
    };
    function NetworkIndex(data, options) {
        options = options ? _.clone(options) : {};
        _.defaults(options, defaults);
        var result = {};
        for (var property in data) {
            if (data.hasOwnProperty(property)) {
                result[property] = data[property];
            }
        }
        result.nodes = [];
        result.edges = [];
        var nodeMap = {};
        
        var numNodes = _.min([data.nodes.length, options.maxNodes]);
        var numEdges = _.min([data.edges.length, options.maxEdges]);
        var i = 0;
        while (result.nodes.length < numNodes && i < data.nodes.length) {
            if (options.nodeFilter(data.nodes[i])) {
                var node = _.extend({}, data.nodes[i]);
                nodeMap[node.id] = i;
                node.kbid = node.id;
                node.group = node.type;
                node.id = i;
                result.nodes.push(node);
            }
            i++;
        }
        i = 0;
        while (result.edges.length < numEdges && i < data.edges.length) {
            if (nodeMap[data.edges[i].nodeId1] !== undefined &&
                nodeMap[data.edges[i].nodeId2] !== undefined &&
                options.edgeFilter(data.edges[i])
            ) {
                var edge = _.extend({}, data.edges[i]);
                edge.source = parseInt(nodeMap[edge.nodeId1], 0);
                edge.target = parseInt(nodeMap[edge.nodeId2], 0);
                edge.weight = 1;
                result.edges.push(edge);
            }
            i++;
        }
        for (var prop in data) {
            if (!result.hasOwnProperty(prop)) {
                result[prop] = data[prop];
            }
        }
        return result;
    }
    return NetworkIndex;
});