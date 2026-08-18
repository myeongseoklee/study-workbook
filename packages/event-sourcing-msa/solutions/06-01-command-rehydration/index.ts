/**
 * 참고 구현 — 커맨드 패턴과 재수화.
 *
 * 판정은 tests/06-01-command-rehydration/index.test.ts가 한다.
 *
 * 📍 되짚기: docs/06-command-pattern-rehydration.md
 */

export type CartCommand =
	| { kind: 'add'; productNo: string; qty: number }
	| { kind: 'remove'; productNo: string };

export interface CartItem {
	productNo: string;
	qty: number;
}

export class Cart {
	#items: CartItem[] = [];
	#commands: CartCommand[] = [];
	/** 리플레이 중인가. 이 플래그 하나가 로그 중복을 막는다. */
	#replaying = false;

	/** 사본을 준다 — 외부가 직접 고치면 상태가 커맨드의 결과가 아니게 되고 재수화가 깨진다. */
	get items(): CartItem[] {
		return this.#items.map((i) => ({ ...i }));
	}

	/**
	 * 유일한 입구. 순서가 중요하다 — **적용을 시도하고, 성공했을 때만, 리플레이가 아닐 때만** 기록한다.
	 *
	 * 실패한 커맨드를 기록하지 않는 이유: 재수화 때 그것이 다시 시도되고 그때는 조건이
	 * 달라 성공할 수도 있다. 그러면 원본과 복원본의 상태가 갈린다.
	 */
	on(command: CartCommand): boolean {
		const applied = this.#apply(command);
		if (applied && !this.#replaying) this.#commands.push(command);
		return applied;
	}

	/** 실제 상태 변경. 모르는 커맨드는 던지지 않고 false — 스토어에 남의 이벤트가 섞일 수 있다. */
	#apply(command: CartCommand): boolean {
		if (command.kind === 'add') {
			const found = this.#items.find((i) => i.productNo === command.productNo);
			if (found) found.qty += command.qty;
			else this.#items.push({ productNo: command.productNo, qty: command.qty });
			return true;
		}
		if (command.kind === 'remove') {
			// 불변식: 적어도 하나는 남는다. 애그리게이트 루트가 이것을 진다.
			if (this.#items.length < 2) return false;
			const at = this.#items.findIndex((i) => i.productNo === command.productNo);
			if (at === -1) return false;
			this.#items.splice(at, 1);
			return true;
		}
		return false;
	}

	/** 복사본을 넘기고 비운다. 어떻게 저장할지는 스토어의 관심사다. */
	save(): CartCommand[] {
		const dumped = [...this.#commands];
		this.#commands = [];
		return dumped;
	}

	/**
	 * 빈 객체에만 복원한다. 이미 커맨드가 쌓였으면 새 객체가 아니고, 섞으면 어느 쪽이
	 * 진실인지 알 수 없다.
	 *
	 * `finally`로 플래그를 내리는 이유: 중간에 예외가 나도 리플레이 모드가 남으면
	 * 이후 모든 커맨드가 기록되지 않아 **조용히 로그가 비는** 상태가 된다.
	 */
	restore(commands: CartCommand[]): boolean {
		if (this.#commands.length > 0) return false;
		this.#replaying = true;
		try {
			for (const c of commands) this.on(c);
		} finally {
			this.#replaying = false;
		}
		return true;
	}
}
