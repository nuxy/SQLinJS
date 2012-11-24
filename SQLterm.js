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

					$this.SQLterm('initTerminal');
				}

				clearTerminal();

				stdOut('Welcome to SQLterm monitor. Command ends with ; or \\g.');
				stdOut();
				stdOut("Type 'help;' or '\\h' for help.");
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
						.attr('id','SQLterm')
						.append(screen, input);

				$this.append(terminal);

				$this.SQLterm('bindEvents', ['screen','input']);

				input.focus();

				runCallback(func);
			});
		},

		"bindEvents" : function(names) {
			return this.each(function() {
				var $this = $(this);

				var terminal = $('#SQLterm'),
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
											if (! /^(?:\s+|\\g+|;|)$/.test(bucket) ) {
												return bucket;
											}
										});

									var count = queries.length;
									if (count > 0) {
										for (var i = 0; i < count; i++) {
											$this.SQLterm('executeQuery', queries[i]);
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

										default:
											return;
										break;
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

					case /^help|\\h/i.test(str):
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

		"importDatabase" : function(obj) {
			return this.each(function() {
				if (typeof obj === 'object') {
					for (var key in obj) {
						if ( obj.hasOwnProperty(key) ) {
							$(this).data('_database', obj);
						}
						else {
							stdErr("Can't create database '" + key);
						}
					}
				}
			});
		},

		"createDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data('_database');

				if (!data) {
					stdErr('No database selected');
				}
				else
				if ( !validName(name) ) {
					stdErr('You have an error in your SQL syntax');
				}
				else
				if ( !data.hasOwnProperty(name) ) {

					// create an empty database
					$this.data('_database')[name] = {};

					stdOut('Query OK, 0 rows affected');

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
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (!data) {
					stdErr('No database selected');
				}
				else
				if ( !validName(name) ) {
					stdErr('You have an error in your SQL syntax');
				}
				else
				if ( !data.hasOwnProperty(name) ) {
					var cols = [];

					// check supported data types
					for (var type in defs) {
						if ( /^(?:CHAR|INT)\(\d+\)$/i.test(defs[type]) ) {
							cols.push(type);
						}
					}
					if (cols.length > 0) {
						var timer = calcExecTime(function() {

							// create table properties
							$this.data('_database')[used][name] = {
								_cols : cols,
								_defs : defs,
								_data : []
							};
						});

						stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

						runCallback(func);
					}
					else {
						stdErr('You have an error in your SQL syntax');
					}
				}
				else {
					stdErr("Table '" + name + "' already exists");
				}
			});
		},

		"describeTable" : function(name, func) {
			return this.each(function() {
				var $this  = $(this),
					used   = $this.data('_active_db'),
					data   = $this.data('_database')[used];

				if (!data) {
					stdErr('Database not selected');
				}
				else
				if ( !validName(name) ) {
					stdErr('You have an error in your SQL syntax');
				}
				else
				if ( !data.hasOwnProperty(name) ) {
					stdErr("Unknown table '" + name + "'");
				}
				else {
					var cols  = ['Field','Type'],
						count = 0;

					var timer = calcExecTime(function() {
						var vals = getObjAsCols(cols, data[name]['_defs']);

						stdTermOut(cols, vals);

						count = vals.length;
					});

					stdOut(count + ' row' + ((count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

					runCallback(func);
				}
			});
		},

		"dropDatabase" : function(name, func) {
			return this.each(function() {
				var $this = $(this),
					data  = $this.data('_database');

				if ( !validName(name) ) {
					stdErr('You have an error in your SQL syntax');
				}
				else
				if ( data && data.hasOwnProperty(name) ) {
					var timer = calcExecTime(function() {
						delete data[name];
					});

					stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

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
					if ( !validName(name) ) {
						stdErr('You have an error in your SQL syntax');
					}
					else
					if ( data && data.hasOwnProperty(name) ) {
						var timer = calcExecTime(function() {
							delete data[name];
						});

						stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

						runCallback(func);
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

		"insertInto" : function(table, cols, vals, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (used) {
					if ( !validName(table) ) {
						stdErr('You have an error in your SQL syntax');
					}
					else
					if ( data && data.hasOwnProperty(table) ) {
						var timer = calcExecTime(function() {
							var defs = data[table]['_defs'],
								obj  = {};

							// compare columns and values
							if (cols.length == vals.length) {
								for (var i = 0; i < cols.length; i++) {
									var name = cols[i];

									if ( defs.hasOwnProperty(name) ) {
										var len = defs[name].replace(/^[a-zA-Z]+\((\d+)\)/,'$1');

										// truncate value to defined type length
										obj[name] = vals[i].substring(0, len);
									}
									else {
										return stdErr("Unknown column '" + name + "' in '" + table + "'");
									}
								}

								if (obj) {

									// insert new record
									$this.data('_database')[used][table]['_data'].push(obj);
								}
							}
							else {
								return stdErr("Column count doesn't match value count");
							}
						});

						if (timer) {
							stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

							runCallback(func);
						}
					}
					else {
						stdErr("Unknown table '" + table + "'");
					}
				}
				else {
					stdErr('No database selected ');
				}
			});
		},

		"selectFrom" : function(table, cols, clause, func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (used) {
					if ( !validName(table) ) {
						stdErr('You have an error in your SQL syntax');
					}
					else
					if ( data && data.hasOwnProperty(table) ) {
						var timer = calcExecTime(function() {
							var defs = data[table]['_defs'],
								obj  = {};

							for (var i = 0; i < cols.length; i++) {
								var name = cols[i];

								if ( defs.hasOwnProperty(name) ) {
									alert( JSON.stringify(clause) );
								}
								else {
									return stdErr("Unknown column '" + name + "' in '" + table + "'");
								}
							}
						});

						if (timer) {
							stdOut('Query OK, 0 rows affected &#40;' + timer + ' sec&#41;');

							runCallback(func);
						}
					}
					else {
						stdErr("Unknown table '" + table + "'");
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
					data  = $this.data('_database');

				if (data) {
					var cols  = ['Database'];
						count = 0;

					var timer = calcExecTime(function() {
						var vals = getObjKeys(data, cols);

						stdTermOut(cols, vals);

						count = vals.length;
					});

					stdOut(count + ' row' + ((count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

					runCallback(func);
				}
				else {
					stdOut('No databases exist');
				}
			});
		},

		"showTables" : function(func) {
			return this.each(function() {
				var $this = $(this),
					used  = $this.data('_active_db'),
					data  = $this.data('_database')[used];

				if (used) {
					if ( !$.isEmptyObject(data) ) {
						var cols  = ['Tables' + '_in_' + used],
							count = 0;

						var timer = calcExecTime(function() {
							var vals = getObjKeys(data, cols);

							stdTermOut(cols, vals);

							count = vals.length;
						});

						stdOut(count + ' row' + ((count > 1) ? 's' : '') + ' in set &#40;' + timer + ' sec&#41;');

						runCallback(func);
					}
					else {
						stdErr('No tables used');
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
					data  = $this.data('_database');

				if ( !validName(name) ) {
					stdErr('You have an error in your SQL syntax');
				}
				else
				if ( data && data.hasOwnProperty(name) ) {
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

				switch (true) {
					case /^CREATE\s+DATABASE/i.test(str):
						var regex = /^CREATE\s+DATABASE\s+(\w+)$/i,
							name  = str.replace(regex,'$1');

						$this.SQLterm('createDatabase', name);
					break;

					case /^CREATE\s+TABLE/i.test(str):
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

						$this.SQLterm('createTable', name, obj);
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

				var regex = /^DESCRIBE\s+(\w+)$/i,
					name  = str.replace(regex,'$1');

				$this.SQLterm('describeTable', name);
			});
		},

		"_Drop" : function() {
			return this.each(function() {
				var $this = $(this)
					str   = $this.data('_sql_query');

				switch (true) {
					case /^DROP\s+DATABASE/i.test(str):
						var regex = /^DROP\s+DATABASE\s+(\w+)$/i,
							name  = str.replace(regex,'$1');

						$this.SQLterm('dropDatabase', name);
					break;

					case /^DROP\s+TABLE/i.test(str):
						var regex = /^DROP\s+TABLE\s+(\w+)$/i,
							name  = str.replace(regex,'$1');

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

				var regex = /^INSERT\s+INTO\s+(.+)\s+\((.+)\)\s+VALUES\s+\((.+)\)$/i,
					parts = str.replace(regex,'$1|$2|$3').split(/\|/),
					name  = parts[0],
					cols  = parts[1].split(/\s*,\s*/),
					vals  = parts[2].split(/\s*,\s*/);

				$this.SQLterm('insertInto', name, cols, vals);
			});
		},

		"_Select" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				var regex = /^SELECT\s+(.+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.*)|)$/i,
					parts = str.replace(regex,'$1|$2|$3').split(/\|/),
					name  = parts[1],
					cols  = parts[0].split(/\s*,\s*/),
					vals  = parts[2].split(/AND|OR/i);

				$this.SQLterm('selectFrom', name, cols, vals);
			});
		},

		"_Show" : function() {
			return this.each(function() {
				var $this = $(this),
					str   = $this.data('_sql_query');

				switch (true) {
					case /^SHOW\s+DATABASES/i.test(str):
						$this.SQLterm('showDatabases');
					break;

					case /^SHOW\s+TABLES/i.test(str):
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

				var regex = /^USE\s+(\w+)/i,
					name  = str.replace(regex,'$1');

				$this.SQLterm('useDatabase', name);
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
	 * Return key names (1st child) as array of objects
	 */
	function getObjKeys(data, name) {
		var vals = [];
		for (var key in data) {
			if ( !data.hasOwnProperty(key) ) continue;

			var new_obj = new Object;
			new_obj[name] = key;
			vals.push(new_obj);
		}
		return vals;
	}

	/*
	 * Return key/values as array of object(s)
	 */
	function getObjAsCols(names, obj) {
		var vals = [];
		for (var key in obj) {
			if ( !obj.hasOwnProperty(key) ) continue;

			var new_obj = new Object;
			for (var i = 0; i < names.length; i++) {
				new_obj[ names[i] ] = (i == 0) ? key : obj[key];
			}
			vals.push(new_obj);
		}
		return vals;
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
		$('#SQLterm pre').empty();
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
		$('#SQLterm pre').append( ((str) ? str : '') + '\n');
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
