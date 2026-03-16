function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderWidget(widget) {
  if (widget.type === 'glossary') {
    return `<article class="widget"><h3>${escapeHtml(widget.title)}</h3><ul>${(Array.isArray(widget.items) ? widget.items : []).map((item) => `<li><strong>${escapeHtml(item?.term)}:</strong> ${escapeHtml(item?.definition)}</li>`).join('')}</ul></article>`;
  }
  if (widget.type === 'worked_example') {
    return `<article class="widget"><h3>${escapeHtml(widget.title)}</h3><p><strong>${escapeHtml(widget.problem)}</strong></p><ol>${(Array.isArray(widget.steps) ? widget.steps : []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol></article>`;
  }
  if (widget.type === 'common_mistakes' || widget.type === 'follow_up_questions' || widget.type === 'open_questions' || widget.type === 'action_items' || widget.type === 'decisions') {
    return `<article class="widget"><h3>${escapeHtml(widget.title)}</h3><ul>${(Array.isArray(widget.items) ? widget.items : []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></article>`;
  }
  if (widget.type === 'quiz') {
    return `<article class="widget"><h3>${escapeHtml(widget.title)}</h3><p>${escapeHtml(widget.question)}</p><details><summary>Show answer</summary><p>${escapeHtml(widget.answer)}</p></details></article>`;
  }
  return `<article class="widget"><h3>${escapeHtml(widget.title || 'Widget')}</h3><pre>${escapeHtml(JSON.stringify(widget, null, 2))}</pre></article>`;
}
