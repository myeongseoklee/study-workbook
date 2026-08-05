/**
 * 과제 5-1 — IAM 정책 평가기
 *
 * 정책 문장 목록과 요청을 받아 허용/거부를 판정한다. 와일드카드 매칭,
 * Deny 우선, 조건 평가, 암묵적 거부를 모두 다룬다.
 *
 * 명세:  tests/5-1-iam-policy-eval.test.ts  ← 무엇을 만들지는 여기 있다. 먼저 읽어라
 * 판정:  pnpm test 5-1        (패키지 디렉토리에서)
 * 막히면: docs/05-iam-roles.md § 정책 문장의 네 요소
 */

export type Effect = 'Allow' | 'Deny';

export interface PolicyCondition {
	operator: 'StringEquals' | 'StringNotEquals' | 'ArnEquals' | 'ArnLike';
	/** 조건 키 (예: 'iam:PassedToService', 'ecs:cluster') */
	key: string;
	/** 기대값. ArnLike는 와일드카드를 허용한다 */
	value: string;
}

export interface Statement {
	sid?: string;
	effect: Effect;
	/** 예: ['ecr:PutImage', 'ecs:*'] */
	actions: string[];
	/** ARN 또는 '*'. 와일드카드 허용 */
	resources: string[];
	/** 모두 충족돼야 이 문장이 매칭된다 (AND) */
	conditions?: PolicyCondition[];
}

export interface Request {
	action: string;
	resource: string;
	/** 요청 컨텍스트. 조건 키의 실제 값 */
	context?: Record<string, string>;
}

/**
 * IAM 스타일 와일드카드 매칭.
 *
 * `*`는 0개 이상의 임의 문자, `?`는 정확히 한 글자에 대응한다.
 * 그 외 문자(`.`, `:`, `/`, `-` 등)는 정규식 특수문자여도 문자 그대로 다뤄야 한다.
 *
 * 예) matchesPattern('ecr:*', 'ecr:PutImage')                    === true
 *     matchesPattern('arn:aws:ecr:*:*:repository/orders-server',
 *                    'arn:aws:ecr:ap-northeast-2:111122223333:repository/orders-server') === true
 *     matchesPattern('ecs:Describe?ervices', 'ecs:DescribeServices') === true
 */
export function matchesPattern(pattern: string, value: string): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: matchesPattern');
}

/**
 * 조건 하나가 요청 컨텍스트에서 충족되는가.
 *
 * ⚠️ 컨텍스트에 키가 없으면 **충족되지 않은 것으로** 처리한다
 *    (StringNotEquals도 마찬가지 — 키가 없으면 비교할 값이 없다).
 *    실제 IAM은 키 부재 처리가 연산자마다 다르지만, 이 과제에서는 위 규칙을 따른다.
 */
export function conditionHolds(condition: PolicyCondition, context: Record<string, string>): boolean {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: conditionHolds');
}

/**
 * 정책 문장 목록으로 요청을 평가한다.
 *
 * 평가 규칙: **명시적 Deny > Allow > 암묵적 거부.**
 * 매칭되는 Deny가 하나라도 있으면 'Deny', 없고 매칭되는 Allow가 있으면 'Allow',
 * 둘 다 없으면 'Deny'(암묵적 거부).
 */
export function evaluate(statements: Statement[], request: Request): Effect {
	// 🎯 TODO: 구현하라
	throw new Error('TODO: evaluate');
}

// 직접 실행하면 배포 롤의 실제 정책으로 몇 가지 요청을 판정한다 (선택 — 테스트와 무관).
if (import.meta.url === `file://${process.argv[1]}`) {
	const ACC = '111122223333';
	const REG = 'ap-northeast-2';
	const deployRole: Statement[] = [
		{ sid: 'EcrAuth', effect: 'Allow', actions: ['ecr:GetAuthorizationToken'], resources: ['*'] },
		{
			sid: 'EcrPushRepo',
			effect: 'Allow',
			actions: ['ecr:PutImage', 'ecr:InitiateLayerUpload', 'ecr:UploadLayerPart', 'ecr:CompleteLayerUpload'],
			resources: [`arn:aws:ecr:${REG}:${ACC}:repository/orders-server`],
		},
		{
			sid: 'EcsServiceDeploy',
			effect: 'Allow',
			actions: ['ecs:UpdateService', 'ecs:DescribeServices'],
			resources: [`arn:aws:ecs:${REG}:${ACC}:service/orders-dev/orders-server-dev`],
			conditions: [{ operator: 'ArnEquals', key: 'ecs:cluster', value: `arn:aws:ecs:${REG}:${ACC}:cluster/orders-dev` }],
		},
		{
			sid: 'PassTaskRoles',
			effect: 'Allow',
			actions: ['iam:PassRole'],
			resources: [
				`arn:aws:iam::${ACC}:role/orders-server-dev-task-execution-role`,
				`arn:aws:iam::${ACC}:role/orders-server-dev-task-role`,
			],
			conditions: [{ operator: 'StringEquals', key: 'iam:PassedToService', value: 'ecs-tasks.amazonaws.com' }],
		},
	];

	const requests: Array<[string, Request]> = [
		['ECR 로그인 토큰', { action: 'ecr:GetAuthorizationToken', resource: '*' }],
		['orders-server 이미지 push', { action: 'ecr:PutImage', resource: `arn:aws:ecr:${REG}:${ACC}:repository/orders-server` }],
		['다른 리포에 push', { action: 'ecr:PutImage', resource: `arn:aws:ecr:${REG}:${ACC}:repository/other-server` }],
		['리포 삭제', { action: 'ecr:DeleteRepository', resource: `arn:aws:ecr:${REG}:${ACC}:repository/orders-server` }],
		[
			'ECS 서비스 갱신',
			{
				action: 'ecs:UpdateService',
				resource: `arn:aws:ecs:${REG}:${ACC}:service/orders-dev/orders-server-dev`,
				context: { 'ecs:cluster': `arn:aws:ecs:${REG}:${ACC}:cluster/orders-dev` },
			},
		],
		[
			'태스크 롤을 Lambda로 전달',
			{
				action: 'iam:PassRole',
				resource: `arn:aws:iam::${ACC}:role/orders-server-dev-task-role`,
				context: { 'iam:PassedToService': 'lambda.amazonaws.com' },
			},
		],
	];
	for (const [label, req] of requests) {
		console.log(`${evaluate(deployRole, req).padEnd(5)} ${label}`);
	}
}
