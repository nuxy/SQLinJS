/*
 *  SQLinJS
 *  Manage Javascript objects using the SQL syntax
 *
 *  Copyright 2012-2013, Marc S. Brooks (http://mbrooks.info)
 *  Licensed under the MIT license:
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  Dependencies:
 *    jquery.js
 */

(function($) {
	var debug = false;     // SQL terminal

	var errors = {
		SYNTAX_ERROR      : 'You have an error in your SQL syntax',
		NO_DB_SELECTED    : 'No database selected',
		NO_DB_EXIST       : 'No databases exist',
		NO_TABLES_USED    : 'No tables used',
		UNKNOWN_COM       : 'Unknown command',
		UNKNOWN_DB        : "Unknown database '%s'",
		UNKNOWN_TABLE     : "Unknown table '%s'",
		UNKNOWN_FIELD     : "Unknown column '%s' in '%s'",
		CANT_CREATE_DB    : "Can't create database %s",
		CANT_DROP_DB      : "Can't drop database '%s'; database doesn't exist",
		CANT_DROP_TABLE   : "Can't drop table '%s'",
		TABLE_EXISTS      : "Table '%s' already exists",
		WRONG_VALUE_COUNT : "Column count doesn't match value count"
	};

	var methods = {
		"init" : function(obj, callback) {
			var $this = $(this),
				data  = $this.data();

			if ( $.isEmptyObject(data) ) {
				$this.data({
					_active_db : null,
					_database  : null,
					_sql_query : null,
					_callback  : null,
					_query_log : [],
				});

				if (typeof obj === 'object') {
					$this.SQLinJS('importDatabase', obj, callback);
				}
			}
		},

		"destroy" : function() {
			$(this).removeData();
		},

		"initTerminal" : function(callback) {
			var $this = $(this);

			debug = true;

			var screen = $('<pre></pre>');
			var input  = $('<textarea></textarea>');

			var terminal
				= $('<div></div>')
					.attr('id','SQLinJS')
					.append(screen, input);

			$this.append(terminal);

			$this.SQLinJS('bindEvents', ['screen','input']);

			input.focus();

			stdOut('Welcome to SQLinJS monitor. Command ends with ; or \\g.');
			stdOut();
			stdOut("Type 'help;' or '\\h' for help.");

			runCallback(callback);
		},

		"bindEvents" : function(names) {
			var $this = $(this);

			var terminal = $('#SQLinJS'),
				screen   = terminal.find('pre'),
				input    = terminal.find('textarea');

			for (var i = 0; i < names.length; i++) {
				switch (names[i]) {
					case 'screen':
						terminal
							.on('click', function() { input.focus() });
					break;

					case 'input':
						var buffer = $this.data('_query_log'),
							index  = 0;

						input
							.on('keypress', function(event) {
								if (event.which != 13) return;

								event.preventDefault();

								// execute SQL queries seperated by semicolon
								var str = $(this).val();

								var queries =
									$.grep(str.split(/;|\\g/), function(bucket) {
										if (! /^(\s+|\\g+|;)*$/.test(bucket) ) {
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

								index = buffer.length;

								// force scroll positioning
								screen.scrollTop( screen.prop('scrollHeight') );
							})
							.on('keyup', function(event) {
								var count = buffer.length;

								// scroll command buffer
								switch (event.which) {
									case 38:

										// .. view last command
										index = (index > 0)
											? index -= 1
											: 0;
									break;

									case 40:

										// .. view next command
										index = ( (index + 1) < count)
											? index += 1
											: index;
									break;

									default: return;
								}

								if (count) {
									$(this).val(buffer[index].query);
								}
							});
					break;
				}
			}
		},

		"executeQuery" : function(str, callback) {
			var $this = $(this),
				data  = $this.data();

			str = $.trim(str);

			stdOut('\nsql> ' + str);

			// .. save request state
			data['_query_log'].push( logFormat(str) );
			data['_sql_query'] = str;
			data['_callback']  = callback;

			switch (true) {
				case /^CREATE/i.test(str):
					$this.SQLinJS('_Create');
				break;

				case /^DELETE/i.test(str):
					$this.SQLinJS('_Delete');
				break;

				case /^DESCRIBE/i.test(str):
					$this.SQLinJS('_Describe');
				break;

				case /^DROP/i.test(str):
					$this.SQLinJS('_Drop');
				break;

				case /^INSERT/i.test(str):
					$this.SQLinJS('_Insert');
				break;

				case /^SELECT/i.test(str):
					$this.SQLinJS('_Select');
				break;

				case /^SHOW/i.test(str):
					$this.SQLinJS('_Show');
				break;

				case /^UPDATE/i.test(str):
					$this.SQLinJS('_Update');
				break;

				case /^USE/i.test(str):
					$this.SQLinJS('_Use');
				break;

				case /^help|\\h/i.test(str):
					viewHelp();
				break;

				default:
					stdErr('UNKNOWN_COM', callback);
			}
		},

		"importDatabase" : function(obj, callback) {
			if (typeof obj === 'object') {
				for (var key in obj) {
					if ( !obj.hasOwnProperty(key) ) {
						return stdErr('CANT_CREATE_DB', key, callback);
					}

					$(this).data('_database', obj);

					runCallback(callback, true);
				}
			}
		},

		"createDatabase" : function(name, callback) {
			var $this = $(this),
				data  = $this.data('_database');

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(name) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( data.hasOwnProperty(name) ) {
				return stdErr('CANT_CREATE_DB', name, callback);
			}

			// create an empty database
			data[name] = {};

			stdStatOut();

			runCallback(callback, true);
		},

		"createTable" : function(name, defs, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used];

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(name) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( data.hasOwnProperty(name) ) {
				return stdErr('TABLE_EXISTS', name, callback);
			}

			var cols = [];

			// check supported data types
			for (var type in defs) {
				if ( /^((VAR)*CHAR|INT)(\(\d+\))*$/i.test(defs[type]) ) {
					cols.push(type);
				}
			}

			if (cols.length == 0) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			var timer = calcExecTime(function() {

				// create table properties
				data[name] = {
					_cols : cols,
					_defs : defs,
					_data : []
				};
			});

			stdStatOut(0, timer);

			runCallback(callback, true);
		},

		"deleteFrom" : function(table, conds, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used],
				count = 0;

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(table) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data || !data.hasOwnProperty(table) ) {
				return stdErr('UNKNOWN_TABLE', table, callback);
			}

			var timer = calcExecTime(function() {
				var cols = data[table]['_cols'],
					defs = data[table]['_defs'],
					rows = data[table]['_data'];

				if (!conds) {

					// delete all records
					data = [];
					count = rows.length;
					return;
				}

				// iterate table rows
				for (var i = 0; i < rows.length; i++) {
					var row  = rows[i],
						skip = null,
						del  = null;

					if (row === undefined) continue;

					// .. columns/values
					for (var j = 0; j < cols.length; j++) {
						var col = cols[j],
							val = (row[col] !== undefined) ? row[col] : 'NULL';

						if ( !defs.hasOwnProperty(col) ) {
							return stdErr('UNKNOWN_FIELD', table, col, callback);
						}

						if (skip) continue;

						// delete record based on conditional expressions
						for (var k = 0; k < conds.length; k++) {
							var res = testExpr(conds[k], col, val);

							switch (res) {
								case 0:
									skip = true;
									break;
								break;

								case 1:
									del = true;
								break;

								case 2:
									return stdErr('SYNTAX_ERROR', callback);
								break;
							}
						}
					}

					if (del && !skip) {
						rows.splice(i, 1);
						count += 1;
					}
				}

				// remove 'undefined' buckets from array
				data[table]['_data'] = reindexArray(rows);
			});

			stdStatOut(count, timer);

			runCallback(callback, true);
		},

		"describeTable" : function(name, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used];

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(name) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data.hasOwnProperty(name) ) {
				return stdErr('UNKNOWN_TABLE', name, callback);
			}

			var cols  = ['Field','Type'],
				count = 0;

			var timer = calcExecTime(function() {
				var vals = getObjAsCols(cols, data[name]['_defs']);

				stdTermOut(cols, vals);

				count = vals.length;
			});

			stdStatOut(count, timer);

			runCallback(callback);
		},

		"dropDatabase" : function(name, callback) {
			var $this = $(this),
				data  = $this.data('_database');

			if ( !validName(name) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data && !data.hasOwnProperty(name) ) {
				return stdErr('CANT_DROP_DB', name, callback);
			}

			var timer = calcExecTime(function() {
				delete data[name];
			});

			stdStatOut(0, timer);

			runCallback(callback, true);
		},

		"dropTable" : function(name, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used];

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(name) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data || !data.hasOwnProperty(name) ) {
				return stdErr('CANT_DROP_TABLE', name, callback);
			}

			var timer = calcExecTime(function() {
				delete data[name];
			});

			stdStatOut(0, timer);

			runCallback(callback, true);
		},

		"insertInto" : function(table, vals, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used];

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(table) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data || !data.hasOwnProperty(table) ) {
				return stdErr('UNKNOWN_TABLE', table, callback);
			}

			var timer = calcExecTime(function() {
				var defs = data[table]['_defs'],
					obj  = {};

				for (var col in vals) {
					var val = vals[col].replace(/'(.*)'/,'$1');

					if ( !defs.hasOwnProperty(col) ) {
						return stdErr('UNKNOWN_FIELD', table, col, callback);
					}

					// process values based on data type definition
					var type = defs[col].replace(/^([a-zA-Z]+)(?:\((\d+)\))*$/,'$1\0$2').split('\0'),
						name = type[0],
						size = (typeof type[1] === 'number') ? type[1] : val.length;

					switch (true) {
						case /((VAR)*CHAR)/i.test(name):

							// truncate value to defined type length
							obj[col] = val.substring(0, size) || undefined;
						break;

						case /INT/i.test(name):
							obj[col] = parseInt(val);
						break;
					}
				}

				if (obj) {

					// insert new record
					data[table]['_data'].push(obj);
				}
			});

			if (timer) {
				stdStatOut(0, timer);

				runCallback(callback, true);
			}
		},

		"selectFrom" : function(table, cols, clause, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used],
				res   = [];

			if (typeof clause === 'function') {
				callback = clause;
			}

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(table) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data || !data.hasOwnProperty(table) ) {
				return stdErr('UNKNOWN_TABLE', table, callback);
			}

			var timer = calcExecTime(function() {
				res = $this.SQLinJS('_QueryDB', data, table, cols, clause, callback);
			});

			if (timer) {
				if (res[0]) {
					stdTermOut(res[0], res[1]);
				}

				stdStatOut(res[1].length, timer);

				runCallback(callback, res[1]);
			}
		},

		"showDatabases" : function(callback) {
			var $this = $(this),
				data  = $this.data('_database');

			if (!data) {
				return stdErr('NO_DB_EXISTS', callback);
			}

			var cols  = ['Database'];
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

		"showTables" : function(callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used];

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( $.isEmptyObject(data) ) {
				return stdErr('NO_TABLES_USED', callback);
			}

			var cols  = ['Tables' + '_in_' + used],
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

		"updateSet" : function(table, cols, conds, callback) {
			var $this = $(this),
				used  = $this.data('_active_db'),
				data  = $this.data('_database')[used],
				count = 0;

			if (typeof conds === 'function') {
				callback = conds;
			}

			if (!data) {
				return stdErr('NO_DB_SELECTED', callback);
			}

			if ( !validName(table) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data || !data.hasOwnProperty(table) ) {
				return stdErr('UNKNOWN_TABLE', table, callback);
			}

			var timer = calcExecTime(function() {
				var names = data[table]['_cols'],
					defs  = data[table]['_defs'],
					rows  = data[table]['_data'];

				// iterate table rows
				for (var i = 0; i < rows.length; i++) {
					var row  = rows[i],
						skip = null;

					// .. columns/values
					for (var j = 0; j < cols.length; j++) {
						var parts = cols[j].replace(/^(\w+)\s*=\s*(.+)$/,'$1\0$2').split('\0'),
							col   = parts[0],
							val   = parts[1];

						if ( !defs.hasOwnProperty(col) ) {
							return stdErr('UNKNOWN_FIELD', table, col, callback);
						}

						for (var k = 0; k < names.length; k++) {
							var name = names[k];

							// test WHERE clause conditional expressions
							for (var m = 0; m < conds.length; m++) {
								var res = testExpr(conds[m], name, row[name]);

								switch (res) {
									case 0:
										skip = true;
										break;
									break;

									case 1:
										row[name] = val;
										count += 1;
									break;

									case 2:
										return stdErr('SYNTAX_ERROR', callback);
									break;
								}
							}
						}
					}
				}
			});

			if (timer) {
				stdStatOut(count, timer);

				runCallback(callback, true);
			}
		},

		"useDatabase" : function(name, callback) {
			var $this = $(this),
				data  = $this.data('_database');

			if ( !validName(name) ) {
				return stdErr('SYNTAX_ERROR', callback);
			}

			if ( !data || !data.hasOwnProperty(name) ) {
				return stdErr('UNKNOWN_DB', name, callback);
			}

			$this.data('_active_db', name);

			stdOut('Database changed');

			runCallback(callback, true);
		},

		"_Create" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			switch (true) {
				case /^CREATE\s+DATABASE/i.test(sql_query):
					try {
						var regex = /^CREATE\s+DATABASE\s+(\w+)$/i,
							name  = sql_query.replace(regex,'$1');

						$this.SQLinJS('createDatabase', name, callback);
					}
					catch(err) {
						stdErr('SYNTAX_ERROR', callback);
					}
				break;

				case /^CREATE\s+TABLE/i.test(sql_query):
					try {
						var regex = /^CREATE\s+TABLE\s+(\w+)\s+\((.+)\)$/i,
							parts = sql_query.replace(regex,'$1|$2').split(/\|/),
							name  = parts[0],
							defs  = parts[1].split(/\s*,\s*/);

						var obj  = {};

						// fold column type key/values into an object
						for (var i = 0; i < defs.length; i++) {
							var val = defs[i].split(/\s+/);
							obj[ val[0] ] = val[1];
						}

						$this.SQLinJS('createTable', name, obj, callback);
					}
					catch(err) {
						stdErr('SYNTAX_ERROR', callback);
					}
				break;

				default:
					stdErr('UNKNOWN_COM', callback);
			}
		},

		"_Delete" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			try {
				var regex = /^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))*$/i,
					parts = sql_query.replace(regex,'$1\0$2').split('\0'),
					table = parts[0],
					conds = parts[1].split(/AND/i);

				$this.SQLinJS('deleteFrom', table, ((conds[0]) ? conds: null), callback);
			}
			catch(err) {
				stdErr('SYNTAX_ERROR', callback);
			}
		},

		"_Describe" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			var regex = /^DESCRIBE\s+(\w+)*$/i,
				table = sql_query.replace(regex,'$1');

			$this.SQLinJS('describeTable', table, callback);
		},

		"_Drop" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			switch (true) {
				case /^DROP\s+DATABASE/i.test(sql_query):
					var regex = /^DROP\s+DATABASE\s+(\w+)*$/i,
						name  = sql_query.replace(regex,'$1');

					$this.SQLinJS('dropDatabase', name, callback);
				break;

				case /^DROP\s+TABLE/i.test(sql_query):
					var regex = /^DROP\s+TABLE\s+(\w+)*$/i,
						name  = sql_query.replace(regex,'$1');

					$this.SQLinJS('dropTable', name, callback);
				break;

				default:
					stdErr('UNKNOWN_COM', callback);
			}
		},

		"_Insert" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback'),
				used      = $this.data('_active_db'),
				data      = $this.data('_database')[used];

			try {
				var regex = /^INSERT\s+INTO\s+(.+?)\s+(?:\((.+)\)\s+)*VALUES\s+\((.+)\)$/i,
					parts = sql_query.replace(regex,'$1\0$2\0$3').split('\0'),
					table = parts[0],
					cols  = parts[1].split(/\s*,\s*/),
					vals  = parts[2].split(/\s*,\s*/);

				if (!cols[0]) {
					cols = data[table]['_cols'];
				}

				if (cols.length != vals.length) {
					return stdErr('WRONG_VALUE_COUNT', callback);
				}

				$this.SQLinJS('insertInto', table, getValsAsObj(cols, vals), callback);
			}
			catch(err) {
				stdErr('SYNTAX_ERROR', callback);
			}
		},

		"_Select" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			try {
				var regex = /^SELECT\s+(.+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))*(?:(?:\s+ORDER\s+BY\s+(\w+))*(?:\s+(ASC|DESC)*)*(?:\s+LIMIT\s+(\d+))*)*$/i,
					parts = sql_query.replace(regex,'$1\0$2\0$3\0$4\0$5\0$6').split('\0'),
					table = parts[1],
					cols  = parts[0].split(/\s*,\s*/),
					conds = parts[2].split(/AND/i);

				$this.SQLinJS('selectFrom', table, cols, {
					conds    : ((conds[0]) ? conds : undefined),
					order_by : parts[3],
					sort     : parts[4],
					limit    : parts[5]
				}, callback);
			}
			catch(err) {
				stdErr('SYNTAX_ERROR', callback);
			}
		},

		"_Show" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			switch (true) {
				case /^SHOW\s+DATABASES/i.test(sql_query):
					$this.SQLinJS('showDatabases', callback);
				break;

				case /^SHOW\s+TABLES/i.test(sql_query):
					$this.SQLinJS('showTables', callback);
				break;

				default:
					stdErr('UNKNOWN_COM', callback);
			}
		},

		"_Update" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			try {
				var regex = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.*))*$/i,
					parts = sql_query.replace(regex,'$1\0$2\0$3').split('\0'),
					table = parts[0],
					cols  = parts[1].split(/\s*,\s*/),
					conds = parts[2].split(/AND/i);

				$this.SQLinJS('updateSet', table, cols, ((conds[0]) ? conds: null), callback);
			}
			catch(err) {
				stdErr('SYNTAX_ERROR', callback);
			}
		},

		"_Use" : function() {
			var $this = $(this),
				sql_query = $this.data('_sql_query'),
				callback  = $this.data('_callback');

			var regex = /^USE\s+(\w+)/i,
				name  = sql_query.replace(regex,'$1');

			$this.SQLinJS('useDatabase', name, callback);
		},

		"_QueryDB" : function(data, table, cols, clause, callback) {
			var $this = $(this),
				names = data[table]['_cols'],
				defs  = data[table]['_defs'],
				rows  = data[table]['_data'],
				vals  = [];

			// iterate table rows
			for (var i = 0; i < rows.length; i++) {
				var count = 1,
					row   = rows[i],
					obj   = {},
					skip  = null

				// return all columns; boolean or wildcard
				if (cols[0] == '1' || cols[0] == '*') {
					cols = data[table]['_cols'];
				}

				// .. columns/values
				for (var j = 0; j < cols.length; j++) {
					var col = cols[j];

					if ( !defs.hasOwnProperty(col) ) {
						return stdErr('UNKNOWN_FIELD', table, col, callback);
					}

					for (var k = 0; k < names.length; k++) {
						var name = names[k],
							val  = (row[name] !== undefined) ? row[name] : 'NULL';

						if (!clause.conds || skip) {
							if (name != col) continue;
							obj[name] = val;
							continue;
						}

						// test WHERE clause conditional expressions
						for (var m = 0; m < clause.conds.length; m++) {
							var res = testExpr(clause.conds[m], name, val);

							switch (res) {
								case 0:
									skip = true;
									break;
								break;

								case 2:
									return stdErr('SYNTAX_ERROR', callback);
								break;

								default:
									if (name != col) continue;
									obj[name] = val;
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

			// sort results array of objects, by key (column name)
			if (clause.order_by && clause.sort == 'desc') {
				vals.sort(function(a, b) {
					return (a[clause.order_by] < b[clause.order_by]) ? 1 : ((b[clause.order_by] < a[clause.order_by]) ? -1 : 0);
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

	/*
	 * Return true if in valid format - [a-zA-Z0-9_]
	 */
	function validName(str) {
		if (!str) return false;
		return /^\w+$/g.test(str);
	}

	/*
	 * Return true if an integer
	 */
	function validNum(val) {
		if (parseInt(val) == val) return true;
	}

	/*
	 * Return array values (folded) as an object
	 */
	function getValsAsObj(names, vals) {
		var obj = {};
		for (var i = 0; i < names.length; i++) {
			obj[ names[i] ] = vals[i];
		}
		return obj;
	}

	/*
	 * Return key/values as array of object(s)
	 */
	function getObjAsCols(names, obj) {
		var vals = [];
		for (var key in obj) {
			if ( !obj.hasOwnProperty(key) ) continue;

			var new_obj = {};
			for (var i = 0; i < names.length; i++) {
				new_obj[ names[i] ] = (i == 0) ? key : obj[key];
			}
			vals.push(new_obj);
		}
		return vals;
	}

	/*
	 * Return key names (1st child) as array of objects
	 */
	function getObjKeys(data, name) {
		var vals = [];
		for (var key in data) {
			if ( !data.hasOwnProperty(key) ) continue;

			var new_obj = {};
			new_obj[name] = key;
			vals.push(new_obj);
		}
		return vals;
	}

	/*
	 * Returns object key total count
	 */
	function getObjSize(obj) {
		return $.map(obj, function(val, index) { return index; }).length;
	}

	/*
	 * Remove 'undefined' buckets from an array
	 */
	function reindexArray(arr) {
		var new_arr = [];
		for (var index in arr) {
			if (arr[index] === undefined) continue;

			new_arr.push(arr[index]);
		}
		return new_arr;
	}

	/*
	 * Calculate execution time of a function (not precise, but simple)
	 */
	function calcExecTime(func) {
		try {
			if (typeof func === 'function') {
				var start = new Date().getMilliseconds();
				var error = func();
				if (error) return 0;
				var stop  = new Date().getMilliseconds();
				return ((stop - start) / 100).toFixed(2);
			}
		}
		catch(err) {
			throwError(err);
		}
	}

	/*
	 * Return values based on expression result
	 *
	 *  0 - Expression result is false
	 *  1 - Expression result is true
	 *  2 - Invalid condition/expression
	 */
	function testExpr(str, col1, val1) {
		var regex = /^\s*(\w+)\s*([!=<>]+)\s*(.*)\s*$/i,
			parts = str.replace(regex,'$1\0$2\0$3').split('\0');

		if (parts.length != 3 || !parts[2]) return 2;

		var col2 = parts[0],
			op   = parts[1],
			val2 = parts[2];

		if (col1 != col2) return;

		// test expression by type
		if (! /([!=]+|<>)/.test(op) && validNum(val1) && validNum(val2) ) {
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

			// .. string comparison
			switch (op) {
				case '=':
					if (str1 == str2) return 1;
				break;

				case '!=':
					if (str1 != str2) return 1;
				break;

				case '<>':
					if (str1 != str2) return 1;
				break;
			}
		}

		return 0;
	}

	/*
	 * Return 'query_log' entry as an object
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
	 * Clear all messages in screen
	 */
	function clearTerminal() {
		$('#SQLinJS pre').empty();
	}

	/*
	 * Print error message to screen
	 */
	function stdErr() {
		var args = arguments;
			code = args[0],
			func = args[args.length -1];

		if ( !errors.hasOwnProperty(code) ) return;

		if (debug) {
			var str = errors[code];

			for (var i = 1; i < args.length; i++) {
				str = str.replace(/\%s/i, args[i]);
			}

			stdOut('ERROR: ' + str);
			return 1;
		}

		if (typeof func === 'function') {
			runCallback(func, code);
		}
	}

	/*
	 * Print message to screen; add newline to output
	 */
	function stdOut(str) {
		if (!debug) return;

		$('#SQLinJS pre').append( ((str) ? str : '') + '\n');
	}

	/*
	 * Print query response message to screen
	 */
	function stdStatOut(count, timer) {
		if (!debug) return;

		if (arguments.length > 1) {
			stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');
		}
		else {
			stdOut('Query OK, 0 rows affected' + ((timer) ? ' &#40;' + timer + ' sec&#41;' : ''));
		}
	}

	/*
	 * Print tablular format message to screen
	 *
	 * Example:
	 *     stdTermOut(
	 *         ['col1','col2','col3'],[
	 *             { col1 : 'value1', col2 : 'value2', col3 : 'value3' },
	 *             { col1 : 'value1', col2 : 'value2', col3 : 'value3' },
	 *             { col1 : 'value1', col2 : 'value2', col3 : 'value3' }
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
				var rows = data[j],
					len  = String(rows[name]).length;

				if (len > sizes[name]) {
					sizes[name] = len;
				}
			}

			count += sizes[name] + 3;
		}

		cols = $.map(cols, function(val) {
			return padStrRgt(String(val), sizes[val]);
		});

		genTermHeader(count, cols);

		for (var k = 0; k < data.length; k++) {
			var rows = data[k],
				arr  = [];

			for (var key in rows) {
				arr.push( padStrRgt(String(rows[key]), sizes[key]) );
			}

			genTermRow(sizes[key], arr);
		}

		genTermRow(count);
	}

	/*
	 * Print tablular format header to screen
	 */
	function genTermHeader(len, cols) {
		genTermRow(len);
		genTermRow(len, cols);
		genTermRow(len);
	}

	/*
	 * Print tablular format row to screen
	 */
	function genTermRow(len, cols) {
		var temp = new Array(len);

		stdOut(
			(cols)
				? '| ' + cols.join(' | ') + ' |'
				: '+'  + temp.join('-')   + '+'
		);
	}

	/*
	 * Append white space to the right side of a string
	 */
	function padStrRgt(str, len) {
		return str + (new Array(len).join(' ')).slice(0, len - str.length);
	}

	/*
	 * Run callback function; die on errors
	 */
	function runCallback(func, data) {
		try {
			if (typeof func === 'function') {
				func(data);
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
