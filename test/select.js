asyncTest("Test method 'selectFrom'", function() {
	var query = "SELECT * FROM user WHERE name != 'Marc' AND id > 2 AND id != 3";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');
			ok(res.length == 10, res.length + ' of 10 results exist');
			start();
		}
	);
});
