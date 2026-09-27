import assert from 'node:assert/strict';
import { readProjectSource as read } from './helpers/readProjectSource.mjs';
import test from 'node:test';

test('API failures expose HTTP status instead of object stringification', async () => {
  const apiClient = await read('src/core/apiClient.ts');
  assert.match(apiClient, /catch \(error\)[\s\S]*?createRequestError\(path, error\)/);
  assert.match(apiClient, /statusPart[\s\S]*?HTTP \$\{status\}/);
  assert.match(apiClient, /parseErrorDetail\(body\)/);
});
