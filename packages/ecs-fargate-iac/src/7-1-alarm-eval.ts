/**
 * 과제 7-1 — CloudWatch 알람 상태 평가기
 *
 * 데이터 포인트 시퀀스와 알람 설정을 받아 알람 상태를 판정한다.
 * M out of N, 네 가지 결손 처리, 그리고 "실제 데이터가 충분하면 결손 설정을
 * 쓰지 않는다"는 규칙까지 구현한다.
 *
 * 명세:  tests/7-1-alarm-eval.test.ts  ← 무엇을 만들지는 여기 있다. 먼저 읽어라
 * 판정:  pnpm test 7-1        (패키지 디렉토리에서)
 * 막히면: docs/07-observability.md § TreatMissingData / § CloudWatch가 결손을 다루는 방식
 *
 * ⚠️ 범위 밖: 공식 문서의 "premature alarm state"(조기 알람 상태) 특수 규칙은
 *    구현하지 않는다 — 가장 오래된 위반 데이터포인트가 DatapointsToAlarm만큼
 *    오래되고 그 뒤가 모두 위반·결손일 때 M에 못 미쳐도 ALARM이 되는 규칙이다.
 *    테스트도 그 경우를 검사하지 않는다.
 */

/** 데이터 포인트 하나. 'breach'는 임계값을 위반한 값이다. */
export type Datapoint = 'ok' | 'breach' | 'missing';

/** 알람 상태. RETAIN은 "현재 상태를 유지"(ignore 옵션의 결과)를 뜻한다. */
export type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA' | 'RETAIN';

export type MissingDataTreatment = 'missing' | 'notBreaching' | 'breaching' | 'ignore';

export interface AlarmConfig {
	/** N — 판정에 필요한 데이터 포인트 개수 */
	evaluationPeriods: number;
	/** M — 그중 몇 개가 위반이면 ALARM인가. 생략하면 N과 같다 */
	datapointsToAlarm?: number;
	/** 생략하면 CloudWatch 기본값 */
	treatMissingData?: MissingDataTreatment;
}

/**
 * 알람 상태를 판정한다.
 *
 * @param datapoints 평가 범위의 데이터 포인트. **오래된 것부터 최신 순**
 *                   (배열의 마지막이 가장 최신). 공식 문서 예시 표와 같은 순서다.
 *
 * 판정 규칙 (docs/07-observability.md § CloudWatch가 결손을 실제로 다루는 방식):
 *  1. 결손이 아닌 실제 데이터가 N개 이상이면 → **최신 실제 데이터 N개**로 판정하고
 *     treatMissingData는 쓰지 않는다
 *  2. 실제 데이터가 N개보다 적으면 → 실제 데이터는 모두 쓰고, 부족한 만큼만
 *     treatMissingData로 채워 판정한다 (결손을 최소로 사용한다)
 *  3. 실제 데이터가 하나도 없으면 → 옵션에 따라 상태가 갈린다
 *  4. 위반 개수가 M 이상이면 ALARM, 아니면 OK
 *
 * 힌트: 'missing'과 'ignore'는 채우는 값이 없다. 실제 데이터가 하나라도 있으면
 *       그것만으로 판정하고, 전혀 없을 때만 고유한 상태를 낸다.
 */
export function evaluateAlarm(datapoints: Datapoint[], config: AlarmConfig): AlarmState {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: evaluateAlarm');
}

// 직접 실행하면 이 템플릿의 세 알람 설정을 같은 데이터로 비교한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const alarms: Array<[string, AlarmConfig]> = [
		['① healthy 0 (2/2, breaching)', { evaluationPeriods: 2, datapointsToAlarm: 2, treatMissingData: 'breaching' }],
		['② 태스크 부족 (3/5, breaching)', { evaluationPeriods: 5, datapointsToAlarm: 3, treatMissingData: 'breaching' }],
		['③ 5xx (1/1, notBreaching)', { evaluationPeriods: 1, datapointsToAlarm: 1, treatMissingData: 'notBreaching' }],
	];
	const scenarios: Array<[string, Datapoint[]]> = [
		['평온 (데이터 없음)', ['missing', 'missing', 'missing', 'missing', 'missing']],
		['정상 동작', ['ok', 'ok', 'ok', 'ok', 'ok']],
		['배포 중 한 번 흔들림', ['ok', 'ok', 'breach', 'ok', 'ok']],
		['지속 장애', ['breach', 'breach', 'breach', 'breach', 'breach']],
	];
	for (const [sLabel, dps] of scenarios) {
		console.log(`\n[${sLabel}]  ${dps.map((d) => (d === 'ok' ? '0' : d === 'breach' ? 'X' : '-')).join(' ')}`);
		for (const [aLabel, cfg] of alarms) {
			console.log(`  ${evaluateAlarm(dps, cfg).padEnd(18)} ${aLabel}`);
		}
	}
}
