'use strict';

var test = require('tape');
var inspect = require('object-inspect');
var forEach = require('for-each');
var v = require('es-value-fixtures');

var isArrayBuffer = require('..');

test('isArrayBuffer', function (t) {
	t.equal(typeof isArrayBuffer, 'function', 'is a function');

	var nonABs = v.primitives.concat(
		v.objects,
		typeof SharedArrayBuffer === 'function' ? new SharedArrayBuffer() : []
	);
	forEach(nonABs, function (nonAB) {
		t.equal(isArrayBuffer(nonAB), false, inspect(nonAB) + ' is not an ArrayBuffer');
	});

	t.test('actual ArrayBuffer instances', { skip: typeof ArrayBuffer === 'undefined' }, function (st) {
		var ab = new ArrayBuffer();

		st.equal(isArrayBuffer(ab), true, inspect(ab) + ' is an ArrayBuffer');

		st.end();
	});

	t.end();
});
