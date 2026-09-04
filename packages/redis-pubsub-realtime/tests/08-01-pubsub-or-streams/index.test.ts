/**
 * 과제 08-01의 명세 — Pub/Sub인가, Streams인가, 아니면 Redis 밖의 메시지 큐인가
 *
 * 이 파일이 과제의 정의다. `src/08-01-pubsub-or-streams/index.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 구현이 아니라 이해가 틀렸을
 * 가능성이 먼저다. 그럴 때는 docs/08-pubsub-or-streams.md의 「판정 절차」를 다시 읽어라.
 *
 * 판정은 세 질문을 순서대로 놓고 위에서부터 내려가며, 처음 걸리는 곳이 답이다.
 * 그래서 이 명세가 검사하는 것은 개별 조건이 아니라 조건들 사이의 우선순위와 경계다.
 *
 * 실행: pnpm test 08-01
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { RETENTION_THRESHOLD_HOURS, decide } from '../../src/08-01-pubsub-or-streams';
import type { Requirement } from '../../src/08-01-pubsub-or-streams';

/**
 * 요건 하나를 짧게 만드는 헬퍼다.
 * 기본값은 "놓치면 안 되고, 재처리 요구는 명시하지 않았고, 보존 요구도 없으며,
 * 메모리는 넉넉한" 상태다. 각 검사는 여기서 바꾼 항목만 적으므로,
 * 그 검사가 무엇을 겨냥하는지가 인자만 보고도 드러난다.
 */
const BASE: Requirement = {
	lossTolerated: false,
	needsRedelivery: false,
	retentionHours: 0,
	retainedVolumeMb: 0,
	availableMemoryMb: 1_024,
};

function req(overrides: Partial<Requirement> = {}): Requirement {
	return { ...BASE, ...overrides };
}

describe('decide — 첫 번째 질문: 이 메시지를 놓쳐도 되는가', () => {
	it('놓쳐도 되는 메시지는 Pub/Sub이고, 근거는 loss-tolerated다', () => {
		expect(decide(req({ lossTolerated: true }))).toEqual({
			choice: 'pubsub',
			reason: 'loss-tolerated',
		});
	});

	it('놓쳐도 되는 메시지는 보존 기간이 아무리 길어도 Pub/Sub이다 — 첫 질문에서 끝난다', () => {
		const decision = decide(req({ lossTolerated: true, retentionHours: 720 }));
		retrace(
			'보존 조건을 손실 허용 여부보다 먼저 보면 여기서 external-mq가 나온다. ' +
				'놓쳐도 되는 메시지에는 애초에 보존 요구가 성립하지 않으므로, ' +
				'첫 질문에서 답이 확정되면 아래 질문은 읽지 않는다.',
			() => {
				expect(decision.choice).toBe('pubsub');
				expect(decision.reason).toBe('loss-tolerated');
			},
		);
	});

	it('놓쳐도 되는 메시지는 보존량이 가용 메모리를 넘어도 Pub/Sub이다', () => {
		const decision = decide(
			req({ lossTolerated: true, retainedVolumeMb: 8_192, availableMemoryMb: 512 }),
		);
		retrace(
			'용량 조건도 손실 허용 여부보다 뒤에 있다. 저장하지 않기로 한 메시지의 총량은 ' +
				'Redis 메모리를 차지하지 않으므로, 이 입력에서 용량을 따지는 것 자체가 무의미하다.',
			() => {
				expect(decision.choice).toBe('pubsub');
			},
		);
	});
});

describe('decide — needsRedelivery는 lossTolerated를 무효화한다', () => {
	it('재처리가 필요하다고 적혀 있으면 lossTolerated가 true여도 Pub/Sub을 고르지 않는다', () => {
		const decision = decide(req({ lossTolerated: true, needsRedelivery: true }));
		retrace(
			'두 값이 서로 모순되는 요건이다. 재처리가 필요하다는 말은 놓치면 안 된다는 뜻이므로, ' +
				'이때는 lossTolerated를 무시한다. 이 규칙을 빠뜨리면 반드시 처리되어야 하는 일에 ' +
				'휘발성 수단을 붙이게 되고, 그 결과는 사고다.',
			() => {
				expect(decision).toEqual({ choice: 'streams', reason: 'redelivery-required' });
			},
		);
	});

	it('lossTolerated가 true여도 재처리가 필요하고 보존 기간이 길면 external-mq까지 간다', () => {
		const decision = decide(
			req({ lossTolerated: true, needsRedelivery: true, retentionHours: 72 }),
		);
		retrace(
			'lossTolerated를 무효화한 뒤에는 손실을 허용하지 않는 갈래의 규칙을 그대로 적용한다. ' +
				'무효화가 "Streams로 확정"을 뜻하는 것이 아니라 "첫 질문을 통과하지 못했다"를 뜻한다.',
			() => {
				expect(decision.choice).toBe('external-mq');
				expect(decision.reason).toBe('retention-exceeds-threshold');
			},
		);
	});
});

describe('decide — 손실을 허용하지 않을 때의 세 갈래', () => {
	it('보존 요구가 없고 메모리에 담기면 Streams이며, 근거 코드는 redelivery-required다', () => {
		const decision = decide(req({ retainedVolumeMb: 100, availableMemoryMb: 1_024 }));
		retrace(
			'근거 코드는 입력 필드의 이름이 아니라 판정이 도달한 갈래의 이름이다. ' +
				'needsRedelivery가 false여도 손실을 허용하지 않는 이상 확인 응답이 필요하므로, ' +
				'이 갈래의 근거는 redelivery-required로 통일한다.',
			() => {
				expect(decision).toEqual({ choice: 'streams', reason: 'redelivery-required' });
			},
		);
	});

	it('보존 기간이 경계를 넘으면 Redis 밖으로 나간다', () => {
		expect(decide(req({ needsRedelivery: true, retentionHours: 168 }))).toEqual({
			choice: 'external-mq',
			reason: 'retention-exceeds-threshold',
		});
	});

	it('보존량이 가용 메모리를 초과하면 Redis 밖으로 나간다', () => {
		expect(
			decide(req({ needsRedelivery: true, retainedVolumeMb: 4_096, availableMemoryMb: 1_024 })),
		).toEqual({ choice: 'external-mq', reason: 'volume-exceeds-memory' });
	});
});

describe('decide — 경계값', () => {
	it('보존 기간이 경계와 정확히 같으면 걸린다 (이상이지 초과가 아니다)', () => {
		const decision = decide(req({ retentionHours: 24 }));
		retrace(
			'부등호를 >로 쓰면 정확히 24시간인 요건이 Streams로 빠진다. ' +
				'명세는 "24시간 이상이면 Redis 밖"이므로 >= 로 판정해야 한다.',
			() => {
				expect(decision.choice).toBe('external-mq');
			},
		);
	});

	it('보존 기간이 경계보다 1시간 짧으면 걸리지 않고 다음 규칙으로 넘어간다', () => {
		expect(decide(req({ retentionHours: 23 })).choice).toBe('streams');
	});

	it('경계값은 RETENTION_THRESHOLD_HOURS가 정한 24시간이고, 그 값에서 판정이 갈린다', () => {
		const atThreshold = decide(req({ retentionHours: RETENTION_THRESHOLD_HOURS }));
		const belowThreshold = decide(req({ retentionHours: RETENTION_THRESHOLD_HOURS - 1 }));
		retrace(
			'이 상수는 Redis가 정한 값이 아니라 이 판정이 채택한 정책 상수다. ' +
				'값을 코드 안에 그대로 적어 넣으면 정책이 바뀔 때 고칠 자리가 흩어진다.',
			() => {
				expect(atThreshold.choice).toBe('external-mq');
				expect(belowThreshold.choice).toBe('streams');
				expect(RETENTION_THRESHOLD_HOURS).toBe(24);
			},
		);
	});

	it('보존량이 가용 메모리와 정확히 같으면 걸리지 않는다 (초과해야 걸린다)', () => {
		const decision = decide(req({ retainedVolumeMb: 1_024, availableMemoryMb: 1_024 }));
		retrace(
			'부등호를 >= 로 쓰면 딱 맞게 담기는 요건까지 Redis 밖으로 밀려난다. ' +
				'보존 기간은 이상에서 걸리고 보존량은 초과에서 걸리므로, 두 부등호의 방향이 서로 다르다.',
			() => {
				expect(decision).toEqual({ choice: 'streams', reason: 'redelivery-required' });
			},
		);
	});

	it('보존량이 가용 메모리보다 1MB만 커도 걸린다', () => {
		expect(decide(req({ retainedVolumeMb: 1_025, availableMemoryMb: 1_024 })).choice).toBe(
			'external-mq',
		);
	});
});

describe('decide — 두 external-mq 조건이 겹칠 때의 우선순위', () => {
	it('보존 기간과 보존량이 함께 걸리면 근거는 retention-exceeds-threshold다', () => {
		const decision = decide(
			req({ retentionHours: 168, retainedVolumeMb: 8_192, availableMemoryMb: 512 }),
		);
		retrace(
			'두 조건 모두 external-mq로 가지만 근거가 다르다. 보존 기간을 먼저 보는 이유는 ' +
				'그 조건이 메모리를 늘려도 해결되지 않는 요구이기 때문이다. 용량을 먼저 보고 ' +
				'volume-exceeds-memory를 내면, 읽는 사람은 "메모리를 증설하면 Streams로 돌아올 수 있다"고 ' +
				'잘못 읽게 된다.',
			() => {
				expect(decision.choice).toBe('external-mq');
				expect(decision.reason).toBe('retention-exceeds-threshold');
			},
		);
	});
});

describe('decide — 근거 코드와 순수성', () => {
	it('네 갈래가 각각 서로 다른 근거 코드를 낸다', () => {
		const reasons = [
			decide(req({ lossTolerated: true })).reason,
			decide(req({ needsRedelivery: true })).reason,
			decide(req({ retentionHours: 48 })).reason,
			decide(req({ retainedVolumeMb: 2_048, availableMemoryMb: 1_024 })).reason,
		];
		retrace(
			'근거를 항상 같은 값으로 채우거나 아예 비워 두면 판정 결과만 맞고 설명이 사라진다. ' +
				'수단을 고른 이유를 함께 돌려주는 것이 이 함수의 절반이다.',
			() => {
				expect(reasons).toEqual([
					'loss-tolerated',
					'redelivery-required',
					'retention-exceeds-threshold',
					'volume-exceeds-memory',
				]);
			},
		);
	});

	it('입력 요건 객체를 변경하지 않는다', () => {
		const input = req({ lossTolerated: true, needsRedelivery: true, retentionHours: 48 });
		const snapshot = { ...input };
		decide(input);
		retrace(
			'lossTolerated를 무효화하는 규칙을 입력 객체에 직접 대입해서 처리하면 ' +
				'호출한 쪽의 요건이 조용히 바뀐다. 무효화는 판정 안에서만 일어나야 한다.',
			() => {
				expect(input).toEqual(snapshot);
			},
		);
	});
});
