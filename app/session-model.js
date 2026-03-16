export function normalizeSessionPayload(data) {
  return {
    session: {
      id: data?.session?.id ?? 'unknown-session',
      mode: data?.session?.mode ?? 'unknown',
      title: data?.session?.title ?? 'Untitled session',
      updatedAt: data?.session?.updatedAt ?? null,
      status: data?.session?.status ?? 'unknown',
      latencyMs: Number(data?.session?.latencyMs ?? 0),
      providerMode: data?.session?.providerMode ?? 'unknown'
    },
    summary: data?.summary ?? '',
    topic: data?.topic ?? 'Unknown topic',
    concepts: Array.isArray(data?.concepts) ? data.concepts : [],
    timeline: Array.isArray(data?.timeline) ? data.timeline : [],
    widgets: Array.isArray(data?.widgets) ? data.widgets : []
  };
}

export function getVisibleTimeline(session, count) {
  return session.timeline.slice(0, Math.max(0, count));
}

export function getLatestActivity(session, count) {
  const visible = getVisibleTimeline(session, count);
  return visible.map((entry, index) => ({
    ...entry,
    isActive: index === visible.length - 1
  }));
}
