asyncTest("Test method 'insertInto'", function() {
  var query = "INSERT INTO user (id, name) VALUES (16,'Rena'), (17,'Luiz'), (18,'Gabby'), (19,'Erika'), (20,'Markus')";

  $this.SQLinJS('executeQuery', query,
    function(res) {
      ok(true, 'query executed: ' + query);
      ok(typeof res === 'boolean', 'response is Boolean');
      ok(res === true, 'response is true');
      start();
    }
  );
});
