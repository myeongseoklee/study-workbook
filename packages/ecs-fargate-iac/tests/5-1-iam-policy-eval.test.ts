/**
 * 과제 5-1의 명세 — IAM 정책 평가기
 *
 * 이 파일이 과제의 정의다. `src/5-1-iam-policy-eval.ts`를 채워 여기를 통과시켜라.
 * 이 파일은 고치지 않는다. 고쳐야 할 것 같으면 docs/05-iam-roles.md § 정책 문장의 네 요소를 다시 읽어라.
 *
 * 실행: pnpm test 5-1
 */
import { retrace } from '@study/testkit';
import { describe, expect, it } from 'vitest';
import { conditionHolds, evaluate, matchesPattern, type Statement } from '../src/5-1-iam-policy-eval';

const ACC = '111122223333';
const REG = 'ap-northeast-2';
const REPO = `arn:aws:ecr:${REG}:${ACC}:repository/orders-server`;
const SVC = `arn:aws:ecs:${REG}:${ACC}:service/orders-dev/orders-server-dev`;
const CLUSTER = `arn:aws:ecs:${REG}:${ACC}:cluster/orders-dev`;
const TASK_ROLE = `arn:aws:iam::${ACC}:role/orders-server-dev-task-role`;
const EXEC_ROLE = `arn:aws:iam::${ACC}:role/orders-server-dev-task-execution-role`;

describe('matchesPattern — IAM 와일드카드', () => {
	it('와일드카드가 없으면 정확히 일치해야 한다', () => {
		expect(matchesPattern('ecr:PutImage', 'ecr:PutImage')).toBe(true);
		expect(matchesPattern('ecr:PutImage', 'ecr:DeleteRepository')).toBe(false);
	});

	it("'*' 접미사는 그 접두사로 시작하는 것에만 맞는다", () => {
		expect(matchesPattern('ecr:*', 'ecr:PutImage')).toBe(true);
		expect(matchesPattern('ecr:*', 'ecs:UpdateService')).toBe(false);
	});

	it("'*' 단독은 무엇이든 맞는다", () => {
		expect(matchesPattern('*', 'anything:AtAll')).toBe(true);
		expect(matchesPattern('*', REPO)).toBe(true);
	});

	it('ARN 중간의 와일드카드가 리전·계정을 덮는다', () => {
		expect(matchesPattern('arn:aws:ecr:*:*:repository/orders-server', REPO)).toBe(true);
		expect(matchesPattern('arn:aws:ecr:*:*:repository/orders-server', `${REPO}-other`)).toBe(false);
	});

	it('ARN 접미사 와일드카드가 스택 ID를 덮는다', () => {
		const pattern = `arn:aws:cloudformation:${REG}:${ACC}:stack/orders-server-dev/*`;
		expect(matchesPattern(pattern, `arn:aws:cloudformation:${REG}:${ACC}:stack/orders-server-dev/abc123`)).toBe(true);
	});

	it("'?'는 정확히 한 글자에 대응한다", () => {
		expect(matchesPattern('ecs:Describe?ervices', 'ecs:DescribeServices')).toBe(true);
		expect(matchesPattern('ecs:Describe?ervices', 'ecs:DescribeXXervices')).toBe(false);
	});

	it('⭐ 정규식 특수문자를 문자 그대로 다룬다', () => {
		retrace(
			"'.'를 정규식 임의문자로 흘려보내면 'ecr:Put.mage'가 'ecr:PutImage'에 맞아버린다. " +
				"이스케이프를 하되 '*'와 '?'는 남겨 와일드카드로 바꿔야 한다.",
			() => {
				expect(matchesPattern('ecr:Put.mage', 'ecr:PutImage')).toBe(false);
				expect(matchesPattern('ecr:Put.mage', 'ecr:Put.mage')).toBe(true);
			},
		);
	});

	it("'*'는 콜론과 슬래시를 넘어 매칭된다", () => {
		expect(matchesPattern('arn:aws:ecs:*', SVC)).toBe(true);
	});
});

describe('conditionHolds — 조건 하나의 충족 여부', () => {
	it('StringEquals는 값이 같을 때만 충족된다', () => {
		const cond = { operator: 'StringEquals' as const, key: 'iam:PassedToService', value: 'ecs-tasks.amazonaws.com' };
		expect(conditionHolds(cond, { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' })).toBe(true);
		expect(conditionHolds(cond, { 'iam:PassedToService': 'lambda.amazonaws.com' })).toBe(false);
	});

	it('⭐ 컨텍스트에 키가 없으면 충족되지 않는다', () => {
		retrace(
			'키 부재를 "제약 없음"으로 처리하면 조건이 무력화되어, ' +
				'PassRole 같은 방어가 컨텍스트를 비우는 것만으로 뚫린다.',
			() => {
				expect(
					conditionHolds(
						{ operator: 'StringEquals', key: 'iam:PassedToService', value: 'ecs-tasks.amazonaws.com' },
						{},
					),
				).toBe(false);
			},
		);
	});

	it('StringNotEquals도 키가 없으면 충족되지 않는다', () => {
		retrace('비교할 값 자체가 없으면 "다르다"고 단정할 수 없다 — 이 과제의 규칙이다', () => {
			expect(conditionHolds({ operator: 'StringNotEquals', key: 'aws:username', value: 'root' }, {})).toBe(false);
		});
	});

	it('StringNotEquals는 값이 다를 때 충족된다', () => {
		expect(
			conditionHolds({ operator: 'StringNotEquals', key: 'aws:username', value: 'root' }, { 'aws:username': 'deployer' }),
		).toBe(true);
	});

	it('ArnEquals는 정확 비교, ArnLike는 와일드카드를 허용한다', () => {
		expect(conditionHolds({ operator: 'ArnEquals', key: 'ecs:cluster', value: CLUSTER }, { 'ecs:cluster': CLUSTER })).toBe(true);
		expect(
			conditionHolds({ operator: 'ArnEquals', key: 'ecs:cluster', value: CLUSTER }, { 'ecs:cluster': `${CLUSTER}-other` }),
		).toBe(false);
		expect(
			conditionHolds(
				{ operator: 'ArnLike', key: 'ecs:cluster', value: `arn:aws:ecs:${REG}:${ACC}:cluster/*` },
				{ 'ecs:cluster': CLUSTER },
			),
		).toBe(true);
	});
});

describe('evaluate — 정책 평가', () => {
	const simple: Statement[] = [{ sid: 'EcrPushRepo', effect: 'Allow', actions: ['ecr:PutImage'], resources: [REPO] }];

	it('매칭되는 Allow가 있으면 허용한다', () => {
		expect(evaluate(simple, { action: 'ecr:PutImage', resource: REPO })).toBe('Allow');
	});

	it('액션이 목록에 없으면 암묵적 거부', () => {
		expect(evaluate(simple, { action: 'ecr:DeleteRepository', resource: REPO })).toBe('Deny');
	});

	it('리소스가 다르면 암묵적 거부', () => {
		expect(evaluate(simple, { action: 'ecr:PutImage', resource: `arn:aws:ecr:${REG}:${ACC}:repository/other` })).toBe('Deny');
	});

	it('빈 정책은 아무것도 허용하지 않는다', () => {
		expect(evaluate([], { action: 'ecr:PutImage', resource: REPO })).toBe('Deny');
	});

	it('액션 이름은 대소문자를 구분하지 않는다', () => {
		retrace('IAM은 액션 이름의 대소문자를 구분하지 않는다. 리소스 ARN은 구분한다', () => {
			expect(evaluate(simple, { action: 'ECR:putimage', resource: REPO })).toBe('Allow');
		});
	});

	describe('Deny 우선', () => {
		const allowThenDeny: Statement[] = [
			{ effect: 'Allow', actions: ['ecs:*'], resources: ['*'] },
			{ effect: 'Deny', actions: ['ecs:DeleteService'], resources: ['*'] },
		];
		const denyThenAllow: Statement[] = [
			{ effect: 'Deny', actions: ['ecs:DeleteService'], resources: ['*'] },
			{ effect: 'Allow', actions: ['ecs:*'], resources: ['*'] },
		];

		it('⭐ 순서와 무관하게 Deny가 이긴다', () => {
			retrace(
				'첫 매칭에서 멈추는 구현은 Deny가 뒤에 있을 때 잘못 허용한다. ' +
					'IAM 평가는 순서 개념이 없다 — 모든 문장을 보고 Deny가 하나라도 있으면 거부다.',
				() => {
					expect(evaluate(allowThenDeny, { action: 'ecs:DeleteService', resource: SVC })).toBe('Deny');
					expect(evaluate(denyThenAllow, { action: 'ecs:DeleteService', resource: SVC })).toBe('Deny');
				},
			);
		});

		it('Deny에 걸리지 않는 액션은 허용된다', () => {
			expect(evaluate(allowThenDeny, { action: 'ecs:UpdateService', resource: SVC })).toBe('Allow');
		});
	});

	describe('조건이 붙은 문장', () => {
		const conditional: Statement[] = [
			{
				sid: 'EcsServiceDeploy',
				effect: 'Allow',
				actions: ['ecs:UpdateService'],
				resources: [SVC],
				conditions: [{ operator: 'ArnEquals', key: 'ecs:cluster', value: CLUSTER }],
			},
		];

		it('조건이 충족되면 허용한다', () => {
			expect(evaluate(conditional, { action: 'ecs:UpdateService', resource: SVC, context: { 'ecs:cluster': CLUSTER } })).toBe('Allow');
		});

		it('조건이 충족되지 않으면 그 문장이 적용되지 않아 거부된다', () => {
			expect(
				evaluate(conditional, {
					action: 'ecs:UpdateService',
					resource: SVC,
					context: { 'ecs:cluster': `arn:aws:ecs:${REG}:${ACC}:cluster/other-dev` },
				}),
			).toBe('Deny');
		});

		it('컨텍스트를 아예 주지 않아도 터지지 않고 거부한다', () => {
			retrace('context가 undefined일 때 빈 객체로 다루는지 확인하는 항목', () => {
				expect(evaluate(conditional, { action: 'ecs:UpdateService', resource: SVC })).toBe('Deny');
			});
		});

		it('조건이 여러 개면 모두 충족돼야 한다 (AND)', () => {
			const multi: Statement[] = [
				{
					effect: 'Allow',
					actions: ['ecs:UpdateService'],
					resources: [SVC],
					conditions: [
						{ operator: 'ArnEquals', key: 'ecs:cluster', value: CLUSTER },
						{ operator: 'StringEquals', key: 'aws:RequestedRegion', value: REG },
					],
				},
			];
			expect(
				evaluate(multi, { action: 'ecs:UpdateService', resource: SVC, context: { 'ecs:cluster': CLUSTER, 'aws:RequestedRegion': REG } }),
			).toBe('Allow');
			expect(
				evaluate(multi, {
					action: 'ecs:UpdateService',
					resource: SVC,
					context: { 'ecs:cluster': CLUSTER, 'aws:RequestedRegion': 'us-east-1' },
				}),
			).toBe('Deny');
		});
	});
});

describe('PassRole — 권한 상승을 막는 두 겹', () => {
	const passRole: Statement[] = [
		{
			sid: 'PassTaskRoles',
			effect: 'Allow',
			actions: ['iam:PassRole'],
			resources: [EXEC_ROLE, TASK_ROLE],
			conditions: [{ operator: 'StringEquals', key: 'iam:PassedToService', value: 'ecs-tasks.amazonaws.com' }],
		},
	];
	const toEcs = { 'iam:PassedToService': 'ecs-tasks.amazonaws.com' };

	it('허용된 두 롤을 ECS로 전달할 수 있다', () => {
		expect(evaluate(passRole, { action: 'iam:PassRole', resource: TASK_ROLE, context: toEcs })).toBe('Allow');
		expect(evaluate(passRole, { action: 'iam:PassRole', resource: EXEC_ROLE, context: toEcs })).toBe('Allow');
	});

	it('⭐ 목록에 없는 롤(관리자 롤)은 전달할 수 없다 — 첫째 겹', () => {
		retrace('Resource 한정이 없으면 파이프라인이 관리자 롤로 태스크를 돌려 권한을 우회 획득한다', () => {
			expect(
				evaluate(passRole, { action: 'iam:PassRole', resource: `arn:aws:iam::${ACC}:role/AdministratorRole`, context: toEcs }),
			).toBe('Deny');
		});
	});

	it('⭐ 허용된 롤이라도 Lambda로는 전달할 수 없다 — 둘째 겹', () => {
		retrace(
			'iam:PassedToService 조건이 없으면 같은 롤을 Lambda·EC2에도 넘길 수 있어 ' +
				'ECS 밖에서 그 권한을 쓰는 경로가 남는다.',
			() => {
				expect(
					evaluate(passRole, {
						action: 'iam:PassRole',
						resource: TASK_ROLE,
						context: { 'iam:PassedToService': 'lambda.amazonaws.com' },
					}),
				).toBe('Deny');
			},
		);
	});

	it('전달 대상 서비스를 밝히지 않으면 거부된다', () => {
		expect(evaluate(passRole, { action: 'iam:PassRole', resource: TASK_ROLE })).toBe('Deny');
	});
});

describe('배포 롤 전체로 실제 요청 판정', () => {
	const deployRole: Statement[] = [
		{ sid: 'EcrAuth', effect: 'Allow', actions: ['ecr:GetAuthorizationToken'], resources: ['*'] },
		{
			sid: 'EcrPushRepo',
			effect: 'Allow',
			actions: ['ecr:PutImage', 'ecr:InitiateLayerUpload', 'ecr:UploadLayerPart', 'ecr:CompleteLayerUpload'],
			resources: [REPO],
		},
		{ sid: 'EcsTaskDefRegister', effect: 'Allow', actions: ['ecs:RegisterTaskDefinition', 'ecs:DescribeTaskDefinition'], resources: ['*'] },
		{
			sid: 'EcsServiceDeploy',
			effect: 'Allow',
			actions: ['ecs:UpdateService', 'ecs:DescribeServices'],
			resources: [SVC],
			conditions: [{ operator: 'ArnEquals', key: 'ecs:cluster', value: CLUSTER }],
		},
	];

	it('배포에 필요한 호출은 모두 허용된다', () => {
		expect(evaluate(deployRole, { action: 'ecr:GetAuthorizationToken', resource: '*' })).toBe('Allow');
		expect(evaluate(deployRole, { action: 'ecr:PutImage', resource: REPO })).toBe('Allow');
		expect(evaluate(deployRole, { action: 'ecs:RegisterTaskDefinition', resource: '*' })).toBe('Allow');
		expect(evaluate(deployRole, { action: 'ecs:UpdateService', resource: SVC, context: { 'ecs:cluster': CLUSTER } })).toBe('Allow');
	});

	it('범위를 벗어난 호출은 모두 거부된다', () => {
		retrace('최소 권한이 실제로 좁혀졌는지 확인하는 항목', () => {
			// 다른 리포지토리
			expect(evaluate(deployRole, { action: 'ecr:PutImage', resource: `arn:aws:ecr:${REG}:${ACC}:repository/other-server` })).toBe('Deny');
			// 리포지토리 삭제 (액션 목록에 없다)
			expect(evaluate(deployRole, { action: 'ecr:DeleteRepository', resource: REPO })).toBe('Deny');
			// 다른 클러스터의 서비스
			expect(
				evaluate(deployRole, {
					action: 'ecs:UpdateService',
					resource: `arn:aws:ecs:${REG}:${ACC}:service/other-dev/other-server-dev`,
					context: { 'ecs:cluster': `arn:aws:ecs:${REG}:${ACC}:cluster/other-dev` },
				}),
			).toBe('Deny');
			// 서비스 삭제
			expect(evaluate(deployRole, { action: 'ecs:DeleteService', resource: SVC, context: { 'ecs:cluster': CLUSTER } })).toBe('Deny');
		});
	});
});
