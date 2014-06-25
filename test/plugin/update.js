asyncTest("Test method 'updateSet'", function() {
	var query = "UPDATE user SET name = 'Marc' WHERE name = 'Mark'";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(typeof res === 'boolean', 'response is Boolean');
			ok(res === true, 'response is true');
			start();
		}
	);
});
