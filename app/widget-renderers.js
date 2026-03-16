export function renderWidget(widget) {
  if (widget.type === 'glossary') {
    return `<article class="widget"><h3>${widget.title}</h3><ul>${widget.items.map((item) => `<li><strong>${item.term}:</strong> ${item.definition}</li>`).join('')}</ul></article>`;
  }
  if (widget.type === 'worked_example') {
    return `<article class="widget"><h3>${widget.title}</h3><p><strong>${widget.problem}</strong></p><ol>${widget.steps.map((step) => `<li>${step}</li>`).join('')}</ol></article>`;
  }
  if (widget.type === 'common_mistakes' || widget.type === 'follow_up_questions' || widget.type === 'open_questions' || widget.type === 'action_items' || widget.type === 'decisions') {
    return `<article class="widget"><h3>${widget.title}</h3><ul>${widget.items.map((item) => `<li>${item}</li>`).join('')}</ul></article>`;
  }
  if (widget.type === 'quiz') {
    return `<article class="widget"><h3>${widget.title}</h3><p>${widget.question}</p><details><summary>Show answer</summary><p>${widget.answer}</p></details></article>`;
  }
  return `<article class="widget"><h3>${widget.title || 'Widget'}</h3><pre>${JSON.stringify(widget, null, 2)}</pre></article>`;
}
