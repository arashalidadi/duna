import assert from 'node:assert/strict';
import { postLoginRoute } from '../src/lib/auth/post-login-route';

assert.equal(postLoginRoute(['portal:access', 'booking:create']), '/portal');
assert.equal(postLoginRoute(['dashboard:read', 'portal:access']), '/dashboard');
assert.equal(postLoginRoute(['dashboard:read']), '/dashboard');
assert.equal(postLoginRoute([]), '/dashboard');
console.log('Portal landing route: 4/4 assertions passed');
