/**
 * 과제 1-1 — CloudFormation 의존성 순서 계산기
 *
 * CloudFormation은 `!Ref`·`!GetAtt`·`DependsOn`을 보고 의존 그래프를 세워
 * 리소스 생성 순서를 정한다. 파일에 적은 순서는 아무 의미가 없다.
 * 그 판정을 직접 구현한다.
 *
 * 명세:  tests/1-1-cfn-dep-order.test.ts  ← 무엇을 만들지는 여기 있다. 먼저 읽어라
 * 판정:  pnpm test 1-1        (패키지 디렉토리에서)
 * 막히면: docs/01-iac-and-cloudformation.md § 의존 순서
 */

/** 템플릿의 리소스 하나. */
export interface Resource {
	/** 논리적 이름 (템플릿의 Resources 키) */
	name: string;
	/** !Ref·!GetAtt로 참조하는 다른 리소스 이름들 */
	refs?: string[];
	/** DependsOn으로 명시한 리소스 이름들 */
	dependsOn?: string[];
}

/**
 * 생성 순서를 "배치(wave)" 단위로 계산한다.
 *
 * CloudFormation은 서로 의존하지 않는 리소스를 동시에 만들므로, 결과는
 * 단일 리스트가 아니라 리스트의 리스트다. 배치 0은 아무것도 기다리지 않는
 * 리소스들이고, 배치 N은 배치 N-1까지가 끝나야 시작할 수 있는 리소스들이다.
 *
 * 힌트: 각 리소스의 의존 개수를 세어 0인 것부터 벗겨낸다. 한 배치를 벗기면
 *       그 배치에 의존했던 리소스들의 의존 개수가 줄어든다.
 *
 * @throws 참조 대상이 목록에 없으면 Error (메시지에 참조한 쪽과 대상 이름 포함)
 * @throws 순환 의존이 있으면 Error (메시지에 관여한 리소스 이름 포함)
 */
export function resolveWaves(resources: Resource[]): string[][] {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: resolveWaves');
}

/**
 * 순환 의존을 찾는다. 없으면 null, 있으면 관여한 리소스 이름들(정렬됨).
 *
 * resolveWaves가 예외를 던지는 것과 달리 이 함수는 조사용이다 — 무엇이
 * 얽혔는지 목록으로 돌려준다.
 *
 * 힌트: 배치를 다 벗겨냈을 때 남아 있는 리소스가 순환에 얽힌 것들이다.
 */
export function findCycle(resources: Resource[]): string[] | null {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: findCycle');
}

// 직접 실행하면 학습 대상 템플릿의 일부로 순서를 출력한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const template: Resource[] = [
		{ name: 'Service', refs: ['Cluster', 'TaskDefinition', 'TargetGroup', 'ServiceSecurityGroup'], dependsOn: ['AlbListener'] },
		{ name: 'AlbListener', refs: ['Alb', 'TargetGroup'] },
		{ name: 'TargetGroup', refs: ['VpcId'] },
		{ name: 'Alb', refs: ['AlbSecurityGroup'] },
		{ name: 'AlbSecurityGroup' },
		{ name: 'ServiceSecurityGroup', refs: ['AlbSecurityGroup'] },
		{ name: 'Cluster' },
		{ name: 'TaskDefinition', refs: ['LogGroup', 'TaskRole', 'TaskExecutionRole'] },
		{ name: 'LogGroup' },
		{ name: 'GraphRefreshTokenSecret' },
		{ name: 'TaskRole', refs: ['GraphRefreshTokenSecret'] },
		{ name: 'TaskExecutionRole', refs: ['GraphRefreshTokenSecret'] },
		{ name: 'VpcId' },
	];
	for (const [i, wave] of resolveWaves(template).entries()) {
		console.log(`배치 ${i}: ${wave.join(', ')}`);
	}
}
