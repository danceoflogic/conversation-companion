function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTranscript(entries) {
  return entries
    .map((entry) => `
      <div class="transcript-entry">
        <div class="transcript-meta">${escapeHtml(entry.time)} · ${escapeHtml(entry.speaker)}</div>
        <div>${escapeHtml(entry.text)}</div>
      </div>
    `)
    .join('');
}

export function renderActivity(entries) {
  return entries
    .map((entry) => `
      <div class="activity-entry ${entry.isActive ? 'active' : ''}">
        <div class="activity-meta">${escapeHtml(entry.time)} · Triggered widgets: ${escapeHtml((entry.widgets || []).join(', ') || 'none')}</div>
        <div>${escapeHtml(entry.summary || entry.text)}</div>
      </div>
    `)
    .join('');
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

export function renderConcepts(concepts) {
  return concepts
    .map((concept) => `<button class="chip concept-chip-button" type="button" data-concept="${escapeAttr(concept)}">${escapeHtml(concept)}</button>`)
    .join('');
}

export function renderContextExplorer(contextUnderstanding) {
  if (!contextUnderstanding) {
    return '';
  }

  const items = [{ label: 'Context Overview', kind: 'overview' }];

  if (contextUnderstanding.topic) {
    items.push({ label: contextUnderstanding.topic, kind: 'topic' });
  }

  for (const concept of contextUnderstanding.concepts || []) {
    items.push({ label: concept, kind: 'concept' });
  }

  for (const question of contextUnderstanding.questions || []) {
    items.push({ label: question, kind: 'question' });
  }

  for (const actionItem of contextUnderstanding.actionItems || []) {
    items.push({ label: actionItem, kind: 'action-item' });
  }

  for (const decision of contextUnderstanding.decisions || []) {
    items.push({ label: decision, kind: 'decision' });
  }

  return items
    .map((item) => `<button class="chip concept-chip-button context-chip-${item.kind}" type="button" data-context-item="${escapeAttr(item.label)}" data-context-kind="${item.kind}">${escapeHtml(item.label)}</button>`)
    .join('');
}
