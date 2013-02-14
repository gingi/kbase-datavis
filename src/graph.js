if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function (require) {
    function Node(graph, id) {
    	var meta = {};
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
    			meta[key] = val;
                return this;
    		},
    		meta: function () { return meta; }
    	};
    	return node;
    }

    function isInt(val) {
        return !isNaN(parseInt(val)) && (parseFloat(val) == parseInt(val)); 
    }

    function Graph(data) {
        var idSequence = 0;
        var nodes = {};
        var edges = {};
        var nodelist = [];
        
        this.link = function (n1, n2, meta) {
            n1 = isInt(n1) ? n1 : n1.id;
            n2 = isInt(n2) ? n2 : n2.id;
            var key = [n1, n2].sort().join(" ");
            edges[key] = { source: nodes[n1], target: nodes[n2], meta: meta }
            return this;
        }
        this.addNode = function (id) {
            id = (id || idSequence++);
            var node = new Node(this, id);
            nodes[node.id] = node;
            return node;
        }
        this.neighbors = function (node) {
            var arr = [];
            for (var key in edges) {
                var edge = edges[key];
                if (edge.source.id == node.id)      arr.push(edge.target);
                else if (edge.target.id == node.id) arr.push(edge.source);
            }
            return arr;
        }
        this.nodes = function () {
            var arr = [];
            for (var k in nodes) { arr.push(nodes[k]); }
            return arr;
        }
        this.edges = function () {
            var arr = [];
            for (var k in edges) { arr.push(edges[k]); }
            return arr;
        }
        this.json = function () {
            var jsonNodes = [];
            var jsonEdges = [];
            var nodeIndex = {};
            
            for (var k in nodes) {
                var node = nodes[k];
                var meta = node.meta();
                meta.id = node.id;
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
        if (data) {
            if (data.nodes) { this.nodes(data.nodes); }
            if (data.edges) { this.edges(data.edges); }
        }
        
        return this;
    }

    return Graph;
})