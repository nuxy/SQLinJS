asyncTest("Test method 'createTable'", function() {
	var query = 'CREATE TABLE test (col1 int(10), col2 varchar(10), col3 varchar(10))';

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(typeof res === 'boolean', 'response is Boolean');
			ok(res === true, 'created table with columns: col1, col2, col3');
			start();
		}
	);
});

asyncTest("Test method 'describeTable'", function() {
	var query = 'DESCRIBE test';

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(typeof res === 'object', 'response is Object');
			ok(res.col1, 'column exists: col1');
			ok(res.col2, 'column exists: col2');
			ok(res.col3, 'column exists: col3');
			start();
		}
	);
});

asyncTest("Test method 'showTables'", function() {
	var query = 'SHOW TABLES';

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');
			ok(res.length == 3, res.length + ' of 3 tables returned');
			start();
		}
	);
});

asyncTest("Test method 'dropTable'", function() {
	var query = 'DROP TABLE test';

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(typeof res === 'boolean', 'response is Boolean');
			ok(res === true, 'response is true');
			start();
		}
	);
});
