/**
 * 과제 4-1 — 롤링 배포 범위와 서킷 브레이커 임계값 계산기
 *
 * 배포 중 태스크가 몇 개까지 줄고 몇 개까지 늘 수 있는지, 그 설정이 교착인지,
 * 몇 번 실패하면 배포가 포기되는지를 계산한다. 올림·내림 방향과 clamp 경계가
 * 채점 대상이다.
 *
 * 명세:  tests/4-1-rolling-deploy.test.ts  ← 무엇을 만들지는 여기 있다. 먼저 읽어라
 * 판정:  pnpm test 4-1        (패키지 디렉토리에서)
 * 막히면: docs/04-ecs-fargate.md § 롤링 배포의 산수 / § 서킷 브레이커
 */

export interface DeployRange {
	/** 배포 중 유지돼야 하는 최소 healthy 태스크 수 */
	min: number;
	/** 배포 중 허용되는 최대 태스크 수 (RUNNING + PENDING) */
	max: number;
}

/**
 * 배포 중 태스크 수의 범위.
 *
 * ⚠️ 두 값의 반올림 방향이 다르다. 방향에는 이유가 있다 —
 *    docs/04-ecs-fargate.md § 롤링 배포의 산수 참고.
 */
export function deployRange(
	desiredCount: number,
	minimumHealthyPercent = 100,
	maximumPercent = 200,
): DeployRange {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: deployRange');
}

/**
 * 이 설정으로 배포가 교착되는가.
 *
 * 교착이란 스케줄러가 **태스크를 하나도 멈출 수 없고 하나도 시작할 수도 없는**
 * 상태다. 이때 ECS는 배포를 진행하지 못하고 "설정 때문에 태스크를 멈추거나
 * 시작할 수 없다"는 서비스 이벤트를 낸다.
 *
 * 힌트: 시작할 여유가 있는가? 멈출 여유가 있는가? 둘 다 없으면 교착이다.
 */
export function isDeadlocked(
	desiredCount: number,
	minimumHealthyPercent = 100,
	maximumPercent = 200,
): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: isDeadlocked');
}

/**
 * 이 설정으로 무중단 배포가 가능한가.
 *
 * 무중단이란 배포 내내 healthy 태스크 수가 DesiredCount보다 적어지지 않으면서
 * 배포가 진행될 수 있는 상태다. 새 태스크를 먼저 띄우고 옛 태스크를 내릴
 * 여유가 있어야 한다.
 */
export function isZeroDowntime(
	desiredCount: number,
	minimumHealthyPercent = 100,
	maximumPercent = 200,
): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: isZeroDowntime');
}

export type ThresholdConfig =
	/** 비율 × DesiredCount를 최소 3·최대 200으로 가둔다 (ECS 기본, value 기본 50) */
	| { type: 'BOUNDED_PERCENT'; value?: number }
	/** 비율 × DesiredCount를 그대로 쓴다 (상·하한 없음) */
	| { type: 'UNBOUNDED_PERCENT'; value: number }
	/** DesiredCount와 무관한 고정 횟수 */
	| { type: 'COUNT'; value: number };

/**
 * 배포 서킷 브레이커가 배포를 FAILED로 판정하는 실패 횟수.
 *
 * 비율 계산 결과는 **올림**한다. BOUNDED_PERCENT에서 결과가 3보다 작으면 3,
 * 200보다 크면 200이 된다 (경계값 200 자체는 그대로 200이다).
 *
 * @param config 생략하면 ECS 기본값 { type: 'BOUNDED_PERCENT', value: 50 }
 */
export function circuitBreakerThreshold(desiredCount: number, config?: ThresholdConfig): number {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: circuitBreakerThreshold');
}

// 직접 실행하면 학습 대상 템플릿 설정과 흔한 대안을 비교 출력한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const cases: Array<[number, number, number, string]> = [
		[1, 100, 200, '이 템플릿 (DEV)'],
		[1, 100, 100, '흔한 실수'],
		[1, 50, 100, 'DesiredCount 1에서는 같은 결과'],
		[4, 50, 100, '여유 용량 없이 교체'],
		[4, 100, 200, '운영 표준'],
		[4, 0, 100, '중단 허용'],
	];
	for (const [d, minP, maxP, note] of cases) {
		const r = deployRange(d, minP, maxP);
		const flags = [
			isDeadlocked(d, minP, maxP) ? '교착' : '',
			isZeroDowntime(d, minP, maxP) ? '무중단' : '',
		].filter(Boolean).join(' ');
		console.log(
			`d=${d} ${minP}/${maxP}  최소 ${r.min} 최대 ${r.max}  ` +
				`브레이커 ${circuitBreakerThreshold(d)}  ${flags.padEnd(8)} ${note}`,
		);
	}
}
