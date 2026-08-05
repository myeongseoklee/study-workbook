/**
 * 과제 5-1의 참고 구현.
 *
 * 판정은 `tests/05-01-iam-policy-eval/index.test.ts`가 한다. 여기 있는 코드는
 * "정답 하나"가 아니라 "성립하는 한 예"다.
 *
 * 📍 되짚기: docs/05-iam-roles.md § 정책 문장의 네 요소 / § PassRole
 *            / docs/90-must-memorize.md 카드 21·24
 */

export type Effect = 'Allow' | 'Deny';

export interface PolicyCondition {
	operator: 'StringEquals' | 'StringNotEquals' | 'ArnEquals' | 'ArnLike';
	key: string;
	value: string;
}

export interface Statement {
	sid?: string;
	effect: Effect;
	actions: string[];
	resources: string[];
	conditions?: PolicyCondition[];
}

export interface Request {
	action: string;
	resource: string;
	context?: Record<string, string>;
}

export function matchesPattern(pattern: string, value: string): boolean {
	// 정규식 특수문자를 이스케이프한다. 단 '*'와 '?'는 목록에서 빼서 그대로 남기고,
	// 다음 단계에서 와일드카드로 변환한다. 이 순서가 뒤바뀌면 '.'가 임의 문자로
	// 동작해 'ecr:Put.mage'가 'ecr:PutImage'에 맞아버린다.
	const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
	const body = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
	return new RegExp(`^${body}$`).test(value);
}

export function conditionHolds(
	condition: PolicyCondition,
	context: Record<string, string>,
): boolean {
	const actual = context[condition.key];

	// 키가 없으면 비교할 값이 없다 → 충족되지 않은 것으로 본다.
	// 이걸 "제약 없음"으로 처리하면 조건이 무력화되어 PassRole 같은 방어가 뚫린다.
	if (actual === undefined) return false;

	switch (condition.operator) {
		case 'StringEquals':
		case 'ArnEquals':
			return actual === condition.value;
		case 'StringNotEquals':
			return actual !== condition.value;
		case 'ArnLike':
			return matchesPattern(condition.value, actual);
	}
}

/** 이 문장이 요청에 적용되는가 (액션·리소스·조건 모두 충족). */
function statementApplies(statement: Statement, request: Request): boolean {
	// IAM은 액션 이름의 대소문자를 구분하지 않는다.
	const action = request.action.toLowerCase();
	const actionOk = statement.actions.some((a) => matchesPattern(a.toLowerCase(), action));
	if (!actionOk) return false;

	// 리소스 ARN은 대소문자를 구분한다.
	const resourceOk = statement.resources.some((r) => matchesPattern(r, request.resource));
	if (!resourceOk) return false;

	// 조건은 모두 충족돼야 한다(AND).
	const context = request.context ?? {};
	return (statement.conditions ?? []).every((c) => conditionHolds(c, context));
}

export function evaluate(statements: Statement[], request: Request): Effect {
	const applicable = statements.filter((s) => statementApplies(s, request));

	// 명시적 Deny가 하나라도 있으면 순서와 무관하게 거부.
	// 첫 매칭에서 멈추면 Deny가 뒤에 있을 때 잘못 허용한다.
	if (applicable.some((s) => s.effect === 'Deny')) return 'Deny';

	// Allow가 있으면 허용, 없으면 암묵적 거부.
	return applicable.some((s) => s.effect === 'Allow') ? 'Allow' : 'Deny';
}
