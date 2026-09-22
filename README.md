# Neugul Usage

Codex CLI와 Claude Code의 **남은 사용량**을 VS Code 상태바와 사이드바에서 바로 보여주는 확장입니다.

두 CLI 모두 구독 rate limit(5시간 창 + 주간 창)으로 동작합니다. 한도를 확인하려면 보통 Codex에서는 `/status`, Claude Code에서는 `/usage`를 직접 입력해야 하고, 작업 중에는 얼마나 남았는지 놓치기 쉽습니다. Neugul Usage는 에디터를 떠나지 않고, 서버가 보고한 **실측 퍼센트**를 게이지로 붙잡아 둡니다.

OpenAI, Anthropic과 무관한 비공식 확장입니다.

## 하는 일

- 현재 쓰고 있는 에이전트를 자동으로 골라, 그 에이전트의 잔여량만 강조합니다.
- 5시간 창과 장기(주간) 창을 함께 보여주고, 리셋까지 남은 시간을 카운트다운합니다.
- 상태바에는 너구리와 블록 게이지가, 사이드바에는 잔여율에 따라 색이 바뀌는 바가 있습니다.

```
🦝 Codex ▰▰▰▰▱▱▱▱▱▱ 38%
```

## 색

게이지는 VS Code 차트 원색 대신, 사이드바 배경과 섞은 탁한 색을 씁니다.

| 잔여 | 기분 | 5시간 게이지 |
| --- | --- | --- |
| 90–100% | 아주 좋음 | 세이지 그린 |
| 65–89% | 좋음 | 세이지 그린 |
| 40–64% | 보통 | 슬레이트 블루 |
| 20–39% | 불안 | 샌드 |
| 5–19% | 위험 | 클레이 |
| 0–4% | 탈진 | 더스티 로즈 |

장기 창은 회색으로 고정입니다. 상태바는 테마 기본 색을 유지하고, 경고/에러 배경은 쓰지 않습니다.

## 설치

Marketplace 게시 전이라, 지금은 이 저장소에서 직접 실행합니다.

```bash
git clone https://github.com/Hwang-YouBeen/neugul_usage.git
cd neugul_usage
npm install
npm run compile
```

VS Code 또는 Cursor에서 이 폴더를 연 뒤 **F5**를 누르면 Extension Development Host가 뜹니다.

## 사용

1. Extension Development Host가 열리면 상태바에 🦝가 보입니다.
2. 사이드바의 Neugul Usage 아이콘을 누르면 패널이 열립니다.
3. **Codex**는 추가 설정 없이 최근 세션을 읽습니다. 한 번이라도 Codex를 돌린 적이 있으면 바로 값이 나옵니다.
4. **Claude Code**는 명령 팔레트에서 `Neugul: Claude Code 연동`을 한 번 실행한 뒤, Claude Code에서 메시지를 보내면 값이 생깁니다.

활성 에이전트는 기본값이 `자동`입니다. 최근에 데이터가 갱신된 쪽을 따라가며, `Neugul: 에이전트 선택`으로 Codex / Claude Code / 둘 다 보기로 고정할 수 있습니다.

## 데이터가 오는 곳

추정 토큰이 아니라, 두 CLI가 서버에서 받아 로컬에 남긴 rate limit을 읽습니다.

| | Codex | Claude Code |
| --- | --- | --- |
| 출처 | `~/.codex/sessions/**/rollout-*.jsonl`의 `token_count` 이벤트 | statusLine 브리지가 쓰는 `~/.neugul-usage/claude-usage.json` |
| 설정 | 없음. `CODEX_HOME`이 있으면 그 경로를 사용 | `Neugul: Claude Code 연동` 1회 |
| 값 | 실측 퍼센트 | 실측 퍼센트 |

Claude Code는 구독 한도를 디스크에 남기지 않고, statusLine 커맨드 stdin으로만 노출합니다. 연동 시 `~/.claude/settings.json`의 `statusLine`을 브리지 스크립트로 바꿉니다. 이미 쓰고 있던 statusLine 명령이 있으면 그대로 감싸서 실행하므로 상태줄이 사라지지 않습니다. 수정 전 파일은 `settings.json.neugul-backup`으로 백업됩니다.

네트워크 요청은 하지 않습니다. 대화 내용은 파싱하지 않고, 퍼센트·리셋 시각·플랜 이름만 사용합니다.

## 설정

`Neugul Usage` 섹션에서 바꿀 수 있습니다.

| 설정 | 기본 | 의미 |
| --- | --- | --- |
| `neugulUsage.agent` | `auto` | 표시할 에이전트 (`auto` / `codex` / `claude` / `both`) |
| `neugulUsage.primaryWindow` | `fiveHour` | 색이 따라가는 창 |
| `neugulUsage.refreshIntervalMs` | `5000` | 파일 감시가 빠질 때를 대비한 폴링 |
| `neugulUsage.statusBar.enabled` | `true` | 상태바 표시 |
| `neugulUsage.codex.homeDir` | (비움) | 비우면 `CODEX_HOME` 또는 `~/.codex` |
| `neugulUsage.claude.configDir` | (비움) | 비우면 `CLAUDE_CONFIG_DIR` 또는 `~/.claude` |

## 개발

```bash
npm install
npm run watch      # esbuild watch
npm run typecheck
npm test
```

VS Code에서 **F5** → Extension Development Host.

| 스크립트 | 설명 |
| --- | --- |
| `npm run compile` | `dist/extension.js` 1회 빌드 |
| `npm run watch` | 변경 감지 빌드 |
| `npm run package` | 배포용 minify 빌드 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | 파서·무드·꼬리 읽기 단위 테스트 |

```
src/core/      상태 저장소, 무드, 활성 에이전트 판별
src/sources/   Codex rollout / Claude 스냅샷 수집
src/bridge/    ~/.claude/settings.json 안전 편집
src/ui/        상태바, 웹뷰
bridge/        Claude Code가 실행하는 무의존 statusline 스크립트
media/         패널 스타일과 렌더러
```

`src/core/usageStore.ts`가 유일한 진실 공급원입니다. UI는 `onDidChange`로 받은 값만 그립니다.

설계 메모는 [`docs/SPEC.md`](docs/SPEC.md)에 있습니다. UI는 이후 너구리 고정 마크와 부드러운 게이지 색으로 바뀌었고, 에이전트 마스코트 SVG는 쓰지 않습니다.

## 라이선스

[MIT](LICENSE)
