import test from 'ava';
import nock from 'nock';
import delay from 'delay';
import tempfile from 'tempfile';
import {alfy} from './_utils';

const URL = 'http://foo.bar';

test.before(() => {
	nock(URL).get('/no-cache').times(2).reply(200, {foo: 'bar'});
	nock(URL).get('/cache').once().reply(200, {hello: 'world'});
	nock(URL).get('/cache').twice().reply(200, {hello: 'world!'});
	nock(URL).get('/cache-key?unicorn=rainbow').reply(200, {unicorn: 'rainbow'});
	nock(URL).get('/cache-version').once().reply(200, {foo: 'bar'});
	nock(URL).get('/cache-version').twice().reply(200, {unicorn: 'rainbow'});
});

test('no cache', async t => {
	const m = alfy();
	t.deepEqual(await m.fetch(`${URL}/no-cache`), {foo: 'bar'});
	t.falsy(m.cache.get(`${URL}/no-cache`));
});

test('transform not a function', async t => {
	const m = alfy();
	await t.throws(m.fetch(`${URL}/no-cache`, {transform: 'foo'}), 'Expected `transform` to be a `function`, got `string`');
});

test('transform', async t => {
	const m = alfy();
	const result = await m.fetch(`${URL}/no-cache`, {
		transform: response => {
			response.unicorn = 'rainbow';
			return response;
		}
	});

	t.deepEqual(result, {
		foo: 'bar',
		unicorn: 'rainbow'
	});
});

test('cache', async t => {
	const m = alfy();

	t.deepEqual(await m.fetch(`${URL}/cache`, {maxAge: 5000}), {hello: 'world'});
	t.deepEqual(await m.fetch(`${URL}/cache`, {maxAge: 5000}), {hello: 'world'});

	await delay(5000);

	t.deepEqual(await m.fetch(`${URL}/cache`, {maxAge: 5000}), {hello: 'world!'});
});

test('cache key', async t => {
	const m = alfy();

	t.deepEqual(await m.fetch(`${URL}/cache-key`, {query: {unicorn: 'rainbow'}, maxAge: 5000}), {unicorn: 'rainbow'});
	t.truthy(m.cache.store['http://foo.bar/cache-key{"json":true,"query":{"unicorn":"rainbow"},"maxAge":5000}']);
});

test('invalid version', async t => {
	const cache = tempfile();

	const m = alfy({cache, version: '1.0.0'});
	t.deepEqual(await m.fetch(`${URL}/cache-version`, {maxAge: 5000}), {foo: 'bar'});
	t.deepEqual(await m.fetch(`${URL}/cache-version`, {maxAge: 5000}), {foo: 'bar'});
	t.deepEqual(m.cache.store['http://foo.bar/cache-version{"json":true,"maxAge":5000}'].data, {foo: 'bar'});

	const m2 = alfy({cache, version: '1.0.0'});
	t.deepEqual(await m2.fetch(`${URL}/cache-version`, {maxAge: 5000}), {foo: 'bar'});

	const m3 = alfy({cache, version: '1.0.1'});
	t.deepEqual(await m3.fetch(`${URL}/cache-version`, {maxAge: 5000}), {unicorn: 'rainbow'});
	t.deepEqual(m.cache.store['http://foo.bar/cache-version{"json":true,"maxAge":5000}'].data, {unicorn: 'rainbow'});
});
