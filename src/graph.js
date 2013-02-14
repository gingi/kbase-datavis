if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {
    var Node = function (graph, id, meta) {
    	var _meta = {};
    	var node = {
            id: id,
    		neighbors: function () {
    			return graph.neighbors(this);
    		},
    		link: function (neighbor) {
    			graph.link(this, neighbor);
                return this;
    		},
    		attribute: function (key, val) {
    			_meta[key] = val;
                return this;
    		},
    		meta: function (d) {
                if (d) {
                    for (var prop in d) {
                        _meta[prop] = d[prop];
                    }
                    return this;
                }
                return _meta;
            }
    	};
        if (meta) node.meta(meta);
    	return node;
    }

    function isInt(val) {
        return !isNaN(parseInt(val)) && (parseFloat(val) == parseInt(val)); 
    }

    var _INDEXED = new Object(1);
    var Graph = function (data, type) {
        var self = this;
        var idSequence = 0;
        var nodes = {};
        var edges = {};
        var nodelist = [];
        var nodeCount = 0;
                
        self.link = function (n1, n2, meta) {
            n1 = isInt(n1) ? n1 : n1.id;
            n2 = isInt(n2) ? n2 : n2.id;
            var key = [n1, n2].sort().join(" ");
            edges[key] = { source: nodes[n1], target: nodes[n2], meta: meta }
            return this;
        }
        self.addNode = function (id) {
            id = id || idSequence++;
            var node = new Node(this, id);
            nodes[node.id] = node;
            return node;
        }
        self.addEdge = function (edge) {
            return type == _INDEXED
                ? self.link(nodes[edge.source], nodes[edge.target], edge)
                : self.link(edge.source, edge.target, edge);
        }
        self.neighbors = function (node) {
            var arr = [];
            for (var key in edges) {
                var edge = edges[key];
                if (edge.source.id == node.id)      arr.push(edge.target);
                else if (edge.target.id == node.id) arr.push(edge.source);
            }
            return arr;
        }
        self.nodes = function () {
            var arr = [];
            for (var k in nodes) { arr.push(nodes[k]); }
            return arr;
        }
        self.edges = function () {
            var arr = [];
            for (var k in edges) { arr.push(edges[k]); }
            return arr;
        }
        self.json = function () {
            var jsonNodes = [];
            var jsonEdges = [];
            var nodeIndex = {};
            
            for (var k in nodes) {
                var node = nodes[k];
                var meta = node.meta();
                meta.id = meta.id || node.id;
                nodeIndex[node.id] = jsonNodes.length;
                jsonNodes.push(meta);
            }
            for (var key in edges) {
                var edge = edges[key];
                var attributes = {};
                attributes.source = nodeIndex[edge.source.id];
                attributes.target = nodeIndex[edge.target.id];
                for (var a in edge.meta) {
                    if (edge.meta.hasOwnProperty(a)) {
                        attributes[a] = edge.meta[a];
                    }
                }
                jsonEdges.push(attributes);
            }
            return { nodes: jsonNodes, edges: jsonEdges };
        }

        function initializeData(graph) {
            if (graph.nodes) {
                graph.nodes.forEach(function (meta) {
                    var node = new Node(self, idSequence++, meta);
                    if (type == _INDEXED)
                        nodes[nodeCount++] = node;
                    else
                        nodes[node.id] = node;
                })
            }
            if (graph.edges) {
                graph.edges.forEach(function (edge) {
                    self.addEdge(edge);
                })
            }
        }
        if (data) initializeData(data);
        return self;
    }
    Graph.INDEXED = _INDEXED;

    return Graph;
})