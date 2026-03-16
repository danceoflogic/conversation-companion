const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3088';

const sample = {
  speaker: 'Helper',
  time: '00:02',
  text: 'Placeholder transcript chunk for local ingestion verification.',
  source: 'verify-script'
};

const postResponse = await fetch(`${baseUrl}/api/transcript-ingestion`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify(sample)
});

if (!postResponse.ok) {
  const body = await postResponse.text();
  throw new Error(`POST failed: ${postResponse.status} ${body}`);
}

const postBody = await postResponse.json();
const getResponse = await fetch(`${baseUrl}/api/transcript-ingestion`);

if (!getResponse.ok) {
  const body = await getResponse.text();
  throw new Error(`GET failed: ${getResponse.status} ${body}`);
}

const store = await getResponse.json();
const found = store.items?.some((item) => item.text === sample.text && item.source === sample.source);

if (!found) {
  throw new Error('Verification failed: ingested transcript item was not found in store.');
}

console.log(`Transcript ingestion verified. Total stored items: ${store.items.length}`);
console.log(`Last ingested item id: ${postBody.item.id}`);
