asyncTest("Test method 'selectFrom'", function() {
	var query = "SELECT * FROM user WHERE name != 'Marc' AND id > 2 AND id <= 9";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');
			ok(res.length == 7, res.length + ' of 7 results exist');
			start();
		}
	);
});
