/**
 * 과제 7-1의 참고 구현.
 *
 * 판정은 `tests/7-1-alarm-eval.test.ts`가 한다. 여기 있는 코드는
 * "정답 하나"가 아니라 "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/07-observability.md § TreatMissingData / § 세 알람 비교
 *            / docs/90-must-memorize.md 카드 27
 */

export type Datapoint = 'ok' | 'breach' | 'missing';
export type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA' | 'RETAIN';
export type MissingDataTreatment = 'missing' | 'notBreaching' | 'breaching' | 'ignore';

export interface AlarmConfig {
	evaluationPeriods: number;
	datapointsToAlarm?: number;
	treatMissingData?: MissingDataTreatment;
}

export function evaluateAlarm(datapoints: Datapoint[], config: AlarmConfig): AlarmState {
	const n = config.evaluationPeriods;
	const m = config.datapointsToAlarm ?? n; // 생략하면 M = N
	const treatment = config.treatMissingData ?? 'missing'; // CloudWatch 기본값

	// 결손이 아닌 실제 데이터만, 최신 것이 뒤에 오도록 유지한 채 추출한다.
	const real = datapoints.filter((d): d is 'ok' | 'breach' => d !== 'missing');

	const verdict = (points: Datapoint[]): AlarmState =>
		points.filter((p) => p === 'breach').length >= m ? 'ALARM' : 'OK';

	// ── 실제 데이터가 하나도 없을 때: 옵션마다 상태가 갈린다 ──
	if (real.length === 0) {
		switch (treatment) {
			case 'missing':
				return 'INSUFFICIENT_DATA';
			case 'ignore':
				return 'RETAIN';
			case 'breaching':
				return verdict(Array.from({ length: n }, () => 'breach' as const));
			case 'notBreaching':
				return verdict(Array.from({ length: n }, () => 'ok' as const));
		}
	}

	// ── 실제 데이터가 N개 이상: 최신 N개로 판정하고 결손 설정은 쓰지 않는다 ──
	// 문서가 명시하는 규칙이다. 여기를 빠뜨리면 breaching이 항상 알람을 울린다.
	if (real.length >= n) {
		return verdict(real.slice(-n));
	}

	// ── 실제 데이터가 부족: 부족한 만큼만 채운다 (결손을 최소로 사용) ──
	const shortfall = n - real.length;

	if (treatment === 'breaching') {
		return verdict([...real, ...Array.from({ length: shortfall }, () => 'breach' as const)]);
	}
	if (treatment === 'notBreaching') {
		return verdict([...real, ...Array.from({ length: shortfall }, () => 'ok' as const)]);
	}

	// missing·ignore는 채울 값이 없다. 실제 데이터가 하나라도 있으면 그것만으로 판정한다
	// ('ignore'가 RETAIN을 내는 것은 전부 결손일 때뿐이다).
	return verdict(real);
}
