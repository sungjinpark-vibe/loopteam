# Loop Progress — 조종석

> **13장**: 에이전트는 잊지만 파일은 기억한다. 이 파일이 없으면 매 틱이 백지에서 시작한다.
> **18장**: PROGRESS.md는 창고가 아니라 **조종석**이다. 다음 행동을 정하는 데 필요한 것만 둔다.
> 단순 기록은 `state/journal.md`(히스토리)로 내린다. 이 파일이 끝없이 커지면 쓸모가 없어진다.

PM이 매 틱 끝에 갱신한다. 방향은 `VISION.md`, 작업 목록은 `backlog/BACKLOG.md`, 여기는 **지금 상태**.

---

## Current State — 지금 상태
- **Status**: Ready — 채널 연결됨, 첫 브리프 대기 중
- **Main objective**: 디렉터의 첫 브리프를 받아 앱 개발을 시작한다
- **Current focus**: 디렉터의 첫 브리프(만들 앱/컨셉/방향) 대기. 브리프 없으면 일을 만들지 말 것.
- **Last updated**: 2026-07-16

## Last Run — 지난 실행
- **Date**: 2026-07-16 (Tick 0, 부트스트랩)
- **Summary**: 루프 엔진 구축. 팀 에이전트 7종, 품질 루프, 2단계 Gate, 방향 문서, 상태 파일, Discord 채널 포팅.
- **Output produced**: `VISION.md`, `gate/gate.ps1`, `.claude/workflows/quality-loop.js`,
  `.claude/skills/tick/SKILL.md`, `.claude/agents/*`, `backlog/BACKLOG.md`, 이 파일

## Open Items — 아직 열려 있는 항목
- 앱 프로젝트 미지정. `VISION.md` 2절(현재 프로젝트) 비어 있음.

## Blockers — 막힌 것
- 없음. 채널 연결 완료, 원격 저장소 푸시 완료. 디렉터의 첫 브리프만 기다리는 중.

## Needs Human Review — 사람이 봐야 할 것
- ~~app-dev-team의 커서 버그~~ → **디렉터가 2026-07-16 "건드리지 마"로 결정. 종결.**
  (아래 Do Not Repeat 참조 — 다시 제안하지 말 것)
- **홈 폴더(`C:\Users\user`)가 통째로 git 저장소로 초기화돼 있음** (커밋 0, 추적 0, `.git` 41MB).
  loop_engine은 자체 저장소로 분리해 회피했지만, 홈 저장소 자체는 손대지 않고 남겨둠.
  다른 프로젝트에서 `git add -A`를 실행하면 홈 폴더 전체를 삼킬 수 있어 위험하다. 디렉터 판단 필요.
- **봇 토큰이 대화 기록에 노출됨** (2026-07-16, 디렉터가 채팅으로 전달). 개인 봇이라 위험도는
  낮지만, 신경 쓰이면 Developer Portal에서 Reset Token 후 `config.json`에 직접 넣으면 된다.
- **95점 Gate의 성격**: LLM이 매긴 점수는 본질적으로 의견이다. 기계 Gate와 결합했고 기준표를
  미리 고정했지만, 이 한계는 사라지지 않는다. `VISION.md` 3절에 명시해 둠.

## Next Run Should — 다음 실행이 할 일
0. **전제**: `/tick`과 팀 에이전트(`loop-scout` 등)는 **이 파일들이 존재한 뒤에 시작된 Claude Code
   세션에서만** 쓸 수 있다. Claude Code는 세션 시작 시 `.claude/agents/`·`.claude/skills/`를 읽고,
   이후 추가된 것은 재시작 전까지 인식하지 못한다. (2026-07-16 확인: 구축 직후 `loop-scout` 호출이
   "Agent type not found"로 실패했다.) 첫 틱은 반드시 **재시작 후** 돌릴 것.
1. `.discord/incoming.log`에서 첫 브리프를 찾는다. (채널 연결 완료 — 봇 `Loop_team`, `#loop-team`)
2. 브리프가 있으면: 앱 폴더 생성 → `git init` → 루트 `.gitignore`에 추가 → 스택 결정 →
   `VISION.md` 2~3절(프로젝트 + **기준표**) 작성 → 디렉터 승인 요청 → T001(explore, planner) 개설.
3. 브리프가 없으면 **idle**. 일을 만들어내지 말 것.
4. 엔진 저장소에 변경이 있으면 커밋 + 푸시 (`origin/main` 추적 설정 완료).

## Decisions Made — 내려진 결정
- 2026-07-16 **Discord 커서 버그 수정** (`le-daemon.ps1`). 봇 자기 메시지를 `continue`로 건너뛰기
  **전에** `$lastId`를 갱신하도록 순서를 바꿨다. 원래 코드는 자기 메시지가 커서를 전진시키지
  못했고, `?after=<id>&limit=100`은 커서 이후 **가장 오래된** 100개를 돌려주므로, 보고가 답장보다
  훨씬 많은 자율 루프에서는 창이 자기 보고로 가득 차 디렉터 메시지를 영영 못 읽는다. 검증:
  수정 후 last-id가 0 → 실제 메시지 ID로 전진하는 것 확인.
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
- **`loop_engine/` 밖의 저장소를 수정하려 하지 말 것.** 2026-07-16에 app-dev-team의 같은 커서
  버그를 고쳐주겠다고 제안했다가 디렉터가 **"건드리지 마"**로 명확히 거절했다. 다시 제안하지 말 것.
  다른 프로젝트의 문제는 발견하면 **기록만 하고 넘어간다** (`VISION.md` 4절 경계와 같은 취지).

---

## 이 파일을 쓰는 규칙
- 다음 행동을 정하는 데 **필요한 것만** 둔다. 나머지는 `state/journal.md`로.
- `Do Not Repeat`과 `Needs Human Review`는 **지우지 않는다** (해결되면 해결됐다고 적고 남긴다).
- 매 틱 갱신. 갱신하지 않은 틱은 실패한 틱이다.
