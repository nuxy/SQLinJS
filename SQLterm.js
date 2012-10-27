/*
 *  SQLterm
 *  SQL terminal simulator in Javascript (proof of concept)
 *
 *  Copyright 2012, Marc S. Brooks (http://mbrooks.info)
 *  Licensed under the MIT license:
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  Dependencies:
 *    jquery.js
 */

var _database = {
	accounts : {
		profile : {
			_cols : ['id','user_id','active'],
			_defs : {
				id : 'int(10)', user_id : 'int(10)', active : 'int(10)'
			},
			_data : [
				{ id : 1, user_id : 1, active : 1 },
				{ id : 2, user_id : 2, active : 0 },
				{ id : 3, user_id : 3, active : 0 },
				{ id : 4, user_id : 4, active : 0 }
			]
		},
		user : {
			_cols : ['id','name'],
			_defs : {
				id : 'int(10)', name : 'char(10)'
			},
			_data : [
				{ id : 1, name : 'Jack' },
				{ id : 2, name : 'Johnathan' },
				{ id : 3, name : 'Mark' },
				{ id : 4, name : 'Mary' }
			]
		}
	}
};

(function($) {
	var methods = {
		"init" : function() {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data();

				if ( $.isEmptyObject(data) ) {
					$this.data({
						_active_db : null,
						_sql_query : null,
						_database  : _database,
						_query_log : []
					});

					$this.SQLterm('initTerminal');
				}

				clearTerminal();

				stdOut("Welcome to SQLterm monitor.  Type 'help' for supported commands");
			});
		},

		"destroy" : function() {
			return this.each(function() {
				$(this).removeData();
			});
		},

		"initTerminal" : function(func) {
			return this.each(function() {
				var $this = $(this);

				var input
					= $('<textarea></textarea>')
						.on('keypress', function(event) {
							if (event.which != 13) return;

							event.preventDefault();

							var str = $(this).val();
							$(this).val(null);

							$this.SQLterm('executeQuery', str);
							$this.focus();
						});

				var console
					= $('<pre></pre>')
						.on('click', function(event) {
							input.focus();
						});

				var terminal
					= $('<div></div>')
						.attr('id','SQLterm')
						.append(console, input);

				$this.append(terminal);

				input.focus();

				runCallback(func);
			});
		},

		"executeQuery" : function(str, func) {
			return this.each(function() {
				var $this = $(this);

				str = $.trim(str);

				stdOut('\nsqlterm> ' + str);

				$this.data('_sql_query', str);

				switch (true) {
					case /^CREATE/i.test(str):
						$this.SQLterm('_Create');
					break;

					case /^DELETE/i.test(str):
						$this.SQLterm('_Delete');
					break;

					case /^DESCRIBE/i.test(str):
						$this.SQLterm('_Describe');
					break;

					case /^DROP/i.test(str):
						$this.SQLterm('_Drop');
					break;

					case /^INSERT/i.test(str):
						$this.SQLterm('_Insert');
					break;

					case /^SELECT/i.test(str):
						$this.SQLterm('_Select');
					break;

					case /^SHOW/i.test(str):
						$this.SQLterm('_Show');
					break;

					case /^USE/i.test(str):
						$this.SQLterm('_Use');
					break;

					case /^help/i.test(str):
						viewHelp();
					break;

					default:
						stdErr('Unknown command');
					break;
				}

				$this.data('_query_log').push( logFormat(str) );

				runCallback(func);
			});
		},

		"createDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('_database');

				if (validName(name) && !data[name]) {

					// create an empty database
					$this.data('_database')[name] = {
						_cols : [],
						_defs : {},
						_data : []
					};

					stdOut('Query OK, 0 rows effected');

					runCallback(func);
				}
				else {
					stdErr("Can't create database '" + name + "'");
				}
			});
		},

		"createTable" : function(name, defs, func) {
			return this.each(function() {
				var $this = $(this),
					used = $this.data('_active_db'),
					data = $this.data('_database')[used];
					
				if (validName(name) && !data[name]) {

					// TODO

					runCallback(func);
				}
			});
		},

		"describeTable" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					used = $this.data('_active_db'),
					data = $this.data('_database')[used];

				if (data[name]) {

					// TODO

					runCallback(func);
				}
			});
		},

		"dropDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('_database');

				if (data[name]) {
					delete data[name];

					stdOut('Query OK, 0 rows effected');

					runCallback(func);
				}
				else {
					stdErr("Can't drop database '" + name + "'");
				}
			});
		},

		"dropTable" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (used) {
					if (data[name]) {
						delete data[name];
					}
					else {
						stdErr("Can't drop table '" + name + "'");
					}
				}
				else {
					stdErr('No database selected ');
				}
			});
		},

		"showDatabases" : function(func) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('_database');

				// TODO

				if (!$.isEmptyObject(data) ) {
					stdTermOut($.makeArray(data), 'Databases');
				}

				stdOut('Query OK, 0 rows effected');

				runCallback(func);
			});
		},

		"showTables" : function(func) {
			return this.each(function() {
				var $this = $(this),
					used = $this.data('_active_db'),
					data = $this.data('_database')[used];

				// TODO

				if (used) {
					for (var key in data) {
						if (data[key]) {
							stdTermOut(key, 'Tables');

							stdOut('Query OK, 0 rows effected');

							runCallback(func);
						}
						else {
							stdErr('No tables used');
						}
					}
				}
				else {
					stdErr('No database selected ');
				}
			});
		},

		"useDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data = $this.data('_database');

				if (data[name]) {
					$this.data('_active_db', name);

					stdOut('Database changed');

					runCallback(func);
				}
				else {
					stdErr("Unknown database '" + name + "'");
				}
			});
		},

		"_Create" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				var elms = parseQuery(str),
					type = elms[1],
					name = elms[2],
					defs = elms[3];

				switch (true) {
					case /DATABASE/i.test(type):
						$this.SQLterm('createDatabase', name);
					break;

					case /TABLE/i.test(type):
						$this.SQLterm('createTable', name, defs);
					break;

					default:
						stdErr('Unknown command');
					break;
				}
			});
		},

		"_Delete" : function() {
			return this.each(function() {
				var $this = $(this)
					str   = $this.data('_sql_query');

				// TODO
			});
		},

		"_Describe" : function() {
			return this.each(function() {
				var $this = $(this)
					str   = $this.data('_sql_query');

				var elms = parseQuery(str),
					name = elms[1];

				$this.SQLterm('describeTable', name);
			});
		},

		"_Drop" : function() {
			return this.each(function() {
				var $this = $(this)
					str   = $this.data('_sql_query');

				var elms = parseQuery(str),
					type = elms[1],
					name = elms[2];

				switch (true) {
					case /DATABASE/i.test(type):
						$this.SQLterm('dropDatabase', name);
					break;

					case /TABLE/i.test(type):
						$this.SQLterm('dropTable', name);
					break;

					default:
						stdErr('Unknown command');
					break;
				}
			});
		},

		"_Insert" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				// TODO
			});
		},

		"_Select" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				// TODO
			});
		},

		"_Show" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				var name = parseQuery(str)[1];

				switch (true) {
					case /DATABASES/i.test(name):
						$this.SQLterm('showDatabases');
					break;

					case /LOGS/i.test(name):
						$this.SQLterm('showLogs');
					break;

					case /TABLES/i.test(name):
						$this.SQLterm('showTables');
					break;

					default:
						stdErr('Unknown command');
					break;
				}
			});
		},

		"_Use" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				$this.SQLterm('useDatabase', parseQuery(str)[1]);
			});
		}
	};

	$.fn.SQLterm = function(method) {
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		}
		else
		if (typeof method === 'object' || !method) {
			return methods.init.apply(this, arguments);
		}
		else {
			$.error('Method ' +  method + ' does not exist in SQLterm');
		}
	};

	/*
	 * Return true if in valid format - [a-zA-Z0-9_]
	 */
	function validName(str) {
		if (!str) return false;
		return /^\w+$/g.test(str);
	}

	/*
	 * Return SQL statement elements as array/object literal
	 */
	function parseQuery(str) {
		if (!str) return false;

		var elms = str.split(/\s+/);

		switch (true) {
			case /^CREATE TABLE/i.test(str):
				elms.splice(3, elms.length - 3);

				// return ['CREATE','TABLE','example', { id : 'int(10)', name : 'char(10)' }]

				var arr = str.replace(/^[\w\s]+\((.*)\)$/m,'$1').split(/\s*,\s*/),
					obj = {};

				for (var i = 0; i < arr.length; i++) {
					var val = arr[i].split(/\s+/);
					obj[ val[0] ] = val[1];
				}

				elms[3] = obj;
			break;
		}

		return elms;
	}

	/*
	 * Return 'query_log' entry in JSON format
	 */
	function logFormat(str) {
		return { query : str, time : new Date().getTime() };
	}

	/*
	 * Return help menu as a string
	 */
	function viewHelp() {
		stdErr('Help menu is not available');
	}

	/*
	 * Clear all messages in console
	 */
	function clearTerminal() {
		$('#SQLterm pre').empty();
	}

	/*
	 * Print error message to console
	 */
	function stdErr(str) {
		stdOut('Error: ' + str);
	}

	/*
	 * Print message to console; add newline to output
	 */
	function stdOut(str) {
		$('#SQLterm pre').append( ((str) ? str : '') + '\n');
	}

	/*
	 * Print tablular format message to console
	 */
	function stdTermOut(data, title) {
		var size  = title.length,
			vals = [];

		for (var i = 0; i < data.length; i++) {
			for (var key in data[i]) {
				if ( /^_/.test(key) ) continue;

				var len = data[i][key].length;
				if (size < len) {
					size = len;
				}

				vals.push(data[i][key]);
			}
		}

		if (vals.length > 0) {
			genTermHeader(size, title);

			for (var j = 0; j < vals.length; j++) {
				if (typeof vals[j] == 'object') {
					for (var key in vals[j]) {
						genTermRow(size - vals[j][key].length, vals[j][key]);
					}
				}
				else
				if (typeof vals[j] == 'string') {
					genTermRow(size - vals[j].length, vals[j]);
				}
			}

			genTermRow(size);
		}
	}

	/*
	 * Print tablular format header to console
	 */
	function genTermHeader(size, title) {
		genTermRow(size);
		genTermRow(size - title.length, title);
		genTermRow(size);
	}

	/*
	 * Print tablular format row to console
	 */
	function genTermRow(size, value) {
		stdOut(
			(value)
				? '+' + value + (new Array(size + 2).join(' ')) + '+'
				: '+' +         (new Array(size + 3).join('-')) + '+'
		);
	}

	/*
	 * Run callback function; die on errors
	 */
	function runCallback(func) {
		try {
			if (typeof func === 'function') {
				func(true);
			}
		}
		catch(err) {
			throwError(err);
		}
	}
	
	/*
	 * Output errors including caller object
	 */
	function throwError(str) {
		throw new Error(
			'\nCaller: \t' + (throwError.caller.name || '-') +
			'\nError:\t'   + str
		);
	}
})(jQuery);
