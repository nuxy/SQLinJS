asyncTest("Test method 'importDatabase'", function() {
  $.getJSON('http://nuxy.github.io/SQLinJS/demo.json', function(data) {
    $this.SQLinJS('importDatabase', data,
      function(res) {
        ok(typeof res === 'boolean', 'response is Boolean');
        ok(res === true, 'response is true');
        start();
      }
    );
  });
});

asyncTest("Test method 'useDatabase'", function() {
  var query = 'USE accounts';

  $this.SQLinJS('executeQuery', query,
    function(res) {
      ok(true, 'query executed: ' + query);
      ok(typeof res === 'boolean', 'response is Boolean');
      ok(res === true, 'response is true');
      start();
    }
  );
});

asyncTest("Test method 'createDatabase'", function() {
  var query = 'CREATE DATABASE test';

  $this.SQLinJS('executeQuery', query,
    function(res) {
      ok(true, 'query executed: ' + query);
      ok(typeof res === 'boolean', 'response is Boolean');
      ok(res === true, 'response is true');
      start();
    }
  );
});

asyncTest("Test method 'showDatabases'", function() {
  var query = 'SHOW DATABASES';

  $this.SQLinJS('executeQuery', query,
    function(res) {
      ok(true, 'query executed: ' + query);
      ok(res instanceof Array, 'response is Array');
      ok(res.length == 2, res.length + ' of 2 databases returned');
      start();
    }
  );
});

asyncTest("Test method 'dropDatabase'", function() {
  var query = 'DROP DATABASE test';

  $this.SQLinJS('executeQuery', query,
    function(res) {
      ok(true, 'query executed: ' + query);
      ok(typeof res === 'boolean', 'response is Boolean');
      ok(res === true, 'response is true');
      start();
    }
  );
});
