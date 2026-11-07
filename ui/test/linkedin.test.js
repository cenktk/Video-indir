const test = require('node:test');
const assert = require('node:assert');
const { postName, MASTER } = require('../../scripts/cdp_linkedin_video');

test('postName builds a readable name with the post id', () => {
  assert.strictEqual(
    postName('https://www.linkedin.com/posts/ali-aytekin-518875386_yapayzeka-tasaraftm-animasyon-ugcPost-7516019100247330816-mGvx/?utm_source=x'),
    'ali-aytekin-518875386_yapayzeka-tasaraftm-animasyon [7516019100247330816]');
});

test('postName handles activity URLs and unknown shapes', () => {
  assert.strictEqual(postName('https://www.linkedin.com/posts/jane_hello-world-activity-123-abcd'), 'jane_hello-world [123]');
  assert.strictEqual(postName('https://www.linkedin.com/feed/'), 'feed');
  assert.strictEqual(postName('https://www.linkedin.com/'), 'linkedin-video');
});

test('postName never contains path separators or percent signs', () => {
  const n = postName('https://www.linkedin.com/posts/a%2Fb%25c-ugcPost-9-z');
  assert.ok(!/[\/%\\]/.test(n), n);
});

test('MASTER matches only the dynamic master playlist on dms.licdn.com', () => {
  assert.ok(MASTER.test('https://dms.licdn.com/playlist/vid/dynamic/D4D12/abc?e=1'));
  assert.ok(!MASTER.test('https://dms.licdn.com/playlist/vid/v2/D4D12/hls-720p/0/1'));
  assert.ok(!MASTER.test('https://dms.licdn.com/playlist/vid/dynamic-thumb/x'));
  assert.ok(!MASTER.test('https://evil.com/dms.licdn.com/playlist/vid/dynamic/x'));
  assert.ok(!MASTER.test('http://dms.licdn.com/playlist/vid/dynamic/x'));
});
