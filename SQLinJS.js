/*
 *  SQLinJS
 *  SQL database in Javascript (pre-alpha)
 *
 *  Copyright 2012, Marc S. Brooks (http://mbrooks.info)
 *  Licensed under the MIT license:
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  Dependencies:
 *    jquery.js
 */

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
						_database  : null,
						_query_log : []
					});
				}
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

				runCallback(func);
			});
		},

		"bindEvents" : function(names) {
			return this.each(function() {
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

									index = buffer.length

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
			});
		},

		"executeQuery" : function(str, func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data();

				str = $.trim(str);

				stdOut('\nsql> ' + str);

				data['_sql_query'] = str;

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
						stdErr('Unknown command');
				}

				data['_query_log'].push( logFormat(str) );

				runCallback(func);
			});
		},

		"importDatabase" : function(obj) {
			return this.each(function() {
				if (typeof obj === 'object') {
					for (var key in obj) {
						if ( !obj.hasOwnProperty(key) ) {
							return stdErr("Can't create database '" + key);
						}

						$(this).data('_database', obj);
					}
				}
			});
		},

		"createDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data('_database');

				if (!data) {
					return stdErr('No database selected');
				}

				if ( !validName(name) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( data.hasOwnProperty(name) ) {
					return stdErr("Can't create database '" + name + "'");
				}

				// create an empty database
				data[name] = {};

				stdOut('Query OK, 0 rows affected');

				runCallback(func);
			});
		},

		"createTable" : function(name, defs, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (!data) {
					return stdErr('No database selected');
				}

				if ( !validName(name) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( data.hasOwnProperty(name) ) {
					return stdErr("Table '" + name + "' already exists");
				}

				var cols = [];

				// check supported data types
				for (var type in defs) {
					if ( /^(CHAR|INT)\(\d+\)$/i.test(defs[type]) ) {
						cols.push(type);
					}
				}

				if (cols.length == 0) {
					return stdErr('You have an error in your SQL syntax');
				}

				var timer = calcExecTime(function() {

					// create table properties
					data[name] = {
						_cols : cols,
						_defs : defs,
						_data : []
					};
				});

				stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"deleteFrom" : function(table, conds, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used],
					count = 0;

				if (!used) {
					return stdErr('No database selected');
				}

				if ( !validName(table) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data || !data.hasOwnProperty(table) ) {
					return stdErr("Unknown table '" + table + "'");
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
								return stdErr("Unknown column '" + col + "' in '" + table + "'");
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
										return stdErr('You have an error in your SQL syntax');
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

				stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"describeTable" : function(name, func) {
			return this.each(function() {
				var $this  = $(this),
					used   = $this.data('_active_db'),
					data   = $this.data('_database')[used];

				if (!data) {
					return stdErr('Database not selected');
				}

				if ( !validName(name) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data.hasOwnProperty(name) ) {
					return stdErr("Unknown table '" + name + "'");
				}

				var cols  = ['Field','Type'],
					count = 0;

				var timer = calcExecTime(function() {
					var vals = getObjAsCols(cols, data[name]['_defs']);

					stdTermOut(cols, vals);

					count = vals.length;
				});

				stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"dropDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data('_database');

				if ( !validName(name) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data && !data.hasOwnProperty(name) ) {
					return stdErr("Can't drop database '" + name + "'");
				}

				var timer = calcExecTime(function() {
					delete data[name];
				});

				stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"dropTable" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (!used) {
					return stdErr('No database selected');
				}

				if ( !validName(name) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data || !data.hasOwnProperty(name) ) {
					return stdErr("Can't drop table '" + name + "'");
				}

				var timer = calcExecTime(function() {
					delete data[name];
				});

				stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"insertInto" : function(table, cols, vals, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (!used) {
					return stdErr('No database selected');
				}

				if ( !validName(table) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data || !data.hasOwnProperty(table) ) {
					return stdErr("Unknown table '" + table + "'");
				}

				var timer = calcExecTime(function() {
					var defs = data[table]['_defs'],
						obj  = {};

					// compare columns and values
					if (cols.length != vals.length) {
						return stdErr("Column count doesn't match value count");
					}

					for (var i = 0; i < cols.length; i++) {
						var col = cols[i],
							val = vals[i].replace(/'(.*)'/,'$1');

						if ( !defs.hasOwnProperty(col) ) {
							return stdErr("Unknown column '" + col + "' in '" + table + "'");
						}

						// get character count
						var len = defs[col].replace(/^[a-zA-Z]+\((\d+)\)/,'$1');
						len = (typeof len === 'number') ? len : val.length;

						// truncate value to defined type length
						obj[col] = val.substring(0, len) || undefined;
					}

					if (obj) {

						// insert new record
						data[table]['_data'].push(obj);
					}
				});

				if (timer) {
					stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

					runCallback(func);
				}
			});
		},

		"selectFrom" : function(table, cols, conds, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used],
					vals  = [],
					count = 0;

				if (!used) {
					return stdErr('No database selected');
				}

				if ( !validName(table) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data || !data.hasOwnProperty(table) ) {
					return stdErr("Unknown table '" + table + "'");
				}

				var timer = calcExecTime(function() {
					var names = data[table]['_cols'],
						defs  = data[table]['_defs'],
						rows  = data[table]['_data'];

					// iterate table rows
					for (var i = 0; i < rows.length; i++) {
						var row  = rows[i],
							obj  = {},
							skip = null;

						// return all columns; boolean or wildcard
						if (cols[0] == '1' || cols[0] == '*') {
							cols = data[table]['_cols'];
						}

						// .. columns/values
						for (var j = 0; j < cols.length; j++) {
							var col = cols[j];

							if ( !defs.hasOwnProperty(col) ) {
								return stdErr("Unknown column '" + col + "' in '" + table + "'");
							}

							for (var k = 0; k < names.length; k++) {
								var name = names[k],
									val  = (row[name] !== undefined) ? row[name] : 'NULL';

								if (!conds || skip) {
									if (name == col) continue;
									obj[name] = val;
									continue;
								}

								// test WHERE clause conditional expressions
								for (var m = 0; m < conds.length; m++) {
									var res = testExpr(conds[m], name, val);

									switch (res) {
										case 0:
											skip = true;
											break;
										break;

										case 2:
											return stdErr('You have an error in your SQL syntax');
										break;

										default:
											if (name != col) continue;
											obj[name] = val;
									}
								}
							}
						}

						if (!skip) {
							vals.push(obj);
							count += 1;
						}
					}
				});

				if (timer) {
					if (vals[0]) {
						stdTermOut(cols, vals);
					}

					stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

					runCallback(func);
				}
			});
		},

		"showDatabases" : function(func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data('_database');

				if (!data) {
					return stdErr('No databases exist');
				}

				var cols  = ['Database'];
					count = 0;

				var timer = calcExecTime(function() {
					var vals = getObjKeys(data, cols);

					stdTermOut(cols, vals);

					count = vals.length;
				});

				stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"showTables" : function(func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (!used) {
					return stdErr('No database selected');
				}

				if ( $.isEmptyObject(data) ) {
					return stdErr('No tables used');
				}

				var cols  = ['Tables' + '_in_' + used],
					count = 0;

				var timer = calcExecTime(function() {
					var vals = getObjKeys(data, cols);

					stdTermOut(cols, vals);

					count = vals.length;
				});

				stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

				runCallback(func);
			});
		},

		"updateSet" : function(table, cols, conds, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used],
					count = 0;

				if (!used) {
					return stdErr('No database selected');
				}

				if ( !validName(table) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data || !data.hasOwnProperty(table) ) {
					return stdErr("Unknown table '" + table + "'");
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
								return stdErr("Unknown column '" + col + "' in '" + table + "'");
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
											return stdErr('You have an error in your SQL syntax');
										break;
									}
								}
							}
						}
					}
				});

				if (timer) {
					stdOut(count + ' row' + ((count == 0 || count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

					runCallback(func);
				}
			});
		},

		"useDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data('_database');

				if ( !validName(name) ) {
					return stdErr('You have an error in your SQL syntax');
				}

				if ( !data || !data.hasOwnProperty(name) ) {
					return stdErr("Unknown database '" + name + "'");
				}

				$this.data('_active_db', name);

				stdOut('Database changed');

				runCallback(func);
			});
		},

		"_Create" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				switch (true) {
					case /^CREATE\s+DATABASE/i.test(str):
						var regex = /^CREATE\s+DATABASE\s+(\w+)$/i,
							name  = str.replace(regex,'$1');

						$this.SQLinJS('createDatabase', name);
					break;

					case /^CREATE\s+TABLE/i.test(str):
						try {
							var regex = /^CREATE\s+TABLE\s+(\w+)\s+\((.+)\)$/i,
								parts = str.replace(regex,'$1|$2').split(/\|/),
								name  = parts[0],
								defs  = parts[1].split(/\s*,\s*/);

							var obj  = {};

							// fold column type key/values into an object
							for (var i = 0; i < defs.length; i++) {
								var val = defs[i].split(/\s+/);
								obj[ val[0] ] = val[1];
							}

							$this.SQLinJS('createTable', name, obj);
						}
						catch(err) {
							stdErr('You have an error in your SQL syntax');
						}
					break;

					default:
						stdErr('Unknown command');
				}
			});
		},

		"_Delete" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				try {
					var regex = /^DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))*$/i,
						parts = str.replace(regex,'$1\0$2').split('\0'),
						name  = parts[0],
						conds = parts[1].split(/AND/i);

					$this.SQLinJS('deleteFrom', name, ((conds[0]) ? conds: null));
				}
				catch(err) {
					stdErr('You have an error in your SQL syntax');
				}
			});
		},

		"_Describe" : function() {
			return this.each(function() {
				var $this = $(this)
					str   = $this.data('_sql_query');

				var regex = /^DESCRIBE\s+(\w+)*$/i,
					name  = str.replace(regex,'$1');

				$this.SQLinJS('describeTable', name);
			});
		},

		"_Drop" : function() {
			return this.each(function() {
				var $this = $(this)
					str   = $this.data('_sql_query');

				switch (true) {
					case /^DROP\s+DATABASE/i.test(str):
						var regex = /^DROP\s+DATABASE\s+(\w+)*$/i,
							name  = str.replace(regex,'$1');

						$this.SQLinJS('dropDatabase', name);
					break;

					case /^DROP\s+TABLE/i.test(str):
						var regex = /^DROP\s+TABLE\s+(\w+)*$/i,
							name  = str.replace(regex,'$1');

						$this.SQLinJS('dropTable', name);
					break;

					default:
						stdErr('Unknown command');
				}
			});
		},

		"_Insert" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				try {
					var regex = /^INSERT\s+INTO\s+(.+)\s+\((.+)\)\s+VALUES\s+\((.+)\)$/i,
						parts = str.replace(regex,'$1\0$2\0$3').split('\0'),
						name  = parts[0],
						cols  = parts[1].split(/\s*,\s*/),
						vals  = parts[2].split(/\s*,\s*/);

					$this.SQLinJS('insertInto', name, cols, vals);
				}
				catch(err) {
					stdErr('You have an error in your SQL syntax');
				}
			});
		},

		"_Select" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				try {
					var regex = /^SELECT\s+(.+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*))*$/i,
						parts = str.replace(regex,'$1\0$2\0$3').split('\0'),
						name  = parts[1],
						cols  = parts[0].split(/\s*,\s*/),
						conds = parts[2].split(/AND/i);

					$this.SQLinJS('selectFrom', name, cols, ((conds[0]) ? conds: null));
				}
				catch(err) {
					stdErr('You have an error in your SQL syntax');
				}
			});
		},

		"_Show" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				switch (true) {
					case /^SHOW\s+DATABASES/i.test(str):
						$this.SQLinJS('showDatabases');
					break;

					case /^SHOW\s+TABLES/i.test(str):
						$this.SQLinJS('showTables');
					break;

					default:
						stdErr('Unknown command');
				}
			});
		},

		"_Update" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				try {
					var regex = /^UPDATE\s+(\w+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.*))*$/i,
						parts = str.replace(regex,'$1\0$2\0$3').split('\0'),
						name  = parts[0],
						cols  = parts[1].split(/\s*,\s*/),
						conds = parts[2].split(/AND/i);

					$this.SQLinJS('updateSet', name, cols, ((conds[0]) ? conds: null));
				}
				catch(err) {
					stdErr('You have an error in your SQL syntax');
				}
			});
		},

		"_Use" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				var regex = /^USE\s+(\w+)/i,
					name  = str.replace(regex,'$1');

				$this.SQLinJS('useDatabase', name);
			});
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
		return $.map(obj, function(val, idx) { return idx; }).length;
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

		if (parts.length != 3) return 2;

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
	function stdErr(str) {
		stdOut('ERROR: ' + str);
		return 1;
	}

	/*
	 * Print message to screen; add newline to output
	 */
	function stdOut(str) {
		$('#SQLinJS pre').append( ((str) ? str : '') + '\n');
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
