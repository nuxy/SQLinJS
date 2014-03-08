asyncTest("Test method 'insertInto'", function() {
	var query = "INSERT INTO user (id, name) VALUES (1,'Rena'), (2,'Luiz'), (3,'Gabby'), (4,'Erika'), (5,'Markus')";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(typeof res === 'boolean', 'response is Boolean');
			ok(res === true, 'response is true');
			start();
		}
	);
});
