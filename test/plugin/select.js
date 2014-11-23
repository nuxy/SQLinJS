asyncTest("Test method 'selectFrom'", function() {
	var query = null;

	query = "SELECT * FROM user";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2,  col.length + ' of 2  columns exist');
			equal(res.length, 13, res.length + ' of 13 results exist');

			start();
		}
	);

	stop();

	query = "SELECT * FROM user WHERE name = 'Chuck'";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2, col.length + ' of 2 columns exist');
			equal(res.length, 1, res.length + ' of 1 results exist');

			start();
		}
	);

	stop();

	query = "SELECT * FROM user WHERE name <> 'Ruby'";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2,  col.length + ' of 2  columns exist');
			equal(res.length, 12, res.length + ' of 12 results exist');

			start();
		}
	);

	stop();

	query = "SELECT * FROM user WHERE name != 'Marc'";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2,  col.length + ' of 2  columns exist');
			equal(res.length, 12, res.length + ' of 12 results exist');

			start();
		}
	);

	stop();

	query = "SELECT * FROM user WHERE name > 'Jessica'";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var count = Object.keys(res).length;
			equal(count, 0, count + ' of 0 results exist');

			start();
		}
	);

	stop();

	query = "SELECT id, name FROM user WHERE name != 'Mark' AND name != 'David'";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2,  col.length + ' of 2  columns exist');
			equal(res.length, 12, res.length + ' of 12 results exist');

			start();
		}
	);

	stop();

	query = "SELECT * FROM user WHERE name != 'Marc' AND id > 2 AND id != 3";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2,  col.length + ' of 2  columns exist');
			equal(res.length, 10, res.length + ' of 10 results exist');

			start();
		}
	);

	stop();

	query = "SELECT 1 FROM user WHERE name != 'Jessica' AND id < 8 AND id != 5";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 2, col.length + ' of 2 columns exist');
			equal(res.length, 5, res.length + ' of 5 results exist');

			start();
		}
	);

	stop();

	query = "SELECT user_id FROM profile WHERE id >= 3 AND id < 8";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 1, col.length + ' of 1 columns exist');
			equal(res.length, 5, res.length + ' of 5 results exist');

			start();
		}
	);

	stop();

	query = "SELECT user_id, active, created FROM profile WHERE id <= 10";

	$this.SQLinJS('executeQuery', query,
		function(res) {
			ok(true, 'query executed: ' + query);
			ok(res instanceof Array, 'response is Array');

			var col = Object.keys(res[0]);
			equal(col.length, 3,  col.length + ' of 3  columns exist');
			equal(res.length, 10, res.length + ' of 10 results exist');

			start();
		}
	);
});

/**
 * Return object keys as an array (IE7/8 compatible method)
 * @param Object obj
 * @returns Array;
 */
if (!Object.keys) {
	Object.keys = function (obj) {
		var keys = [];
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				keys.push(key);
			}
		}
		return keys;
	};
}
