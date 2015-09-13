asyncTest('Initialize SQLinJS', function() {
  $this.SQLinJS();

  ok(true)
  start();
});

/**
 * Return object keys as an array (IE7/8 compatible method).
 *
 * @param Object obj
 *
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
