import { describe, expect, it } from 'vitest';
import { replay, type Event } from '../../src/e06-01-event-replay';

describe('event replay', () => {
	it('세션별 순서를 복원하고 중복 시퀀스를 제거한다', () => {
		const events: Event[] = [
			{ sessionId: 'b', sequence: 2, type: 'done', payload: 2 },
			{ sessionId: 'a', sequence: 2, type: 'done', payload: 2 },
			{ sessionId: 'b', sequence: 1, type: 'start', payload: 1 },
			{ sessionId: 'a', sequence: 1, type: 'start', payload: 1 },
			{ sessionId: 'a', sequence: 2, type: 'done', payload: 'duplicate' },
		];
		expect(replay(events)).toEqual([
			events[2], events[0], events[3], events[4],
		]);
	});

	it('빈 입력은 빈 배열이다', () => {
		expect(replay([])).toEqual([]);
	});
});
