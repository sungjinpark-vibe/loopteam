# app_in_toss — 가계부 마을 (토스 인앱 웹게임)

- 스펙·설계: `docs/spec/` (MVP-SPEC.md + ADDENDUM-01~08). 지도 기하는 **ADDENDUM-08이 최신** — 20×20 고정 맵, 공원/호수 건축 불가 지형, 1×1~2×2 다중 칸 건물. ADDENDUM-06/07의 8컬럼·블록 마스킹 체계는 여기서 대체됨(계단식 톤·명당·들쭉날쭉 외곽은 새 격자에 재적용).
- 플레이 가이드: `docs/PLAY_GUIDE.md` · 실행: 루트 `play.bat`
- QA 증거(스크린샷·검증): `docs/qa/`
- 팀 프로세스·백로그: `../state/PROGRESS.md` (loop_engine)
- 상시 결정: F16(월말 정산·기념비)은 사용자 승인 기능 — 삭제 금지. 실결제(캐시충전)는 스텁 유지, 토스 결제 연동 전까지 성공 경로 금지.
- **토큰 절약 (파일럿 2026-08-11)**: 코드 탐색·영향 분석 전에 `code-review-graph` MCP(ToolSearch로 로드)로 blast-radius를 먼저 조회하고, 그래프가 짚어준 파일만 읽어라. 넓은 Glob/Grep 탐색은 그래프 조회 실패 시에만.
