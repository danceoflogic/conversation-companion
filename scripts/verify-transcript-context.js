const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3088';
const response = await fetch(`${baseUrl}/api/context-understanding`);

if (!response.ok) {
  const body = await response.text();
  throw new Error(`GET failed: ${response.status} ${body}`);
}

const context = await response.json();

if (typeof context.topic !== 'string' || !context.topic.trim()) {
  throw new Error('Verification failed: topic was missing or empty.');
}

if (typeof context.summary !== 'string' || !context.summary.trim()) {
  throw new Error('Verification failed: summary was missing or empty.');
}

if (!Number.isInteger(context.itemCount) || context.itemCount < 0) {
  throw new Error('Verification failed: itemCount was not a valid integer.');
}

if (!Array.isArray(context.concepts)) {
  throw new Error('Verification failed: concepts was not an array.');
}

if (!Array.isArray(context.questions)) {
  throw new Error('Verification failed: questions was not an array.');
}

if (!Array.isArray(context.actionItems)) {
  throw new Error('Verification failed: actionItems was not an array.');
}

if (!Array.isArray(context.decisions)) {
  throw new Error('Verification failed: decisions was not an array.');
}

if (context.itemCount > 0 && (!context.latestUtterance || !String(context.latestUtterance).trim())) {
  throw new Error('Verification failed: latestUtterance was missing despite stored transcript items.');
}

console.log('Transcript context verified.');
console.log(JSON.stringify({
  source: context.source,
  topic: context.topic,
  itemCount: context.itemCount,
  contextWindowItems: context.contextWindowItems,
  concepts: context.concepts,
  questions: context.questions
}, null, 2));
