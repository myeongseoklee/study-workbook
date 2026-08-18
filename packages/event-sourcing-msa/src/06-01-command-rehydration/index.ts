/**
 * 과제 06-01 — 커맨드 패턴과 재수화
 *
 * 이벤트 소싱의 애그리게이트 루트는 **커맨드 패턴의 Invoker**다. 재수화가 성립하려면
 * 현재 상태가 **오직 커맨드의 적용 결과**여야 하고, 그래서 상태를 바꾸는 공개 메서드가
 * `on(command)` 하나로 좁혀진다.
 *
 * 가장 자주 깨지는 곳은 **리플레이 중에 커맨드를 다시 쌓는 것**이다.
 *
 * 명세:  tests/06-01-command-rehydration/index.test.ts ← **먼저 읽어라**
 * 판정:  pnpm test 06-01
 * 막히면: docs/06-command-pattern-rehydration.md
 */

export type CartCommand =
	| { kind: 'add'; productNo: string; qty: number }
	| { kind: 'remove'; productNo: string };

export interface CartItem {
	productNo: string;
	qty: number;
}

export class Cart {
	/**
	 * 현재 아이템. 읽기 전용으로 노출한다 — 외부가 직접 고치면 재수화가 깨진다
	 * (상태가 커맨드의 결과가 아니게 된다).
	 */
	get items(): CartItem[] {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: items');
	}

	/**
	 * 커맨드를 적용한다. 적용됐으면 `true`.
	 *
	 * 힌트 셋:
	 *   ① 모르는 커맨드는 **던지지 말고** `false` — 스토어에 남의 이벤트가 섞일 수 있다
	 *   ② 불변식(`remove`는 2개 이상일 때만)을 여기서 지킨다. 실패한 커맨드는 **기록하지 않는다**
	 *   ③ **리플레이 중이면 기록하지 않는다.** 이미 로그에 있는 것을 또 쌓으면 중복 저장된다
	 */
	on(command: CartCommand): boolean {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: on');
	}

	/**
	 * 쌓인 커맨드를 넘기고 **내부를 비운다**(플러시). 상태는 바꾸지 않는다.
	 *
	 * 힌트: 넘기는 것은 **복사본**이다. 호출자가 그 배열을 고쳐도 내부에 영향이 없어야 한다.
	 */
	save(): CartCommand[] {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: save');
	}

	/**
	 * 커맨드 목록으로 상태를 복원한다. 성공하면 `true`.
	 *
	 * 힌트: **빈 객체에만 복원할 수 있다.** 이미 커맨드가 쌓여 있으면 새 객체가 아니므로
	 *       `false`를 준다(던지지 않는다). 복원 중에는 리플레이 모드여야 하고,
	 *       끝나면 반드시 꺼야 한다.
	 */
	restore(commands: CartCommand[]): boolean {
		// 🎯 TODO: 구현하라
		throw new Error('TODO: restore');
	}
}
