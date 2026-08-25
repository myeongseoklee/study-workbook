/**
 * 과제 05-01 참고 구현 — 전제 부정 계산기
 *
 * 📍 되짚기: docs/05-cutting-the-cable.md — "전제를 끊었을 때의 세 답"
 *
 * 이 구현에서 판단이 갈린 곳은 셋이다.
 *
 * **①** 지지 경로를 **OR of AND**로 모델링한 것이 전부다. 전제를 한 덩어리
 * 집합으로 두면 코드는 짧아지지만 "다른 경로로 결론이 나온다"는 세 번째 답을
 * 표현할 수 없게 된다. 05장이 그 답을 가장 값진 것이라고 한 이유가 여기서
 * 드러난다 — 그 답이 표현되지 않는 모델에서는 **모든 전제가 급소로 보인다.**
 *
 * **②** 최소성 검사를 "원소 하나씩 빼 봐서 여전히 무너지면 최소가 아니다"로
 * 적었다. 이것으로 충분한 이유는 **무너뜨림이 단조**이기 때문이다 — 전제를
 * 더 끊으면 결론은 더 잘 무너지지 덜 무너지지 않는다. 단조성 덕분에 국소
 * 최소성이 곧 전역 최소성이 되고, 이미 찾은 조합들과 일일이 대조할 필요가
 * 없어진다. 조합론 문제에서 단조성을 확인하고 넘어가는 것이 대개 가장 큰
 * 단순화다.
 *
 * **③** `loadBearing`을 `minimalBreakingSets`로 구현하지 않고 따로 두었다.
 * 크기 1의 최소 조합이 곧 단독 급소이므로 하나로 합칠 수 있지만, 그러면 값싼
 * 질문(전제 하나씩만 끊어 본다, 선형)에 비싼 계산(부분집합 열거, 지수)을
 * 치르게 된다. 실무 절차에서도 먼저 하는 것은 단독 부정이다.
 */

export interface Argument {
	conclusion: string;
	paths: string[][];
}

/** 지지 경로가 하나도 없는 논증은 계산 대상이 아니다. */
function assertSupported(argument: Argument): void {
	if (argument.paths.length === 0) {
		throw new RangeError(
			`지지 경로가 없는 논증은 결론을 지지하지 않는다 (결론: ${argument.conclusion})`,
		);
	}
}

export function holdsWithout(argument: Argument, negated: string[]): boolean {
	assertSupported(argument);
	const dead = new Set(negated);
	// 부정된 전제를 하나도 쓰지 않는 경로가 남아 있으면 결론은 선다.
	// 빈 경로는 every가 자동으로 true를 주므로 별도 분기가 필요 없다.
	return argument.paths.some((path) => path.every((premise) => !dead.has(premise)));
}

/** 논증에 등장하는 모든 전제. 중복은 접는다. */
function allPremises(argument: Argument): string[] {
	return [...new Set(argument.paths.flat())];
}

export function loadBearing(argument: Argument): string[] {
	assertSupported(argument);
	return allPremises(argument)
		.filter((premise) => !holdsWithout(argument, [premise]))
		.sort();
}

/** 정렬된 배열에서 크기 `size`의 조합을 전부 만든다. */
function combinations(pool: string[], size: number): string[][] {
	if (size === 0) return [[]];
	if (size > pool.length) return [];

	const result: string[][] = [];
	const walk = (start: number, picked: string[]): void => {
		if (picked.length === size) {
			result.push([...picked]);
			return;
		}
		// 남은 자리보다 남은 후보가 적으면 더 볼 필요가 없다.
		for (let i = start; i <= pool.length - (size - picked.length); i += 1) {
			picked.push(pool[i]!);
			walk(i + 1, picked);
			picked.pop();
		}
	};
	walk(0, []);
	return result;
}

export function minimalBreakingSets(argument: Argument, maxSize: number): string[][] {
	assertSupported(argument);
	if (!Number.isInteger(maxSize) || maxSize < 0) {
		throw new RangeError(`maxSize는 0 이상의 정수여야 한다 (받은 값: ${maxSize})`);
	}

	// pool을 미리 정렬해 두면 combinations가 내놓는 각 조합이 이미 사전순이고,
	// 같은 크기 안의 조합들도 사전순으로 나온다. 뒤에서 다시 정렬할 필요가 없다.
	const pool = allPremises(argument).sort();
	const found: string[][] = [];

	// 크기를 1부터 올려 가며 훑으므로 결과가 자연히 크기 오름차순이 된다.
	for (let size = 1; size <= maxSize; size += 1) {
		for (const candidate of combinations(pool, size)) {
			if (holdsWithout(argument, candidate)) continue;

			// 최소성: 하나라도 빼면 결론이 다시 서야 한다. 무너뜨림이 단조이므로
			// 이 국소 검사만으로 전역 최소성이 보장된다.
			const isMinimal = candidate.every((premise) =>
				holdsWithout(
					argument,
					candidate.filter((other) => other !== premise),
				),
			);
			if (isMinimal) found.push(candidate);
		}
	}

	return found;
}
