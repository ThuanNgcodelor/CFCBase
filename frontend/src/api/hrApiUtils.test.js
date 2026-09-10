import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unwrapApiData } from './hrApiUtils.js';

test('unwrapApiData preserves an explicit null API payload', () => {
  const response = { data: { status: 200, message: 'Không có đợt gửi', data: null } };

  assert.equal(unwrapApiData(response), null);
});

test('unwrapApiData unwraps API data and keeps raw response payloads compatible', () => {
  const campaign = { id: 'campaign-1', status: 'QUEUED' };

  assert.equal(unwrapApiData({ data: { status: 200, data: campaign } }), campaign);
  assert.deepEqual(unwrapApiData({ data: { content: [] } }), { content: [] });
});
