# Loop Progress — 조종석

> **13장**: 에이전트는 잊지만 파일은 기억한다. 이 파일이 없으면 매 틱이 백지에서 시작한다.
> **18장**: PROGRESS.md는 창고가 아니라 **조종석**이다. 다음 행동을 정하는 데 필요한 것만 둔다.
> 단순 기록은 `state/journal.md`(히스토리)로 내린다. 이 파일이 끝없이 커지면 쓸모가 없어진다.

PM이 매 틱 끝에 갱신한다. 방향은 `VISION.md`, 작업 목록은 `backlog/BACKLOG.md`, 여기는 **지금 상태**.

---

## Current State — 지금 상태
- **Status**: Bootstrapping (엔진 구축 중, 앱 미지정)
- **Main objective**: 디렉터의 첫 브리프를 받아 앱 개발을 시작한다
- **Current focus**: Discord 봇 토큰 설정 대기 — 이게 없으면 디렉터와 대화할 수 없다
- **Last updated**: 2026-07-16

## Last Run — 지난 실행
- **Date**: 2026-07-16 (Tick 0, 부트스트랩)
- **Summary**: 루프 엔진 구축. 팀 에이전트 7종, 품질 루프, 2단계 Gate, 방향 문서, 상태 파일, Discord 채널 포팅.
- **Output produced**: `VISION.md`, `gate/gate.ps1`, `.claude/workflows/quality-loop.js`,
  `.claude/skills/tick/SKILL.md`, `.claude/agents/*`, `backlog/BACKLOG.md`, 이 파일

## Open Items — 아직 열려 있는 항목
- 앱 프로젝트 미지정. `VISION.md` 2절(현재 프로젝트) 비어 있음.

## Blockers — 막힌 것
- **Discord 봇 토큰 없음** (`.discord/config.json` 미생성). 디렉터에게 보고할 수단이 없다.
  → 디렉터가 loop_engine 전용 봇을 만들고 토큰/채널 ID를 넣어야 루프가 돈다.

## Needs Human Review — 사람이 봐야 할 것
- **홈 폴더(`C:\Users\user`)가 통째로 git 저장소로 초기화돼 있음** (커밋 0, 추적 0, `.git` 41MB).
  loop_engine은 자체 저장소로 분리해 회피했지만, 홈 저장소 자체는 손대지 않고 남겨둠.
  다른 프로젝트에서 `git add -A`를 실행하면 홈 폴더 전체를 삼킬 수 있어 위험하다. 디렉터 판단 필요.
- **95점 Gate의 성격**: LLM이 매긴 점수는 본질적으로 의견이다. 기계 Gate와 결합했고 기준표를
  미리 고정했지만, 이 한계는 사라지지 않는다. `VISION.md` 3절에 명시해 둠.

## Next Run Should — 다음 실행이 할 일
1. `.discord/config.json` 존재 확인. 없으면 아무것도 하지 말고 대기(디렉터에게 이미 요청됨).
2. 있으면 `.discord/incoming.log`에서 첫 브리프를 찾는다.
3. 브리프가 있으면: 앱 폴더 생성 → 스택 결정 → `VISION.md` 2~3절 작성 → 디렉터 승인 요청.
4. 브리프가 없으면 idle. 일을 만들어내지 말 것.

## Decisions Made — 내려진 결정
- 2026-07-16 **구현자는 1명, 심사는 다중.** 구현자를 병렬로 경쟁시키면 worktree 격리 + 병합
  단계가 필요한데, 코드 작업에서는 비용이 이득보다 크다. 레버리지는 Gate에 있지 구현자 경쟁에 없다.
  (24장 Tangled Loop는 병렬 구현자를 쓸 때만 해당 — 지금 구조에는 발생하지 않는다.)
- 2026-07-16 **explore 모드는 파일을 쓰지 않는다.** 기획/설계는 3안을 병렬 생성하지만 전부
  텍스트로만 반환하고 PM이 승자를 기록한다. 그래서 worktree 없이도 충돌이 없다.
- 2026-07-16 **승인 대기는 팀을 멈추지 않는다.** `awaiting-approval`은 그 **작업**만 멈추고,
  루프는 다음 `ready` 작업으로 넘어간다. 승인 게이트와 자율 루프를 양립시키는 유일한 규칙.
- 2026-07-16 **Gate는 2단계.** 기계 Gate(객관 신호) 통과 후에만 기준표 채점(95점). 깨진 빌드는
  채점하지 않는다. 29장의 Nodding Loop 방지.

## Do Not Repeat — 다시 하지 말 것
> 18장: 이미 실패한 시도를 적어두지 않으면 다음 실행이 같은 시도를 또 한다.

- **`loop_engine`에서 `git add -A`를 하기 전에 `git rev-parse --show-toplevel`을 확인하지 말 것 —
  이제 자체 저장소이므로 안전하다.** 단, **홈 폴더(`C:\Users\user`)에서는 절대 `git add` 금지.**
  (2026-07-16: 최초 커밋 시도가 홈 폴더 전체를 인덱싱하려다 실패했음)
- **Git Bash에서 `grep -P` 사용 금지.** 이 PC의 로케일에서 "grep: -P supports only unibyte and
  UTF-8 locales"로 실패한다. node나 `Select-String`을 쓸 것.
- **Git Bash 경로(`/c/...`)를 node에 인자로 넘기지 말 것.** node가 `C:\c\...`로 해석해 ENOENT.
  해당 폴더로 `cd` 후 상대 경로를 쓰거나 Windows 경로(`C:\...`)로 넘길 것.
- **wikidocs 본문은 WebFetch로 못 가져온다(403).** 브라우저 User-Agent를 붙인 `curl`을 쓸 것.
  본문은 정적 HTML 안에 있고, `마지막 편집일시` 앞 ~12000자 구간에 위치한다.

---

## 이 파일을 쓰는 규칙
- 다음 행동을 정하는 데 **필요한 것만** 둔다. 나머지는 `state/journal.md`로.
- `Do Not Repeat`과 `Needs Human Review`는 **지우지 않는다** (해결되면 해결됐다고 적고 남긴다).
- 매 틱 갱신. 갱신하지 않은 틱은 실패한 틱이다.
