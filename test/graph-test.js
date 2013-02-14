var Graph = require(__dirname + '/../src/graph.js');

exports.neighbors = function (test) {
	var g = new Graph;
	var n1 = g.addNode();
	var n2 = g.addNode();
	test.equal(0, n1.neighbors().length);
	test.equal(0, n2.neighbors().length);
	n1.link(n2);
	test.equal(1, n1.neighbors().length);
	test.equal(1, n2.neighbors().length);
	test.deepEqual(n2, n1.neighbors()[0]);
	test.deepEqual(n1, n2.neighbors()[0]);
	
	// Should replace the neighbor;
	n2.link(n1);
	test.equal(1, n2.neighbors().length);
	test.deepEqual(n1, n2.neighbors()[0]);
	test.done();
}

exports.graph = function (test) {
	var g = new Graph;
	var n1 = g.addNode(5);
	var n2 = g.addNode(3);
	g.link(n1, n2, { weight: 12 });
	test.equal(2, g.nodes().length);
	test.equal(1, g.edges().length);
	test.done();
}

exports.idLinks = function (test) {
	var g = new Graph;
	var n1 = g.addNode(24);
	var n2 = g.addNode(811);
	g.link(24, 811);
	test.deepEqual(n2, n1.neighbors()[0]);
	test.done();
}

exports.metadata = function (test) {
	var node = (new Graph).addNode();
	node.attribute('a', 'x');
	node.attribute('b', 'y');
	test.deepEqual({ a: 'x', b: 'y' }, node.meta());
	test.done();
}

exports.chaining = function (test) {
	var node = (new Graph).addNode().attribute("name", "Some node");
	test.deepEqual({ 'name' : 'Some node' }, node.meta());
	test.done();
}

exports.json = function (test) {
	var g = new Graph;
	var n1 = g.addNode(3).attribute("name", "Node 1");
	var n2 = g.addNode(7).attribute("name", "Node 2");
	n1.link(n2);
	var json = {
		"nodes" : [ { id: 3, name: "Node 1" }, { id: 7, name: "Node 2" } ],
		"edges" : [ { source: 0, target: 1 } ]
	};
	test.deepEqual(json, g.json());
	test.done();
}