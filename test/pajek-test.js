var pajek = require(__dirname + '/../src/parsers/pajek');
var fixture = __dirname + '/fixtures/example.pajek';

exports.testParse = function (test) {
	var network = pajek.parse(fixture);
	var expectedJSON = require(__dirname + '/fixtures/example.pajek.json');
	// test.deepEqual(expectedJSON, network.json());
	test.done();
}