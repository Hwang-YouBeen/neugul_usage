<p align="center">
  <img src="media/icon.png" width="128" alt="Neugul Usage 아이콘" />
</p>

# Neugul Usage

**Codex CLI와 Claude Code의 남은 사용량을 VS Code 안에서 한눈에 확인하세요.**

`/status`나 `/usage`를 매번 입력하지 않아도 상태바와 사이드바에서 5시간·주간 한도, 잔여율, 리셋 시간을 바로 볼 수 있습니다.

```text
🦝 Codex ▰▰▰▰▱▱▱▱▱▱ 38%
```

## 주요 기능

- **Codex + Claude Code 지원** — 두 CLI의 실제 rate limit 퍼센트를 표시합니다.
- **자동 전환** — 최근 사용한 에이전트를 감지해 해당 사용량을 보여줍니다.
- **두 가지 사용량 창** — 5시간 한도와 장기(주간) 한도를 함께 확인합니다.
- **리셋 카운트다운** — 다음 한도 초기화까지 남은 시간을 표시합니다.
- **상태바 + 사이드바** — 작업 흐름을 끊지 않고 빠르게 확인할 수 있습니다.
- **테마 친화적인 색상** — 잔여량에 따라 부드러운 세이지·블루·샌드·로즈 색상으로 바뀝니다.

## 빠른 시작

### Codex

별도 설정이 필요 없습니다.

1. Codex CLI에서 메시지를 한 번 실행합니다.
2. VS Code 상태바 또는 사이드바의 **Neugul Usage**를 확인합니다.

기본 경로는 `~/.codex`이며, `CODEX_HOME` 환경변수도 지원합니다.

### Claude Code

Claude Code는 최초 1회 연동이 필요합니다.

1. 명령 팔레트(`Ctrl/Cmd + Shift + P`)를 엽니다.
2. **`Neugul: Claude Code 연동`**을 실행합니다.
3. 안내를 확인하고 연동을 승인합니다.
4. Claude Code에서 메시지를 한 번 보내면 사용량이 표시됩니다.

> Claude Code 연동은 `~/.claude/settings.json`의 `statusLine`을 수정합니다. 기존 statusLine 명령은 보존해 함께 실행하며, 수정 전 설정은 `settings.json.neugul-backup`으로 백업합니다.

## 표시 모드

기본값은 **자동**입니다. 최근 갱신된 CLI를 활성 에이전트로 선택합니다.

명령 팔레트에서 **`Neugul: 에이전트 선택`**을 실행하면 다음 모드로 변경할 수 있습니다.

- 자동
- Codex 고정
- Claude Code 고정
- 둘 다 보기

## 지원 범위

| | Codex | Claude Code |
| --- | --- | --- |
| 데이터 | CLI가 기록한 실제 rate limit | statusLine에 전달된 실제 rate limit |
| 최초 설정 | 필요 없음 | 연동 1회 필요 |
| 5시간 창 | 지원 | 지원 |
| 주간 창 | 지원 | 지원 |

Claude Code의 rate limit 정보는 **Claude.ai Pro/Max 등 구독 세션**에서 첫 응답 이후 제공됩니다. API Key 기반 세션이나 해당 정보를 제공하지 않는 버전에서는 잔여 구독 한도를 표시할 수 없습니다.

## 개인정보 보호

- 외부 서버로 데이터를 전송하지 않습니다.
- 별도의 네트워크 요청을 하지 않습니다.
- 대화 내용이나 프롬프트를 저장하지 않습니다.
- 퍼센트, 리셋 시각, 플랜 이름처럼 게이지 표시에 필요한 정보만 사용합니다.

## 주요 설정

VS Code 설정에서 `Neugul Usage`를 검색하세요.

| 설정 | 기본값 | 설명 |
| --- | --- | --- |
| `neugulUsage.agent` | `auto` | 표시할 에이전트 |
| `neugulUsage.primaryWindow` | `fiveHour` | 상태바와 대표 색상의 기준 창 |
| `neugulUsage.statusBar.enabled` | `true` | 상태바 게이지 표시 여부 |
| `neugulUsage.refreshIntervalMs` | `5000` | 사용량 확인 주기(ms) |
| `neugulUsage.codex.homeDir` | 비움 | 사용자 지정 Codex 홈 경로 |
| `neugulUsage.claude.configDir` | 비움 | 사용자 지정 Claude 설정 경로 |

## 문제 해결

**Codex 사용량이 보이지 않아요**

- Codex CLI에서 메시지를 한 번 실행해 최신 세션을 만드세요.
- 사용자 지정 경로를 쓴다면 `neugulUsage.codex.homeDir`을 확인하세요.

**Claude Code 사용량이 보이지 않아요**

- `Neugul: Claude Code 연동`을 먼저 실행하세요.
- 연동 후 Claude Code에서 메시지를 한 번 보내세요.
- API Key 세션은 구독 한도 퍼센트를 제공하지 않을 수 있습니다.

문제가 계속되면 [GitHub Issues](https://github.com/Hwang-YouBeen/neugul_usage/issues)에 환경과 증상을 남겨 주세요.

## 개발

```bash
git clone https://github.com/Hwang-YouBeen/neugul_usage.git
cd neugul_usage
npm install
npm run typecheck
npm test
npm run compile
```

VS Code에서 `F5`를 누르면 Extension Development Host로 실행할 수 있습니다. 자세한 설계는 [`docs/SPEC.md`](docs/SPEC.md)를 참고하세요.

## 안내

Neugul Usage는 OpenAI 또는 Anthropic이 제작하거나 보증한 제품이 아닌 비공식 오픈소스 확장입니다.

라이선스: [MIT](LICENSE)
