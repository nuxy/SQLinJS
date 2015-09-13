asyncTest("Test method 'deleteFrom'", function() {
  var query = 'DELETE FROM user WHERE id >= 7 AND id < 14';

  $this.SQLinJS('executeQuery', query,
    function(res) {
      ok(true, 'query executed: ' + query);
      ok(typeof res === 'boolean', 'response is Boolean');
      ok(res === true, 'response is true');
      start();
    }
  );
});
