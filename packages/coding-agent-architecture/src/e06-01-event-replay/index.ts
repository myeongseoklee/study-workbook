export interface Event {
	sessionId: string;
	sequence: number;
	type: string;
	payload: unknown;
}

export function replay(events: Event[]): Event[] {
	const sessionOrder: string[] = [];
	const bySession = new Map<string, Map<number, Event>>();
	for (const event of events) {
		if (!bySession.has(event.sessionId)) {
			bySession.set(event.sessionId, new Map());
			sessionOrder.push(event.sessionId);
		}
		bySession.get(event.sessionId)!.set(event.sequence, event);
	}
	return sessionOrder.flatMap((sessionId) =>
		[...bySession.get(sessionId)!.entries()]
			.sort(([a], [b]) => a - b)
			.map(([, event]) => event),
	);
}
