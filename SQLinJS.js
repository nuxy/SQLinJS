/**
 *  SQLinJS
 *  Manage a JavaScript object database using the SQL syntax.
 *
 *  Copyright 2012-2015, Marc S. Brooks (https://mbrooks.info)
 *  Licensed under the MIT license:
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  Dependencies:
 *    jquery.js
 */

if (!window.jQuery || (window.jQuery && parseInt(window.jQuery.fn.jquery.replace('.', '')) < parseInt('1.8.3'.replace('.', '')))) {
  throw new Error('SQLinJS requires jQuery 1.8.3 or greater.');
}

(function($) {
  var debug = false;  // SQL terminal

  var errors = {
    SYNTAX_ERROR:      'You have an error in your SQL syntax',
    NO_DB_SELECTED:    'No database selected',
    NO_DB_EXIST:       'No databases exist',
    NO_TABLES_USED:    'No tables used',
    UNKNOWN_COM:       'Unknown command',
    UNKNOWN_DB:        "Unknown database '%s'",
    UNKNOWN_TABLE:     "Unknown table '%s'",
    UNKNOWN_FIELD:     "Unknown column '%s' in '%s' table",
    CANT_CREATE_DB:    "Can't create database %s",
    CANT_DROP_DB:      "Can't drop database '%s'; database doesn't exist",
    CANT_DROP_TABLE:   "Can't drop table '%s'",
    TABLE_EXISTS:      "Table '%s' already exists",
    WRONG_VALUE_COUNT: "Column count doesn't match value count"
  };

  /**
   * @namespace SQLinJS
   */
  var methods = {

    /**
     * Create new instance of SQLinJS
     *
     * @memberof SQLinJS
     * @method init
     *
     * @example
     * var dbh = $.SQLinJS(data, callback);
     *
     * @param {Object} data
     * @param {Object} callback
     *
     * @returns {Object} jQuery object
     */
    "init": function(data, callback) {
      var $this = $(this);

      if ( $.isEmptyObject(cache()) ) {

        // Initialize cached objects.
        cache({
          _active_db: null,
          _sql_query: null,
          _database:  {},
          _query_log: []
        });

        // If database has been provided..
        if (typeof data === 'object') {
          $this.SQLinJS('importDatabase', data, callback);
        }
      }
      else
      if ( $.isFunction(callback) ) {
        callback();
      }

      return $this;
    },

    /**
     * Perform cleanup
     *
     * @memberof SQLinJS
     * @method destroy
     *
     * @example
     * dbh.SQLinJS('destroy');
     */
    "destroy": function() {
      $(this).removeData();
    },

    /**
     * Launch debug terminal to execute SQL statements using command-line interface.
     *
     * @memberof SQLinJS
     * @method initTerminal
     * @requires SQLinJS.min.css
     *
     * @example
     * dbh.SQLinJS('initTerminal');
     *
     * @param {Function} callback
     */
    "initTerminal": function(callback) {
      var $this = $(this);

      debug = true;

      var screen = $('<pre></pre>'),
          input  = $('<textarea></textarea>');

      // Create terminal elements.
      $('body').append(
        $('<div></div>')
          .attr('id', 'SQLinJS')
          .append(screen, input)
      );

      $this.SQLinJS('_bindEvents', ['screen', 'input']);

      input.focus();

      stdOut('Welcome to SQLinJS monitor. Command ends with ; or \\g.');
      stdOut();
      stdOut("Type '\\h' for help. Type '\\c' to clear the terminal.");

      runCallback(callback);
    },

    /**
     * Execute SQL statement using the plug-in supported syntax.
     *
     * @memberof SQLinJS
     * @method executeQuery
     *
     * @example
     * dbh.SQLinJS('executeQuery',"SELECT * FROM user WHERE id > 2 AND name != 'John'"
     *   function(response) {
     *
     *     // do something
     *   }
     * );
     *
     * @param {String} str
     * @param {Function} callback
     */
    "executeQuery": function(str, callback) {
      var $this = $(this),
          data  = cache();

      if (debug) {
        str = $.trim(str);

        stdOut('\r\nsql> ' + str);

        // Log queries
        data['_query_log'].push( logFormat(str) );

        cache('_query_log', data['_query_log']);
      }
      else
      if ( $.isEmptyObject(cache('_database')) ) {
        return throwError(errors.NO_DB_SELECTED);
      }

      // Record SQL query
      cache('_sql_query', str);

      switch (true) {
        case /^CREATE/i.test(str):
          $this.SQLinJS('_Create', callback);
        break;

        case /^DELETE/i.test(str):
          $this.SQLinJS('_Delete', callback);
        break;

        case /^DESCRIBE/i.test(str):
          $this.SQLinJS('_Describe', callback);
        break;

        case /^DROP/i.test(str):
          $this.SQLinJS('_Drop', callback);
        break;

        case /^INSERT/i.test(str):
          $this.SQLinJS('_Insert', callback);
        break;

        case /^SELECT/i.test(str):
          $this.SQLinJS('_Select', callback);
        break;

        case /^SHOW/i.test(str):
          $this.SQLinJS('_Show', callback);
        break;

        case /^UPDATE/i.test(str):
          $this.SQLinJS('_Update', callback);
        break;

        case /^USE/i.test(str):
          $this.SQLinJS('_Use', callback);
        break;

        case /^\\c/i.test(str):
          clearTerminal();
        break;

        case /^\\h/i.test(str):
          viewHelp();
        break;

        default:
          stdErr('UNKNOWN_COM', callback);
      }
    },

    /**
     * Import an existing database in the supported database format.
     * The database will be autoloaded on successful import.
     *
     * @memberof SQLinJS
     * @method importDatabase
     *
     * @example
     * dbh.SQLinJS('importDatabase', data,
     *   function(response) {
     *
     *     // do something
     *   }
     * );
     *
     * @param {Object} data
     * @param {Function} callback
     */
    "importDatabase": function(data, callback) {
      if (typeof data === 'object') {
        for (var key in data) {
          if (data.hasOwnProperty(key)) {
            cache('_database', data);

            stdOut('Imported database ' +  key);

            runCallback(callback, true);
          }
          else {
            return stdErr('CANT_CREATE_DB', key, callback);
          }
        }
      }
    },

    /**
     * Create a new database.
     *
     * @memberof SQLinJS
     * @method createDatabase
     *
     * @example
     * dbh.SQLinJS('createDatabase', 'accounts',
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} name
     * @param {Function} callback
     */
    "createDatabase": function(name, callback) {
      var data = cache('_database');

      if (!validName(name)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (data.hasOwnProperty(name)) {
        return stdErr('CANT_CREATE_DB', name, callback);
      }

      var timer = calcExecTime(function() {

        // Create an empty database
        data[name] = {};

        cache('_database', data);
      });

      stdStatOut(0, timer, true);

      runCallback(callback, true);
    },

    /**
     * Create a new table in an existing database.
     *
     * @memberof SQLinJS
     * @method createTable
     *
     * @example
     * dbh.SQLinJS('createTable', 'user', { "id": "int(10)", "name": "varchar(10)" },
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} name
     * @param {Object} defs
     * @param {Function} callback
     */
    "createTable": function(name, defs, callback) {
      var used = cache('_active_db'),
          data = cache('_database');

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(name)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (data[used].hasOwnProperty(name)) {
        return stdErr('TABLE_EXISTS', name, callback);
      }

      var cols = [];

      // Check supported data types.
      for (var type in defs) {
        if (/^((VAR)*CHAR|INT)(\(\d+\))*$/i.test(defs[type])) {
          cols.push(type);
        }
      }

      if (cols.length === 0) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      var timer = calcExecTime(function() {

        // Create table properties.
        data[used][name] = {
          _cols: cols,
          _defs: defs,
          _data: []
        };

        cache('_database', data);
      });

      stdStatOut(0, timer, true);

      runCallback(callback, true);
    },

    /**
     * Delete record(s) from the selected table.
     *
     * @memberof SQLinJS
     * @method deleteFrom
     *
     * @example
     * dbh.SQLinJS('deleteFrom', 'user',
     *   {
     *     conds: ['id > 2',"id != 4"]
     *   },
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} table
     * @param {Object} clause
     * @param {Function} callback
     */
    "deleteFrom": function(table, clause, callback) {
      var $this = $(this),
          used  = cache('_active_db'),
          data  = cache('_database'),
          res   = [],
          count = 0;

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(table)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data[used] || !data[used].hasOwnProperty(table)) {
        return stdErr('UNKNOWN_TABLE', table, callback);
      }

      var timer = calcExecTime(function() {
        var rows = data[used][table]['_data'];

        res = $this.SQLinJS('_QueryDB', data[used], table, ['*'], clause, callback);

        for (var i = 0; i < res[1].length; i++) {
          var obj = res[1][i];

          // Iterate table rows
          for (var j = 0; j < rows.length; j++) {
            var row = rows[j];

            if (!compareObj(row, obj)) continue;

            // .. remove row data
            rows.splice(j, 1);
            count += 1;
          }
        }

        // Remove 'undefined' buckets from array
        data[used][table]['_data'] = reindexArray(rows);

        cache('_database', data);
      });

      stdStatOut(count, timer, true);

      runCallback(callback, true);
    },

    /**
     * Returns basic information about the columns of the table.
     *
     * @memberof SQLinJS
     * @method describeTable
     *
     * @example
     * dbh.SQLinJS('describeTable', 'user',
     *   function(response) {
     *     for (var key in response) {
     *       alert('column=' + key + '; type=' + response[key]);
     *     }
     *   }
     * );
     *
     * @param {String} name
     * @param {Function} callback
     */
    "describeTable": function(name, callback) {
      var used = cache('_active_db'),
          data = cache('_database');

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(name)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data[used].hasOwnProperty(name)) {
        return stdErr('UNKNOWN_TABLE', name, callback);
      }

      var defs  = data[used][name]['_defs'],
          count = 0;

      var timer = calcExecTime(function() {
        var cols  = ['Field', 'Type'],
          vals = getObjAsCols(cols, defs);

        stdTermOut(cols, vals);

        count = vals.length;
      });

      stdStatOut(count, timer);

      runCallback(callback, defs);
    },

    /**
     * Delete a database, by name.
     *
     * @memberof SQLinJS
     * @method dropDatabase
     *
     * @example
     * dbh.SQLinJS('dropDatabase', 'accounts',
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} name
     * @param {Function} callback
     */
    "dropDatabase": function(name, callback) {
      var data = cache('_database');

      if (!validName(name)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data && !data.hasOwnProperty(name)) {
        return stdErr('CANT_DROP_DB', name, callback);
      }

      var timer = calcExecTime(function() {
        delete data[name];

        cache('_database', data);
      });

      stdStatOut(0, timer, true);

      runCallback(callback, true);
    },

    /**
     * Delete a table, by name, from an existing database.
     *
     * @memberof SQLinJS
     * @method dropTable
     *
     * @example
     * dbh.SQLinJS('dropTable', 'user',
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} name
     * @param {Function} callback
     */
    "dropTable": function(name, callback) {
      var used = cache('_active_db'),
          data = cache('_database');

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(name)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data[used] || !data[used].hasOwnProperty(name)) {
        return stdErr('CANT_DROP_TABLE', name, callback);
      }

      var timer = calcExecTime(function() {
        delete data[used][name];

        cache('_database', data);
      });

      stdStatOut(0, timer, true);

      runCallback(callback, true);
    },

    /**
     * Insert a new record into the selected table.
     *
     * @memberof SQLinJS
     * @method insertInto
     *
     * @example
     * dbh.SQLinJS('insertInto', 'user',
     *   [
     *     { id: '1', name: 'Jerry' },
     *     { id: '2', name: 'Alice' },
     *     { id: '3', name: 'Mable' }
     *   ],
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} table
     * @param {Object} vals
     * @param {Function} callback
     */
    "insertInto": function(table, vals, callback) {
      var used = cache('_active_db'),
          data = cache('_database');

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(table)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data[used] || !data[used].hasOwnProperty(table)) {
        return stdErr('UNKNOWN_TABLE', table, callback);
      }

      // Support Object values for backwards compatibility.
      if (!vals instanceof Array) {
           vals = new Array(vals);
      }

      var timer = calcExecTime(function() {
        var defs = data[used][table]['_defs'];

        for (var i = 0; i < vals.length; i++) {
          var obj = {};

          for (var col in vals[i]) {
            if (vals[i].hasOwnProperty(col)) {
              var val = vals[i][col].replace(/['"](.*)["']/,'$1');

              if (!defs.hasOwnProperty(col)) {
                return stdErr('UNKNOWN_FIELD', col, table, callback);
              }

              // Process values based on data type definition.
              var type = defs[col].replace(/^([a-zA-Z]+)(?:\((\d+)\))*$/,'$1\0$2').split('\0'),
                  name = type[0],
                  size = ( $.isNumeric(type[1]) ) ? type[1] : val.length;

              switch (true) {
                case /((VAR)*CHAR)/i.test(name):

                  // Truncate value to defined type length.
                  obj[col] = val.substring(0, size) || undefined;
                break;

                case /INT/i.test(name):
                  obj[col] = parseInt(val);
                break;
              }
            }
          }

          if (obj) {
            data[used][table]['_data'].push(obj);

            // Insert new record
            cache('_database', data);
          }
        }
      });

      if (timer) {
        stdStatOut(0, timer, true);

        runCallback(callback, true);
      }
    },

    /**
     * Select column(s) data from the selected table.
     *
     * @memberof SQLinJS
     * @method selectFrom
     *
     * @example
     * dbh.SQLinJS('selectFrom', 'user', ['id', 'name'],
     *   {
     *     conds:    ['id > 2',"name != 'John'"],
     *     order_by: 'id',
     *     sort:     'desc',
     *     limit:    3
     *   },
     *   function(response) {
     *     for (var i = 0; i < response.length; i++) {
     *       for (var key in response[i]) {
     *         alert('id=' + key.id + '; name=' + key.name);
     *       }
     *     }
     *   }
     * );
     *
     * @param {String} table
     * @param {Array} cols
     * @param {Object} clause
     * @param {Function} callback
     */
    "selectFrom": function(table, cols, clause, callback) {
      var $this = $(this),
          used  = cache('_active_db'),
          data  = cache('_database'),
          res   = [],
          count = 0;

      if ( $.isFunction(clause) ) {
        callback = clause;
      }

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(table)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data[used] || !data[used].hasOwnProperty(table)) {
        return stdErr('UNKNOWN_TABLE', table, callback);
      }

      var timer = calcExecTime(function() {
        res = $this.SQLinJS('_QueryDB', data[used], table, cols, clause, callback);

        if (res[1]) {
          count = res[1].length;
        }
        else {
          return res;
        }
      });

      if (timer) {
        if (count > 0) {
          stdTermOut(res[0], res[1]);
        }

        stdStatOut(count, timer);

        runCallback(callback, res[1]);
      }
    },

    /**
     * Return an array of database names.
     *
     * @memberof SQLinJS
     * @method showDatabases
     *
     * @example
     * dbh.SQLinJS('showDatabases',
     *   function(response) {
     *     for (var i = 0; i <= response.length; i++) {
     *       for (var key in response[i]) {
     *         alert(response[key]);
     *       }
     *     }
     *   }
     * );
     *
     * @param {Function} callback
     */
    "showDatabases": function(callback) {
      var data = cache('_database');

      if (!data) {
        return stdErr('NO_DB_EXISTS', callback);
      }

      var cols  = ['Database'],
          count = 0,
          vals  = null;

      var timer = calcExecTime(function() {
        vals = getObjKeys(data, cols);

        stdTermOut(cols, vals);

        count = vals.length;
      });

      stdStatOut(count, timer);

      runCallback(callback, vals);
    },

    /**
     * Return an array of table names in the active database.
     *
     * @memberof SQLinJS
     * @method showTables
     *
     * @example
     * dbh.SQLinJS('showTables',
     *   function(response) {
     *     for (var i = 0; i <= response.length; i++) {
     *       for (var key in response[i]) {
     *         alert(response[key]);
     *       }
     *     }
     *   }
     * );
     *
     * @param {Function} callback
     */
    "showTables": function(callback) {
      var used = cache('_active_db'),
          data = cache('_database');

      if (!cache) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if ( $.isEmptyObject(data[used]) ) {
        return stdErr('NO_TABLES_USED', callback);
      }

      var cols  = ['Tables' + '_in_' + used],
          count = 0,
          vals  = null;

      var timer = calcExecTime(function() {
        vals = getObjKeys(data[used], cols);

        stdTermOut(cols, vals);

        count = vals.length;
      });

      stdStatOut(count, timer);

      runCallback(callback, vals);
    },

    /**
     * Select column data from the selected table based on conditional arguments.
     *
     * @memberof SQLinJS
     * @method updateSet
     *
     * @example
     * dbh.SQLinJS('updateSet', 'user', ["name = 'Fred'"],
     *   {
     *     conds: ['id > 2',"name != 'John'"]
     *   },
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} table
     * @param {Array} cols
     * @param {Object} clause
     * @param {Function} callback
     */
    "updateSet": function(table, cols, clause, callback) {
      var $this = $(this),
          used  = cache('_active_db'),
          data  = cache('_database'),
          res   = [],
          count = 0;

      if ( $.isFunction(clause) ) {
        callback = clause;
      }

      if (!data[used]) {
        return stdErr('NO_DB_SELECTED', callback);
      }

      if (!validName(table)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data[used] || !data[used].hasOwnProperty(table)) {
        return stdErr('UNKNOWN_TABLE', table, callback);
      }

      var timer = calcExecTime(function() {
        var defs = data[used][table]['_defs'],
            rows = data[used][table]['_data'];

        res = $this.SQLinJS('_QueryDB', data[used], table, ['*'], clause, callback);

        for (var i = 0; i < res[1].length; i++) {
          var obj = res[1][i];

          // Iterate table rows
          for (var j = 0; j < rows.length; j++) {
            var row = rows[j];

            if (!compareObj(row, obj)) continue;

            // .. columns/values
            for (var k = 0; k < cols.length; k++) {
              var parts = cols[k].replace(/^(\w+)\s*=\s*(?:'|")*(.+?)(?:"|')*$/,'$1\0$2').split('\0'),
                  col   = parts[0],
                  val   = parts[1];

              if (!defs.hasOwnProperty(col)) {
                return stdErr('UNKNOWN_FIELD', col, table, callback);
              }

              // .. update column value
              row[col] = val;
            }

            count += 1;
          }
        }

        cache('_database', data);
      });

      if (timer) {
        stdStatOut(count, timer, true);

        runCallback(callback, true);
      }
    },

    /**
     * Load the selected database to access.
     *
     * @memberof SQLinJS
     * @method useDatabase
     *
     * @example
     * dbh.SQLinJS('useDatabase', 'accounts',
     *   function(response) {
     *     if (response === true) {
     *
     *       // do something
     *     }
     *   }
     * );
     *
     * @param {String} name
     * @param {Function} callback
     */
    "useDatabase": function(name, callback) {
      var data = cache('_database');

      if (!validName(name)) {
        return stdErr('SYNTAX_ERROR', callback);
      }

      if (!data || !data.hasOwnProperty(name)) {
        return stdErr('UNKNOWN_DB', name, callback);
      }

      cache('_active_db', name);

      stdOut('Database changed');

      runCallback(callback, true);
    },

    /**
     * Add event handlers to select elements.
     *
     * @memberof SQLinJS
     * @method _bindEvents
     * @private
     *
     * @param {Array} names
     */
    "_bindEvents": function(names) {
      var $this = $(this);

      var terminal = $('#SQLinJS'),
          screen   = terminal.find('pre'),
          input    = terminal.find('textarea');

      for (var i = 0; i < names.length; i++) {
        switch (names[i]) {
          case 'screen':
            terminal
              .on('click', function() { input.focus(); });
          break;

          case 'input':
            var index = 0;

            input
              .on('keypress', function(event) {
                if (event.which != 13) return;

                event.preventDefault();

                // Execute SQL queries seperated by semicolon.
                var str = $(this).val();

                var queries =
                  $.grep(str.split(/;|\\g/), function(bucket) {
                    if (!/^(\s+|\\g+|;)*$/.test(bucket)) {
                      return bucket;
                    }
                  });

                var count = queries.length;
                if (count > 0) {
                  for (var i = 0; i < count; i++) {
                    $this.SQLinJS('executeQuery', queries[i]);
                  }
                }

                $(this).val(null).focus();

                var buffer = cache('_query_log');
                index = buffer.length;

                // Force scroll positioning.
                screen.scrollTop( screen.prop('scrollHeight') );
              })
              .on('keyup', function(event) {
                var buffer = cache('_query_log'),
                    count  = buffer.length;

                // Scroll command buffer
                switch (event.which) {
                  case 38:

                    // .. view last command
                    index = (index > 0)
                      ? index -= 1
                      : 0;
                  break;

                  case 40:

                    // .. view next command
                    index = ((index + 1) < count)
                      ? index += 1
                      : index;
                  break;

                  default: return;
                }

                if (count > 1) {
                  $(this).val(buffer[index].query);
                }
              });
          break;
        }
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Create
     * @private
     *
     * @param {Function} callback
     */
    "_Create": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      switch (true) {
        case /^CREATE\s+DATABASE/i.test(query):
          (function() {
            try {
              var regex = /^CREATE\s+DATABASE\s+(\w+)$/i,
                  name  = query.replace(regex,'$1');

              $this.SQLinJS('createDatabase', name, callback);
            }
            catch(err) {
              stdErr('SYNTAX_ERROR', callback);
            }
          })();
        break;

        case /^CREATE\s+TABLE/i.test(query):
          (function() {
            try {
              var regex = /^CREATE\s+TABLE\s+(\w+)\s+\((.+)\)$/i,
                  parts = query.replace(regex,'$1|$2').split(/\|/),
                  name  = parts[0],
                  defs  = parts[1].split(/\s*,\s*/);

              var obj  = {};

              // Fold column type key/values into an object.
              for (var i = 0; i < defs.length; i++) {
                var val = defs[i].split(/\s+/);
                obj[ val[0] ] = val[1];
              }

              $this.SQLinJS('createTable', name, obj, callback);
            }
            catch(err) {
              stdErr('SYNTAX_ERROR', callback);
            }
          })();
        break;

        default:
          stdErr('UNKNOWN_COM', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Delete
     * @private
     *
     * @param {Function} callback
     */
    "_Delete": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      try {
        var regex = /^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))*(?:(?:\s+ORDER\s+BY\s+(\w+))*(?:\s+(ASC|DESC)*)*(?:\s+LIMIT\s+(\d+))*)*$/i,
            parts = query.replace(regex,'$1\0$2\0$3\0$4\0$5').split('\0'),
            table = parts[0],
            conds = parts[1].split(/AND/i);

        $this.SQLinJS('deleteFrom', table, {
          conds:    ((conds[0]) ? conds : undefined),
          order_by: parts[2],
          sort:     parts[3],
          limit:    parts[4]
        }, callback);
      }
      catch(err) {
        stdErr('SYNTAX_ERROR', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Describe
     * @private
     *
     * @param {Function} callback
     */
    "_Describe": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      var regex = /^DESCRIBE\s+(\w+)*$/i,
          table = query.replace(regex,'$1');

      $this.SQLinJS('describeTable', table, callback);
    },

    /**
     * @memberof SQLinJS
     * @method _Drop
     * @private
     *
     * @param {Function} callback
     */
    "_Drop": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      switch (true) {
        case /^DROP\s+DATABASE/i.test(query):
          (function() {
            var regex = /^DROP\s+DATABASE\s+(\w+)*$/i,
                name  = query.replace(regex,'$1');

            $this.SQLinJS('dropDatabase', name, callback);
          })();
        break;

        case /^DROP\s+TABLE/i.test(query):
          (function() {
            var regex = /^DROP\s+TABLE\s+(\w+)*$/i,
                name  = query.replace(regex,'$1');

            $this.SQLinJS('dropTable', name, callback);
          })();
        break;

        default:
          stdErr('UNKNOWN_COM', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Insert
     * @private
     *
     * @param {Function} callback
     */
    "_Insert": function(callback) {
      var $this = $(this),
          query = cache('_sql_query'),
          used      = cache('_active_db'),
          data      = cache('_database');

      try {
        var regex = /^INSERT\s+INTO\s+(.+?)\s+(?:\((.+)\)\s+)*VALUES\s+\((.+)\)$/i,
            parts = query.replace(regex,'$1\0$2\0$3').split('\0'),
            table = parts[0],
            cols  = parts[1].split(/\s*,\s*/),
            vals  = parts[2].split(/\s*\)\s*,\s*\(\s*/);

        if (!cols[0]) {
          cols = data[used][table]['_cols'];
        }

        var _vals = [];

        // Convert string VALUES to an array of object(s).
        for (var i = 0; i < vals.length; i++) {
          var items = vals[i].split(/\s*,\s*/);

          if (cols.length != items.length) {
            return stdErr('WRONG_VALUE_COUNT', callback);
          }

          _vals.push( getValsAsObj(cols, items) );
        }

        $this.SQLinJS('insertInto', table, _vals, callback);
      }
      catch(err) {
        stdErr('SYNTAX_ERROR', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Select
     * @private
     *
     * @param {Function} callback
     */
    "_Select": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      try {
        var regex = /^SELECT\s+(.+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))*(?:(?:\s+ORDER\s+BY\s+(\w+))*(?:\s+(ASC|DESC)*)*(?:\s+LIMIT\s+(\d+))*)*$/i,
            parts = query.replace(regex,'$1\0$2\0$3\0$4\0$5\0$6').split('\0'),
            table = parts[1],
            cols  = parts[0].split(/\s*,\s*/),
            conds = parts[2].split(/AND/i);

        $this.SQLinJS('selectFrom', table, cols, {
          conds:    ((conds[0]) ? conds : undefined),
          order_by: parts[3],
          sort:     parts[4],
          limit:    parts[5]
        }, callback);
      }
      catch(err) {
        stdErr('SYNTAX_ERROR', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Show
     * @private
     *
     * @param {Function} callback
     */
    "_Show": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      switch (true) {
        case /^SHOW\s+DATABASES;?$/i.test(query):
          $this.SQLinJS('showDatabases', callback);
        break;

        case /^SHOW\s+TABLES;?$/i.test(query):
          $this.SQLinJS('showTables', callback);
        break;

        default:
          stdErr('UNKNOWN_COM', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Update
     * @private
     *
     * @param {Function} callback
     */
    "_Update": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      try {
        var regex = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+?))*(?:(?:\s+ORDER\s+BY\s+(\w+))*(?:\s+(ASC|DESC)*)*(?:\s+LIMIT\s+(\d+))*)*$/i,
            parts = query.replace(regex,'$1\0$2\0$3\0$4\0$5').split('\0'),
            table = parts[0],
            cols  = parts[1].split(/\s*,\s*/),
            conds = parts[2].split(/AND/i);

        $this.SQLinJS('updateSet', table, cols, {
          conds:    ((conds[0]) ? conds : undefined),
          order_by: parts[3],
          sort:     parts[4],
          limit:    parts[5]
        }, callback);
      }
      catch(err) {
        stdErr('SYNTAX_ERROR', callback);
      }
    },

    /**
     * @memberof SQLinJS
     * @method _Use
     * @private
     *
     * @param {Function} callback
     */
    "_Use": function(callback) {
      var $this = $(this),
          query = cache('_sql_query');

      var regex = /^USE\s+(\w+)$/i,
          name  = query.replace(regex,'$1');

      $this.SQLinJS('useDatabase', name, callback);
    },

    /**
     * @memberof SQLinJS
     * @method _QueryDB
     * @private
     *
     * @param {Object} object
     * @param {String} table
     * @param {Array} cols
     * @param {Object} clause
     * @param {Function} callback
     *
     * @returns {Array}
     */
    "_QueryDB": function(data, table, cols, clause, callback) {
      var names = data[table]['_cols'],
          rows  = data[table]['_data'],
          vals  = [],
          count = 0;

      // Iterate table rows
      for (var i = 0; i < rows.length; i++) {
        var row  = rows[i],
            obj  = {},
            skip = null;

        // Return all columns; boolean or wildcard.
        if (cols[0] == '1' || cols[0] == '*') {
          cols = names;
        }

        // Process columns/values
        for (var j = 0; j < cols.length; j++) {
          var col = cols[j];

          for (var k = 0; k < names.length; k++) {
            var name = names[k],
                val  = (row[name] !== undefined) ? row[name] : 'NULL';

            if (row[col] === undefined) {
              return stdErr('UNKNOWN_FIELD', col, table, callback);
            }

            if (!clause.conds || skip) {
              if (name != col) continue;

              if (!obj.hasOwnProperty(name)) {
                obj[name] = val;
              }

              continue;
            }

            // Test WHERE clause conditional expressions.
            for (var m = 0; m < clause.conds.length; m++) {
              var regex = /^\s*(\w+)\s*([!=<>]+|LIKE)\s*(.*)\s+/i,
                  parts = clause.conds[m].replace(regex,'$1\0$2\0$3').split('\0');

              if ($.inArray(parts[0], names) === -1) {
                return stdErr('UNKNOWN_FIELD', parts[0], table, callback);
              }

              var res = testExpr(parts, name, val);

              switch (res) {
                case 0:
                  skip = true;
                break;

                case 2:
                  return stdErr('SYNTAX_ERROR', callback);

                default:
                  if (name != col) continue;

                  if (!obj.hasOwnProperty(name)) {
                    obj[name] = val;
                  }

                  break;
              }
            }
          }
        }

        if (!skip) {
          if (parseInt(clause.limit) <= count) continue;

          vals.push(obj);
          count += 1;
        }
      }

      // Sort results array of objects, by key (column name).
      if (clause.order_by && clause.sort == 'desc') {
        vals.sort(function(a, b) {
          return (a[clause.order_by] < b[clause.order_by])
            ? 1
            : ((b[clause.order_by] < a[clause.order_by]) ? -1 : 0);
        });
      }

      return [cols, vals];
    }
  };

  $.fn.SQLinJS = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
    }
    else
    if (typeof method === 'object' || !method) {
      return methods.init.apply(this, arguments);
    }
    else {
      $.error('Method ' +  method + ' does not exist in SQLinJS');
    }
  };

  /**
   * Return true if in valid format - [a-zA-Z0-9_]
   *
   * @protected
   *
   * @param {String} str
   *
   * @returns {Boolean}
   */
  function validName(str) {
    if (!str) return false;
    return /^\w+$/g.test(str);
  }

  /**
   * Return true if an integer.
   *
   * @protected
   *
   * @param {String} val
   *
   * @returns {Boolean}
   */
  function validNum(val) {
    if (parseInt(val) == val) return true;
  }

  /**
   * Return array values (folded) as an object.
   *
   * @protected
   *
   * @param {Array} names
   * @param {Array} vals
   *
   * @returns {Object}
   */
  function getValsAsObj(names, vals) {
    var obj = {};
    for (var i = 0; i < names.length; i++) {
      obj[names[i]] = vals[i];
    }
    return obj;
  }

  /**
   * Return key/values as array of object(s).
   *
   * @protected
   *
   * @param {Array}  names
   * @param {Object} obj
   *
   * @returns {Array}
   */
  function getObjAsCols(names, obj) {
    var vals = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var new_obj = {};
        for (var i = 0; i < names.length; i++) {
          new_obj[ names[i] ] = (i === 0) ? key : obj[key];
        }

        vals.push(new_obj);
      }
    }
    return vals;
  }

  /**
   * Return key names (1st child) as array of objects.
   *
   * @protected
   *
   * @param {Object} data
   * @param {String} name
   *
   * @returns {Array}
   */
  function getObjKeys(data, name) {
    var vals = [];
    for (var key in data) {
      if (data.hasOwnProperty(key)) {
        var new_obj = {};
        new_obj[name] = key;
        vals.push(new_obj);
      }
    }
    return vals;
  }

  /**
   * Perform single-level comparison of two objects.
   *
   * @protected
   *
   * @param {Object} obj1
   * @param {Object} obj2
   *
   * @returns {Boolean}
   */
  function compareObj(obj1, obj2) {
    for (var key1 in obj1) {
      if (obj1.hasOwnProperty(key1)) {
        if (obj1[key1] !== obj2[key1]) {
          return false;
        }
      }
    }

    for (var key2 in obj2) {
      if (obj2.hasOwnProperty(key2)) {
        if (obj1[key2] !== obj2[key2]) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Remove 'undefined' buckets from an array.
   *
   * @protected
   *
   * @param {Array} arr
   *
   * @returns {Array}
   */
  function reindexArray(arr) {
    var new_arr = [];
    for (var index in arr) {
      if (arr.hasOwnProperty(index)) {
        if (arr[index] === undefined) continue;
        new_arr.push(arr[index]);
      }
    }
    return new_arr;
  }

  /**
   * Calculate execution time of a function (not precise, but simple).
   *
   * @protected
   *
   * @param {Function} func
   *
   * @returns {String}
   */
  function calcExecTime(func) {
    try {
      if ( $.isFunction(func) ) {
        var start = new Date().getMilliseconds(),
            error = func();
        if (error) return 0;
        var stop = new Date().getMilliseconds();
        return ((stop - start) / 100).toFixed(2);
      }
    }
    catch(err) {
      throwError(err);
    }
  }

  /**
   * Return values based on expression result.
   *
   * @protected
   *
   * @param {Array} conds
   * @param {String} col1
   * @param {String} val1
   *
   * @returns {Number}
   *
   *  0 - Expression result is false
   *  1 - Expression result is true
   *  2 - Invalid condition/expression
   */
  function testExpr(conds, col1, val1) {
    if (conds.length != 3 || !conds[2]) return 2;

    var col2 = conds[0],
        op   = conds[1],
        val2 = conds[2];

    if (col1 != col2) return;

    // Test expression by type
    if (!/^([!=]+|<>|LIKE)$/i.test(op) && validNum(val1) && validNum(val2)) {
      var num1 = val1,
          num2 = val2;

      // .. numeric operations
      switch (op) {
        case '<':
          if (num1 < num2) return 1;
        break;

        case '>':
          if (num1 > num2) return 1;
        break;

        case '<=':
          if (num1 <= num2) return 1;
        break;

        case '>=':
          if (num1 >= num2) return 1;
        break;
      }
    }
    else {
      var str1 = val1,
          str2 = val2.replace(/'(.*)'/,'$1');

      str1 = ( !$.isNumeric(str1) ) ? str1.toLowerCase() : str1;
      str2 = ( !$.isNumeric(str2) ) ? str2.toLowerCase() : str2;

      // .. string comparison
      switch (op.toUpperCase()) {
        case '=':
          if (str1 == str2) return 1;
        break;

        case '!=':
          if (str1 != str2) return 1;
        break;

        case '<>':
          if (str1 != str2) return 1;
        break;

        case 'LIKE':
          var regex = str2.replace(/^%+|%+$/g,'(.*)');

          // Use per-character matching
          if (val1.match(new RegExp('^' + regex + '$', 'i'))) {
            return 1;
          }
        break;
      }
    }

    return 0;
  }

  /**
   * Return 'query_log' entry as an object.
   *
   * @protected
   *
   * @param {String} str
   *
   * @returns {Object}
   */
  function logFormat(str) {
    return { query: str, time: new Date().getTime() };
  }

  /**
   * Return help menu as a string.
   *
   * @protected
   */
  function viewHelp() {
    window.open('http://nuxy.github.io/SQLinJS/#syntax');
  }

  /**
   * Clear all messages in screen.
   *
   * @protected
   */
  function clearTerminal() {
    $('#SQLinJS pre').empty();
  }

  /**
   * Print error message to screen.
   *
   * @protected
   *
   * @param {String}   code
   * @param {Function} func
   */
  function stdErr() {
    var args = arguments,
        code = args[0],
        func = args[args.length -1];

    if (!errors.hasOwnProperty(code)) return;

    if (debug) {
      var str = errors[code];

      for (var i = 1; i < args.length; i++) {
        str = str.replace(/\%s/i, args[i]);
      }

      stdOut('ERROR: ' + str);
      return 1;
    }

    if ( $.isFunction(func) ) {
      runCallback(func, code);
    }
  }

  /**
   * Print message to screen; add newline to output.
   *
   * @protected
   *
   * @param {String} str
   */
  function stdOut(str) {
    if (!debug) return;

    $('#SQLinJS pre').append(((str) ? str : '') + '\r\n');
  }

  /**
   * Print query response message to screen.
   *
   * @protected
   *
   * @param {String}  count
   * @param {String}  timer
   * @param {Boolean} write
   */
  function stdStatOut(count, timer, write) {
    if (!debug) return;

    var rows = count + ' row' + ((count === 0 || count > 1) ? 's' : '');

    if (arguments.length > 1 && !write) {
      stdOut(rows + ' in set &#40;' + timer + ' sec&#41;');
    }
    else {
      stdOut('Query OK, ' + rows + ' affected' + ((timer) ? ' &#40;' + timer + ' sec&#41;' : ''));
    }
  }

  /**
   * Print tablular format message to screen.
   *
   * @protected
   *
   * @param {Array} cols
   * @param {Array} data
   *
   * Example:
   *     stdTermOut(
   *         ['col1', 'col2', 'col3'],[
   *             { col1: 'value1', col2: 'value2', col3: 'value3' },
   *             { col1: 'value1', col2: 'value2', col3: 'value3' },
   *             { col1: 'value1', col2: 'value2', col3: 'value3' }
   *         ]
   *     );
   */
  function stdTermOut(cols, data) {
    if (!debug) return;

    var sizes = {},
        count = 0;

    for (var i = 0; i < cols.length; i++) {
      var name = cols[i];

      sizes[name] = name.length;

      for (var j = 0; j < data.length; j++) {
        (function() {
          var rows = data[j],
              len  = String(rows[name]).length;

          if (len > sizes[name]) {
            sizes[name] = len;
          }
        })();
      }

      count += sizes[name] + 3;
    }

    cols = $.map(cols, function(val) {
      return padStrRgt(String(val), sizes[val]);
    });

    genTermHeader(count, cols);

    for (var k = 0; k < data.length; k++) {
      (function() {
        var rows = data[k],
            arr  = [];

        for (var key in rows) {
          if (rows.hasOwnProperty(key)) {
            arr.push(padStrRgt(String(rows[key]), sizes[key]));
          }
        }

        genTermRow(sizes[key], arr);
      })();
    }

    genTermRow(count);
  }

  /**
   * Print tablular format header to screen.
   *
   * @protected
   *
   * @param {String} len
   * @param {Array}  cols
   */
  function genTermHeader(len, cols) {
    genTermRow(len);
    genTermRow(len, cols);
    genTermRow(len);
  }

  /**
   * Print tablular format row to screen.
   *
   * @protected
   *
   * @param {String} len
   * @param {Array}  cols
   */
  function genTermRow(len, cols) {
    var temp = new Array(len);

    stdOut(
      (cols)
        ? '| ' + cols.join(' | ') + ' |'
        : '+'  + temp.join('-')   + '+'
    );
  }

  /**
   * Append white space to the right side of a string.
   *
   * @protected
   *
   * @param {String} str
   * @param {String} len
   * @param {String}
   */
  function padStrRgt(str, len) {
    return str + (new Array(len).join(' ')).slice(0, len - str.length);
  }

  /**
   * Run callback function; die on errors.
   *
   * @protected
   *
   * @param {Function} func
   * @param {*} data
   */
  function runCallback(func, data) {
    try {
      if ( $.isFunction(func) ) {
        func(data);
      }
    }
    catch(err) {
      throwError(err);
    }
  }

  /**
   * Output errors including caller object.
   *
   * @protected
   *
   * @param {String} str
   */
  function throwError(str) {
    throw new Error(str);
  }

  /**
   * Cache data using jQuery.data, by default; Web Storage when supported.
   *
   * @protected
   *
   * @param {String} key
   * @param {*} val
   *
   * @returns {*}
   */
  function cache(key, val) {

    // HTML5 Web Storage
    if (window.sessionStorage && window.JSON) {
      var storage = window.sessionStorage;

      // Set single value
      if (typeof key === 'string' && val) {
        storage.setItem(key, JSON.stringify(val));
      }
      else

      // Set multiple
      if (typeof key === 'object' && !val) {
        (function() {
          for (var arg in key) {
            if (key.hasOwnProperty(arg)) {
              storage.setItem(arg, JSON.stringify(key[arg]));
            }
          }
        })();
      }

      // Return single value
      if (typeof key === 'string' && !val) {
        return $.parseJSON(storage.getItem(key));
      }

      var data = {};

      // Return all values
      for (var i = 0; i < storage.length; i++) {
        key = storage.key(i);

        data[key] = $.parseJSON(storage.getItem(key));
      }

      return data;
    }

    // jQuery.data
    else {
      var $this = $(this);

      // Set single value
      if (typeof key === 'string' && val) {
        $this.data(key, val);
      }
      else

      // Set multiple
      if (typeof key === 'object' && !val) {
        (function() {
          for (var arg in key) {
            if (key.hasOwnProperty(arg)) {
              $this.data(key, key[arg]);
            }
          }
        })();
      }

      // Return single value
      if (typeof key === 'string' && !val) {
        return $this.data(key);
      }

      // Return all values
      else {
        return $this.data();
      }
    }
  }
})(jQuery);
