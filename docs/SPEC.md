# Neugul Usage — VS Code Extension 기획서

> Codex CLI와 Claude Code의 남은 사용량(rate limit)을 게이지 바로 보여주고,
> 각 에이전트의 마스코트 캐릭터가 게이지에 맞춰 위치·표정·동작을 바꾸는 확장 프로그램.

- 문서 버전: 1.0
- 대상 독자: 이 문서만 보고 바로 구현을 시작하는 개발자
- 상태: 개발 착수 가능 (데이터 포맷 실측 검증 완료)

---

## 1. 제품 개요

### 1.1 한 줄 정의

VS Code 사이드바와 상태바에서 현재 사용 중인 코딩 에이전트(Codex / Claude Code)의
잔여 사용량을 실시간 게이지로 보여주고, 마스코트가 그 게이지에 반응하는 확장.

### 1.2 해결하는 문제

Codex와 Claude Code 모두 구독제 rate limit(5시간 창 + 주간 창)으로 동작한다.
사용자는 한도를 확인하려면 CLI 안에서 `/status`(Codex), `/usage`(Claude Code)를
직접 입력해야 하고, 작업 중에는 한도가 얼마나 남았는지 알기 어렵다.
한도에 도달하면 작업이 갑자기 중단된다.

이 확장은 **에디터를 떠나지 않고, 입력 없이, 상시** 잔여량을 보여준다.

### 1.3 핵심 차별점

기존 유사 도구(ccusage 등)는 토큰 사용량을 **추정**한다. 이 확장은 두 CLI가
서버로부터 받아 로컬에 기록하는 **실제 rate limit 퍼센트**를 읽는다.
여기에 "게이지에 반응하는 캐릭터"라는 정서적 피드백을 얹어
사용량 확인을 의무가 아닌 즐거움으로 만든다.

### 1.4 타깃 사용자

- Codex 또는 Claude Code 구독자(Plus/Pro/Max)
- 둘 다 병행 사용하며 어느 쪽 한도가 남았는지 매번 확인하는 사용자
- VS Code / Cursor / Windsurf 등 VS Code 계열 에디터 사용자

---

## 2. 요구사항

### 2.1 원본 요구사항 (사용자 정의)

| ID | 요구사항 |
| --- | --- |
| R1 | Codex 또는 Claude Code의 usage를 bar 형식으로 표시 |
| R2 | 두 에이전트 모두 지원. Codex 사용 중이면 Codex usage, Claude Code 사용 중이면 Claude Code usage 표시 |
| R3 | 각 에이전트의 캐릭터가 바 옆에서 게이지에 맞게 움직임 (100% 기분 좋음, 50% 보통, 30% 미만 기분 나쁨) |

### 2.2 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 | 대응 |
| --- | --- | --- | --- |
| FR-1 | Codex 잔여 사용량(5시간/주간)을 읽어 게이지로 표시 | P0 | R1 |
| FR-2 | Claude Code 잔여 사용량(5시간/7일)을 읽어 게이지로 표시 | P0 | R1 |
| FR-3 | 현재 활성 에이전트를 자동 판별하고, 해당 에이전트 게이지만 강조 | P0 | R2 |
| FR-4 | 자동 판별을 수동으로 고정(pin)할 수 있음 | P1 | R2 |
| FR-5 | 캐릭터가 게이지 채움 끝 위치로 이동 | P0 | R3 |
| FR-6 | 잔여율 구간에 따라 캐릭터 표정/동작이 6단계로 변화 | P0 | R3 |
| FR-7 | 상태바에 컴팩트 게이지 + 퍼센트 + 무드 아이콘 표시 | P0 | R1 |
| FR-8 | 사이드바 웹뷰에 풀 사이즈 게이지 + 캐릭터 애니메이션 | P0 | R1, R3 |
| FR-9 | 리셋까지 남은 시간 카운트다운 표시 | P1 | - |
| FR-10 | 임계값(예: 30%, 10%) 도달 시 1회 알림 | P2 | - |
| FR-11 | Claude Code 연동을 위한 브리지 스크립트 자동 설치/제거 | P0 | FR-2 |
| FR-12 | 데이터를 못 읽는 상태(미설치/미로그인/브리지 미설치)를 명확히 안내 | P0 | - |

### 2.3 비기능 요구사항 (NFR)

| ID | 요구사항 | 기준 |
| --- | --- | --- |
| NFR-1 | 확장 활성화 시간 | 200ms 이내 (`onStartupFinished` 지연 활성화) |
| NFR-2 | 유휴 시 CPU 점유 | 측정 불가 수준. 폴링 기본 5초, 파일 변경 이벤트 우선 |
| NFR-3 | 대용량 세션 파일 대응 | Codex rollout 파일은 실측 최대 **70MB**. 전체 파싱 금지, 꼬리 역방향 읽기만 |
| NFR-4 | 네트워크 | 전면 금지. 로컬 파일만 읽음 |
| NFR-5 | 개인정보 | 대화 내용 파싱·저장·전송 금지. 퍼센트/타임스탬프/플랜명만 사용 |
| NFR-6 | 크로스 플랫폼 | Windows / macOS / Linux |
| NFR-7 | 접근성 | `prefers-reduced-motion` 존중, 색상만으로 상태 구분하지 않음(텍스트 병기) |
| NFR-8 | 테마 | VS Code 테마 변수만 사용. 라이트/다크/고대비 모두 정상 |

### 2.4 범위 밖 (Non-goals)

- 비용(USD) 계산 및 청구 예측
- API Key 기반(종량제) 사용자 지원 — rate limit 개념이 다름. 미지원 안내만 표시
- 사용량 히스토리 그래프 (v2 후보)
- Codex/Claude Code 외 에이전트(Gemini CLI, Aider 등) — 어댑터 구조로 확장 가능하게만 설계

---

## 3. 데이터 소스 (핵심 · 실측 검증 완료)

이 섹션이 이 기획서의 가장 중요한 부분이다. 두 CLI에서 사용량을 얻는 방식이
완전히 다르며, 이 차이가 아키텍처를 결정한다.

### 3.1 Codex CLI — 세션 rollout 파일 직접 파싱

Codex CLI는 모든 세션을 JSONL rollout 파일로 기록하며, 서버 응답의 rate limit을
그대로 남긴다. **추가 설치나 설정 없이 바로 읽을 수 있다.**

**경로**

```
~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-<ISO8601>-<uuid>.jsonl
```

Windows 기준: `C:\Users\<user>\.codex\sessions\2026\09\22\rollout-2026-09-22T15-35-38-01a0c7d3-....jsonl`

환경변수 `CODEX_HOME`이 설정되어 있으면 `~/.codex` 대신 그 경로를 사용한다.

**대상 레코드** — `payload.type === "token_count"` 인 `event_msg` 라인.
아래는 실제 파일에서 추출한 원본이다.

```json
{
  "timestamp": "2026-09-21T23:54:44.693Z",
  "ordinal": 38,
  "type": "event_msg",
  "payload": {
    "type": "token_count",
    "info": {
      "total_token_usage": {
        "input_tokens": 140734,
        "cached_input_tokens": 79104,
        "cache_write_input_tokens": 0,
        "output_tokens": 536,
        "reasoning_output_tokens": 288,
        "total_tokens": 141270
      },
      "last_token_usage": { "...": "동일 구조" },
      "model_context_window": 258400
    },
    "rate_limits": {
      "limit_id": "codex",
      "limit_name": null,
      "primary":   { "used_percent": 1.0,  "window_minutes": 300,   "resets_at": 1790052059 },
      "secondary": { "used_percent": 61.0, "window_minutes": 10080, "resets_at": 1790238988 },
      "credits": { "has_credits": false, "unlimited": false, "balance": "0" },
      "individual_limit": null,
      "spend_control_reached": null,
      "plan_type": "plus",
      "rate_limit_reached_type": null
    }
  }
}
```

**필드 해석**

| 필드 | 의미 |
| --- | --- |
| `rate_limits.primary.used_percent` | 5시간 창 **사용된** 비율 (0–100). `window_minutes: 300` |
| `rate_limits.secondary.used_percent` | 주간 창 사용 비율. `window_minutes: 10080` (7일) |
| `resets_at` | **Unix epoch 초** (밀리초 아님) |
| `plan_type` | `"plus"`, `"pro"`, `"team"` 등 |
| `rate_limit_reached_type` | non-null이면 이미 한도 도달 |
| `credits.unlimited` | true면 게이지 대신 "무제한" 표시 |
| `info.model_context_window` | 컨텍스트 창 크기. 게이지와 별개의 보조 정보 |

> **잔여율 = `100 - used_percent`**. 화면에 표시하는 게이지는 항상 잔여율이다.
> (사용자 요구 "100% 기분 좋음"은 "많이 남았을 때 기분 좋음"을 의미)

**읽기 전략 — 반드시 준수**

1. `~/.codex/sessions/` 하위에서 **오늘과 어제 날짜 디렉터리만** 스캔한다 (전체 재귀 금지).
2. 그 안의 `.jsonl` 파일을 `mtime` 내림차순 정렬 후 최신 1개부터 시도한다.
3. 파일을 **끝에서부터 64KB 청크 단위로 역방향** 읽어 `"type":"token_count"` 를
   포함하는 **마지막 완전한 라인**을 찾는다. 최대 1MB까지만 거슬러 올라가고,
   못 찾으면 다음 파일로 넘어간다 (최대 5개 파일까지).
4. 실측 rollout 파일 크기가 **70MB**에 달하므로 전체 읽기는 절대 금지.
5. 세션 초반에는 `rate_limits`가 없는 `token_count` 라인이 존재할 수 있다.
   `rate_limits`가 null이면 건너뛰고 계속 거슬러 올라간다.

**감시 전략**

- `fs.watch(오늘 디렉터리)` + `fs.watch(~/.codex/sessions)` (날짜 디렉터리 신규 생성 감지)
- Windows/네트워크 드라이브에서 `fs.watch`가 불안정하므로 **5초 폴링을 항상 병행**한다.
  폴링은 `stat().mtimeMs` 비교만 하고, 변경 시에만 파싱한다.
- 자정에 날짜 디렉터리가 바뀌므로 watcher 대상 경로를 주기적으로 재평가한다.

### 3.2 Claude Code — statusLine 브리지 (권장 경로)

Claude Code는 rollout 파일에 rate limit을 기록하지 **않는다**.
로컬 JSONL(`projects/**/*.jsonl`)에는 토큰 사용량만 있고, 구독 잔여량은 없다.

실제 잔여량은 **statusLine 커맨드의 stdin JSON**으로만 노출된다
(Claude Code 2.1.80+, Claude.ai Pro/Max OAuth 세션 한정).

**statusLine stdin JSON의 관련 부분**

```json
{
  "rate_limits": {
    "five_hour": { "used_percentage": 23.5, "resets_at": 1738425600 },
    "seven_day": { "used_percentage": 41.2, "resets_at": 1738857600 }
  }
}
```

| 필드 | 의미 |
| --- | --- |
| `rate_limits.five_hour.used_percentage` | 5시간 창 사용 비율 (0–100, 실수) |
| `rate_limits.seven_day.used_percentage` | 7일 창 사용 비율 |
| `resets_at` | 리셋 시각. **Unix epoch 초 또는 ISO 8601 문자열** — 버전에 따라 다르게 보고된 사례가 있으므로 파서는 **둘 다 허용**해야 한다 |

**주의사항 (반드시 방어 코드 작성)**

- `rate_limits` 객체 전체가 없을 수 있다 (API Key 사용자, 세션 첫 API 응답 이전).
- `five_hour`와 `seven_day`는 **독립적으로** 없을 수 있다.
- Claude Code는 `resets_at`이 지난 창을 **객체에서 제거**한다.

**브리지 설계**

확장은 statusLine의 stdin을 직접 받을 수 없다. 따라서 중계 스크립트를 설치한다.

```
Claude Code ──(stdin JSON)──> bridge/claude-statusline.js
                                      │
                                      ├─> ~/.neugul-usage/claude-usage.json  (스냅샷 저장)
                                      │        ▲
                                      │        └── 확장이 watch
                                      │
                                      └─> 기존 사용자 statusLine 커맨드에 stdin 그대로 전달
                                           (출력을 pass-through → 사용자 상태줄 유지)
```

설치 절차 (`neugulUsage.installClaudeBridge` 명령):

1. `~/.claude/settings.json`을 읽는다 (없으면 `{}`).
2. 기존 `statusLine` 값이 있으면 `neugulUsage.wrappedStatusLine` 키에 **원본 그대로 백업**한다.
3. `settings.json`을 쓰기 전에 `~/.claude/settings.json.neugul-backup`으로 파일 백업한다.
4. `statusLine`을 다음으로 교체한다.

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"<extensionPath>/bridge/claude-statusline.js\"",
    "padding": 0
  }
}
```

5. 설치 전에 반드시 사용자에게 **변경될 내용 diff를 보여주고 확인**을 받는다
   (사용자 설정 파일을 건드리는 유일한 동작이므로).

제거(`uninstallClaudeBridge`)는 백업된 원본 `statusLine`을 복원하고 백업 키를 삭제한다.

**브리지 스크립트 요구사항**

- 의존성 0 (Node 내장 모듈만). Claude Code가 임의 Node 런타임으로 실행하므로 번들 금지, 평문 `.js`로 배포.
- stdin을 전부 읽고 **50ms 이내에** 스냅샷을 쓴다. 느리면 사용자 상태줄이 지연된다.
- 어떤 에러가 나도 **exit code 0**으로 끝내고, 원본 statusLine 출력을 보존한다.
  브리지 때문에 사용자 상태줄이 깨지면 안 된다.
- 쓰기는 임시 파일 → `rename` 원자적 교체 (확장이 부분 쓰기된 JSON을 읽는 것 방지).

**스냅샷 파일 스키마** (`~/.neugul-usage/claude-usage.json`)

```json
{
  "schema": 1,
  "capturedAt": 1790052059123,
  "source": "statusline",
  "cli": "claude",
  "version": "2.1.84",
  "model": { "id": "claude-sonnet-4-6", "display_name": "Sonnet 4.6" },
  "rateLimits": {
    "fiveHour": { "usedPercent": 23.5, "resetsAt": 1738425600 },
    "sevenDay": { "usedPercent": 41.2, "resetsAt": 1738857600 }
  }
}
```

### 3.3 Claude Code — JSONL 폴백 (P2, v1.1)

브리지를 설치하지 않았거나 `rate_limits`가 오지 않는 사용자를 위한 **추정** 모드.

- 경로: `~/.config/claude/projects/**/*.jsonl` (v1.0.30+), `~/.claude/projects/**/*.jsonl` (레거시).
  `CLAUDE_CONFIG_DIR` 환경변수가 있으면 우선.
- `message.usage`의 `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
  `cache_read_input_tokens`를 합산하고 `message.id` / `requestId`로 중복 제거.
- 5시간 블록 산정: 엔트리를 시간순 정렬 → 블록 시작을 정각으로 내림 →
  블록 시작 기준 5시간 초과 또는 직전 엔트리와 5시간 이상 간격이면 새 블록.
- 사용자가 설정한 토큰 한도(`neugulUsage.claude.fallbackTokenLimit`) 대비 비율을 게이지로.
- UI에 **"추정치" 배지를 반드시 표시**한다. 실측값과 혼동시키면 안 된다.

### 3.4 소스 비교 요약

| | Codex | Claude Code (브리지) | Claude Code (폴백) |
| --- | --- | --- | --- |
| 추가 설정 | 불필요 | 브리지 설치 1회 | 불필요 |
| 정확도 | 실측 | 실측 | 추정 |
| 갱신 시점 | 모델 응답마다 | 상태줄 갱신마다 (≈응답마다) | 응답마다 |
| 5시간 창 | `primary` | `five_hour` | 계산 |
| 장기 창 | `secondary` (7일) | `seven_day` | 미지원 |
| 실패 조건 | Codex 미설치/세션 없음 | API Key 사용자, CC < 2.1.80 | 파일 없음 |

---

## 4. 활성 에이전트 판별 (R2)

"Codex 쓸 때는 Codex, Claude Code 쓸 때는 Claude Code가 보여야 한다"는
요구를 만족시키는 로직. 모드는 3가지.

### 4.1 `auto` (기본값)

각 소스의 **마지막 데이터 갱신 시각**(`lastUpdatedAt`)을 비교해 더 최근인 쪽을 활성으로 삼는다.

```
score(source) = lastUpdatedAt + terminalBonus(source)
active = argmax(score)
```

- `terminalBonus`: VS Code의 활성 터미널 이름 또는 셸 통합 커맨드 라인에
  `codex` / `claude` 문자열이 포함되면 해당 소스에 **+30초** 가산.
  (`vscode.window.activeTerminal`, `Terminal.shellIntegration`)
- 두 소스 모두 `staleAfterMs`(기본 30분)보다 오래되면 **마지막 활성 에이전트를 유지**하고
  UI에 "idle" 상태로 흐리게 표시한다. 에이전트가 널뛰지 않도록 한다.
- 전환에 **5초 디바운스**를 건다. 두 에이전트를 번갈아 쓸 때 UI가 깜빡이는 것을 방지.

### 4.2 `codex` / `claude` (고정)

사용자가 한쪽으로 고정. 상태바 클릭 → Quick Pick으로 전환하거나
`neugulUsage.selectAgent` 명령으로 변경.

### 4.3 `both` (동시 표시)

사이드바 웹뷰에서만 유효. 두 게이지와 두 캐릭터를 동시에 렌더링하고,
활성 쪽을 강조(비활성은 opacity 0.45 + 애니메이션 정지).
상태바는 이 모드에서도 활성 1개만 표시한다.

---

## 5. 게이지와 무드 (R3)

### 5.1 게이지 정의

- 표시 값: **잔여율(remaining) = 100 − usedPercent**
- 기본 창: 5시간 창 (`neugulUsage.primaryWindow`로 `weekly` 변경 가능)
- 사이드바에는 5시간 창과 장기 창을 **둘 다** 세로로 나란히 표시.
  캐릭터는 `primaryWindow`로 지정된 창을 따라 움직인다.

### 5.2 무드 단계

사용자 요구(100% 기분 좋음 / 50% 보통 / 30% 미만 기분 나쁨)를 6단계로 확장했다.
경계값은 `neugulUsage.moodThresholds` 설정으로 조정 가능.

| 무드 | 잔여율 | 표정 | 동작 | 색상 토큰 |
| --- | --- | --- | --- | --- |
| `ecstatic` | 90–100 | 반달눈 + 활짝 웃음 | 제자리 점프 (0.9s 루프) | `charts.green` |
| `happy` | 65–89 | 동그란 눈 + 미소 | 가볍게 흔들림 (2.4s) | `charts.green` |
| `neutral` | 40–64 | 평범한 눈 + 일자 입 | 숨쉬기 스케일 (3.2s) | `charts.blue` |
| `worried` | 20–39 | 처진 눈썹 + 물결 입 | 좌우 불안 흔들림 (1.6s) | `charts.yellow` |
| `panic` | 5–19 | 크게 뜬 눈 + 벌린 입 + 땀방울 | 빠른 떨림 (0.35s) | `charts.orange` |
| `exhausted` | 0–4 | 감은 눈(X) + 작은 입 | 축 늘어짐, 정지 + 느린 한숨 | `charts.red` |

접근성: `prefers-reduced-motion: reduce` 이거나 `neugulUsage.animation` 이 `off`이면
모든 keyframe 애니메이션을 끄고 **표정만** 바꾼다. 무드 이름은 툴팁과 aria-label에 텍스트로 병기한다.

### 5.3 캐릭터의 "게이지에 맞춰 움직임"

캐릭터는 게이지 트랙 **위**에, 채움(fill)의 **오른쪽 끝**에 서 있다.

```
 [ 캐릭터 ]
     ▼
 ████████████░░░░░░░░░░░░░░   72%
 ^           ^             ^
 0%      캐릭터 위치      100%
```

- 위치: `left: calc(clamp(6%, remaining%, 94%))`, `transform: translateX(-50%)`
  (양 끝에서 캐릭터가 트랙 밖으로 나가지 않도록 clamp)
- 전환: `transition: left 700ms cubic-bezier(.34,1.3,.64,1)` — 살짝 오버슈트해서 "걸어간 느낌"
- 게이지가 감소할 때만 짧은 "걷기" 애니메이션(0.7s)을 추가로 트리거한다.
- 리셋되어 게이지가 크게 증가하면 "환호" 애니메이션(1.2s)을 1회 재생한다.

### 5.4 캐릭터 디자인

두 캐릭터 모두 **인라인 SVG**로 그린다 (이미지 에셋 없음 → 테마 대응·해상도 무관·번들 경량).

공통 구조: `<svg viewBox="0 0 64 64">` 안에 `body` 그룹 + `face` 그룹.
`face` 그룹만 무드에 따라 교체한다.

**Codex 캐릭터 — "Codie"**
- 콘셉트: 터미널 창이 의인화된 모양
- 몸통: 라운드 사각형(rx 14), 다크 슬레이트 `#1e2430`, 상단에 창 타이틀바 3점
- 눈/입: 터미널 초록 `#4ade80`. 기본 표정은 `>_` 프롬프트를 눈으로 변형
- 포인트: 하단에 깜빡이는 커서 블록

**Claude Code 캐릭터 — "Claudie"**
- 콘셉트: Claude의 sunburst 심볼이 의인화된 모양
- 몸통: 원형, Anthropic 오렌지 `#D97757`, 주변에 8방향 짧은 광선
- 눈/입: 크림색 `#F5F0E8`
- 포인트: 무드가 나빠질수록 광선 길이가 짧아짐 (`--ray-scale` 변수)

색상은 브랜드 식별을 위해 고정값을 쓰되, 배경·텍스트·트랙은 VS Code 테마 변수를 사용한다.

---

## 6. UI 설계

### 6.1 상태바 아이템

```
$(pulse) Codex ▰▰▰▰▰▰▱▱▱▱ 72% 🙂
```

- 위치: `StatusBarAlignment.Right`, priority 100 (설정 가능)
- 게이지: 유니코드 블록 10칸 `▰`/`▱` (설정 `neugulUsage.statusBar.width`, 기본 10)
- 무드 이모지: `neugulUsage.statusBar.showMood` (기본 true)
- 배경 강조: 잔여 20% 미만 → `statusBarItem.warningBackground`,
  5% 미만 → `statusBarItem.errorBackground`
- 툴팁(MarkdownString):

```markdown
**Codex** · plus 플랜
5시간 창   잔여 72%  ·  리셋까지 1시간 12분
주간 창    잔여 39%  ·  리셋까지 2일 4시간
마지막 갱신 12초 전
---
클릭하면 패널 열기 · 우클릭으로 에이전트 전환
```

- 클릭: `neugulUsage.showPanel` (사이드바 뷰 포커스)

### 6.2 사이드바 웹뷰 뷰

- Activity Bar에 전용 컨테이너 (`viewsContainers.activitybar`), 아이콘은 게이지 모양 SVG
- 뷰 타입: `WebviewViewProvider` (`neugulUsage.panel`)
- `retainContextWhenHidden: false` — 숨겨지면 애니메이션을 돌리지 않는다 (NFR-2)

레이아웃 (위→아래):

```
┌────────────────────────────────┐
│  ● Codex            plus 플랜  │   ← 헤더: 활성 에이전트 + 플랜 배지
├────────────────────────────────┤
│              (Codie)           │   ← 캐릭터, 게이지 끝에 위치
│  ████████████░░░░░░░░░  72%    │   ← 5시간 창 게이지
│  5시간 창 · 1시간 12분 후 리셋   │
│                                │
│  ██████░░░░░░░░░░░░░░░  39%    │   ← 주간 창 게이지 (캐릭터 없음, 슬림)
│  주간 창 · 2일 4시간 후 리셋     │
├────────────────────────────────┤
│  Claude Code          (흐리게) │   ← both 모드일 때만
│  ...                           │
├────────────────────────────────┤
│  12초 전 갱신 · [새로고침]      │   ← 푸터
└────────────────────────────────┘
```

**빈 상태 / 에러 상태** (FR-12) — 각 상황별로 다른 안내와 액션 버튼을 보여준다.

| 상태 | 메시지 | 액션 |
| --- | --- | --- |
| Codex 데이터 없음 | "Codex 세션을 찾을 수 없습니다" | `~/.codex` 경로 안내, 설정 열기 |
| Claude 브리지 미설치 | "Claude Code 사용량을 보려면 연동이 필요합니다" | **[연동하기]** → `installClaudeBridge` |
| 브리지 설치됐으나 데이터 없음 | "Claude Code에서 메시지를 한 번 보내면 표시됩니다" | - |
| `rate_limits` 없음 (API Key) | "API Key 사용 시 구독 한도가 제공되지 않습니다" | 문서 링크 |
| 무제한 크레딧 | 게이지 대신 "무제한" + ecstatic 캐릭터 | - |

### 6.3 웹뷰 보안

- CSP: `default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'nonce-XXX'; script-src 'nonce-XXX';`
- 외부 리소스 로드 없음. 폰트는 `var(--vscode-font-family)`
- 확장 ↔ 웹뷰 메시지는 아래 두 종류만:
  - 확장 → 웹뷰: `{ type: 'state', payload: UsageViewState }`
  - 웹뷰 → 확장: `{ type: 'command', command: 'refresh' | 'installBridge' | 'openSettings' | 'selectAgent' }`

---

## 7. 아키텍처

### 7.1 모듈 구조

```
src/
├─ extension.ts              활성화 / 배선 / 명령 등록
├─ core/
│  ├─ types.ts               공용 타입 (AgentId, UsageWindow, AgentUsage, Mood ...)
│  ├─ mood.ts                잔여율 → Mood 매핑 (순수 함수, 단위 테스트 대상)
│  ├─ usageStore.ts          소스 집계 · 활성 에이전트 결정 · 변경 이벤트 발행
│  └─ activeAgent.ts         auto 판별 로직 (디바운스 · 터미널 힌트)
├─ sources/
│  ├─ UsageSource.ts         인터페이스 (에이전트 추가 시 이것만 구현)
│  ├─ codexSource.ts         §3.1 구현
│  └─ claudeSource.ts        §3.2 스냅샷 소비
├─ bridge/
│  └─ installer.ts           ~/.claude/settings.json 안전 편집 (백업/복원/diff)
├─ ui/
│  ├─ statusBar.ts           §6.1
│  └─ usageViewProvider.ts   §6.2 WebviewViewProvider
└─ util/
   ├─ paths.ts               홈/CODEX_HOME/CLAUDE_CONFIG_DIR 해석
   ├─ tailRead.ts            파일 꼬리 역방향 라인 스캔 (NFR-3 핵심)
   ├─ watcher.ts             fs.watch + 폴링 병행 래퍼
   └─ time.ts                리셋 카운트다운 포맷팅 (한국어)

bridge/
└─ claude-statusline.js      번들 제외, 원본 그대로 배포되는 무의존 스크립트

media/
├─ main.css                  웹뷰 스타일 + 무드 keyframes
├─ main.js                   웹뷰 렌더러 (SVG 생성 · 상태 반영)
└─ activity-icon.svg         Activity Bar 아이콘
```

### 7.2 데이터 흐름

```
┌─ codexSource ─┐                    ┌─ statusBar ─┐
│  watch+poll   │──┐              ┌─>│             │
│  tail parse   │  │              │  └─────────────┘
└───────────────┘  ├─> usageStore ─┤
┌─ claudeSource ┐  │  (activeAgent)│  ┌─ usageViewProvider ─┐
│  watch 스냅샷  │──┘              └─>│  postMessage(state) │
└───────────────┘                     └─────────────────────┘
        ▲
        │ 원자적 쓰기
┌─ claude-statusline.js ─┐ <──stdin── Claude Code
└────────────────────────┘
```

`usageStore`는 유일한 진실 공급원(single source of truth)이며,
`onDidChange` 이벤트 하나로 모든 UI를 갱신한다. UI는 상태를 직접 계산하지 않는다.

### 7.3 핵심 타입

```ts
export type AgentId = 'codex' | 'claude';
export type Mood = 'ecstatic' | 'happy' | 'neutral' | 'worried' | 'panic' | 'exhausted';

export interface UsageWindow {
  /** 창 종류: 5시간 롤링 / 장기(7일) */
  kind: 'fiveHour' | 'longTerm';
  /** 사용된 비율 0–100 */
  usedPercent: number;
  /** 잔여 비율 0–100 (= 100 - usedPercent) */
  remainingPercent: number;
  /** 리셋 시각 (epoch ms). 알 수 없으면 undefined */
  resetsAt?: number;
  /** 창 길이(분). 표시용 */
  windowMinutes?: number;
}

export interface AgentUsage {
  agent: AgentId;
  /** 데이터를 마지막으로 읽어낸 시각 (epoch ms) */
  lastUpdatedAt: number;
  /** 원본 이벤트 시각 (epoch ms). 활성 판별에 사용 */
  observedAt: number;
  windows: Partial<Record<UsageWindow['kind'], UsageWindow>>;
  planType?: string;
  /** 무제한 크레딧 여부 */
  unlimited?: boolean;
  /** true면 실측이 아닌 추정치 (§3.3) */
  estimated?: boolean;
  modelLabel?: string;
}

export type SourceStatus =
  | { state: 'ok'; usage: AgentUsage }
  | { state: 'no-data'; reason: 'not-installed' | 'no-session' | 'bridge-missing'
                               | 'awaiting-first-response' | 'api-key-user'; detail?: string }
  | { state: 'error'; message: string };

export interface UsageSource {
  readonly agent: AgentId;
  readonly onDidChange: vscode.Event<SourceStatus>;
  start(): void;
  refresh(): Promise<SourceStatus>;
  dispose(): void;
}
```

### 7.4 에러 처리 원칙

- 어떤 소스가 죽어도 다른 소스는 계속 동작한다 (각각 try/catch 격리).
- 파싱 실패는 사용자에게 토스트를 띄우지 않는다. Output 채널 `Neugul Usage`에만 기록.
- 사용자 개입이 필요한 경우(브리지 미설치 등)만 뷰 안에서 안내한다.
- 연속 실패 시 폴링 간격을 지수적으로 늘린다 (5s → 10s → 30s → 60s 상한).

---

## 8. 설정 (`contributes.configuration`)

| 키 | 타입 | 기본값 | 설명 |
| --- | --- | --- | --- |
| `neugulUsage.agent` | `auto` \| `codex` \| `claude` \| `both` | `auto` | 표시할 에이전트 |
| `neugulUsage.primaryWindow` | `fiveHour` \| `longTerm` | `fiveHour` | 캐릭터가 따라가는 게이지 |
| `neugulUsage.refreshIntervalMs` | number | `5000` | 폴링 주기 (최소 1000) |
| `neugulUsage.staleAfterMinutes` | number | `30` | 이 시간 지나면 idle 처리 |
| `neugulUsage.statusBar.enabled` | boolean | `true` | 상태바 표시 |
| `neugulUsage.statusBar.alignment` | `left` \| `right` | `right` | 상태바 정렬 |
| `neugulUsage.statusBar.priority` | number | `100` | 상태바 우선순위 |
| `neugulUsage.statusBar.width` | number | `10` | 블록 게이지 칸 수 |
| `neugulUsage.statusBar.showMood` | boolean | `true` | 무드 이모지 표시 |
| `neugulUsage.animation` | `full` \| `subtle` \| `off` | `full` | 캐릭터 애니메이션 강도 |
| `neugulUsage.moodThresholds` | number[] | `[90, 65, 40, 20, 5]` | 무드 경계 (내림차순, 잔여율 기준) |
| `neugulUsage.notifyAtRemaining` | number[] | `[20, 5]` | 이 잔여율 최초 도달 시 알림 |
| `neugulUsage.codex.homeDir` | string | `""` | 비우면 `CODEX_HOME` 또는 `~/.codex` |
| `neugulUsage.claude.configDir` | string | `""` | 비우면 `CLAUDE_CONFIG_DIR` 또는 `~/.claude` |
| `neugulUsage.claude.fallbackTokenLimit` | number | `0` | 0이면 폴백 비활성 (§3.3) |

---

## 9. 명령 (`contributes.commands`)

| 명령 ID | 제목 | 설명 |
| --- | --- | --- |
| `neugulUsage.refresh` | Neugul: 사용량 새로고침 | 모든 소스 강제 재조회 |
| `neugulUsage.showPanel` | Neugul: 사용량 패널 열기 | 사이드바 뷰 포커스 |
| `neugulUsage.selectAgent` | Neugul: 에이전트 선택 | Quick Pick (auto/codex/claude/both) |
| `neugulUsage.installClaudeBridge` | Neugul: Claude Code 연동 | §3.2 설치 (확인 다이얼로그 필수) |
| `neugulUsage.uninstallClaudeBridge` | Neugul: Claude Code 연동 해제 | 원본 statusLine 복원 |
| `neugulUsage.showLogs` | Neugul: 로그 보기 | Output 채널 열기 |

활성화 이벤트: `onStartupFinished` 단일 (NFR-1).

---

## 10. 테스트 계획

### 10.1 단위 테스트 (Vitest / Mocha)

| 대상 | 케이스 |
| --- | --- |
| `mood.ts` | 경계값 100/90/89/65/64/40/39/20/19/5/4/0, 커스텀 임계값, 범위 밖 입력 클램프 |
| `tailRead.ts` | 마지막 줄 개행 유무, 청크 경계에 걸친 라인, 1MB 상한 도달, 빈 파일, UTF-8 멀티바이트 경계 |
| Codex 파서 | 실제 rollout 샘플, `rate_limits: null` 라인 스킵, `secondary` 누락, `unlimited: true` |
| Claude 파서 | `rate_limits` 전체 누락, `five_hour`만 존재, `resets_at`이 ISO 문자열인 경우, 손상된 JSON |
| `activeAgent.ts` | 두 소스 갱신 교차, stale 전환, 디바운스 내 연속 전환, 터미널 힌트 가산 |

테스트 픽스처는 `test/fixtures/`에 익명화된 실제 라인을 저장한다.

### 10.2 통합 테스트 (`@vscode/test-electron`)

- 확장 활성화 → 상태바 아이템 생성 확인
- 임시 디렉터리에 가짜 `sessions/YYYY/MM/DD/rollout-*.jsonl` 생성 →
  `neugulUsage.codex.homeDir`로 주입 → 게이지 값 검증
- 스냅샷 파일 갱신 → 웹뷰 postMessage 페이로드 검증
- 브리지 설치/제거 후 `settings.json` 왕복(round-trip) 동일성 검증

### 10.3 수동 QA 체크리스트

- [ ] Codex 세션 실행 중 실시간 갱신
- [ ] Claude Code 세션 실행 중 실시간 갱신
- [ ] 두 CLI 번갈아 사용 시 활성 전환이 깜빡이지 않음
- [ ] 자정 넘길 때 날짜 디렉터리 전환 정상
- [ ] 라이트 / 다크 / 고대비 테마 3종
- [ ] `prefers-reduced-motion` 활성 시 애니메이션 정지
- [ ] Windows / macOS / Linux
- [ ] 기존 statusLine을 쓰던 사용자의 상태줄이 보존됨
- [ ] 70MB rollout 파일에서 갱신 지연 100ms 미만

---

## 11. 개발 마일스톤

| 단계 | 산출물 | 완료 기준 |
| --- | --- | --- |
| **M0** 스캐폴딩 | 빌드 파이프라인, 매니페스트, 빈 뷰 | `F5`로 실행되고 빈 패널이 뜸 |
| **M1** Codex 소스 | `tailRead`, `codexSource`, `usageStore` | 실제 Codex 세션 값이 콘솔에 찍힘 |
| **M2** 상태바 | `statusBar.ts` | 상태바에 실시간 게이지 표시 |
| **M3** 웹뷰 + 캐릭터 | `usageViewProvider`, `media/*` | 게이지와 캐릭터가 움직임 (R1, R3 달성) |
| **M4** Claude 연동 | 브리지 스크립트 + `installer` + `claudeSource` | Claude Code 값 표시 (R1 완성) |
| **M5** 활성 판별 | `activeAgent.ts` | 두 CLI 전환에 따라 UI 전환 (R2 달성) |
| **M6** 마감 | 빈 상태, 알림, 설정, 테스트, 문서 | QA 체크리스트 통과 |
| **M7** 배포 | 아이콘, README, CHANGELOG, LICENSE | Marketplace 게시 |

M0–M3까지가 최소 데모, M0–M5가 MVP, M0–M7이 v1.0.0.

---

## 12. 배포

### 12.1 Marketplace 준비물

| 항목 | 값 / 비고 |
| --- | --- |
| `publisher` | **미정 — 개발 전 확정 필요.** Azure DevOps에서 PAT 발급 후 `vsce create-publisher` |
| `name` | `neugul-usage` |
| `displayName` | `Neugul Usage — Codex & Claude Code` |
| `categories` | `["Other", "Visualization"]` |
| `keywords` | `codex`, `claude code`, `usage`, `rate limit`, `status bar` |
| `icon` | 128×128 PNG |
| `engines.vscode` | `^1.90.0` |
| `repository` / `license` | GitHub 공개 저장소 + MIT |
| README | 스크린샷·GIF 필수 (캐릭터가 핵심 셀링 포인트) |

배포 명령: `npx @vscode/vsce package` → `npx @vscode/vsce publish`.
Open VSX(Cursor/Windsurf 사용자용)에도 `npx ovsx publish` 권장.

### 12.2 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| Codex rollout JSONL 스키마 변경 | 높음 | 파서를 관대하게(optional chaining) 작성, 실패 시 조용히 no-data 처리, 스키마 버전 로깅 |
| Claude Code statusLine JSON 스키마 변경 | 높음 | 동일. `resets_at` 타입 이중 처리 |
| 사용자 `settings.json` 손상 | **치명적** | 쓰기 전 파일 백업 + 원본 statusLine 보존 + 확인 다이얼로그 + 왕복 테스트 |
| 대용량 파일로 인한 성능 저하 | 중간 | 꼬리 읽기 상한 1MB, mtime 변경 시에만 파싱 |
| 브랜드/상표 이슈 (OpenAI, Anthropic 로고) | 중간 | 공식 로고를 그대로 쓰지 않고 오리지널 캐릭터로 디자인. README에 비공식 명시 |
| 캐릭터 애니메이션의 CPU 사용 | 중간 | 뷰가 숨겨지면 정지, `requestAnimationFrame` 대신 CSS keyframes 사용 |

---

## 13. 미확정 항목 (개발 착수 전 결정 필요)

1. **publisher ID** — Marketplace 게시자 이름
2. **캐릭터 최종 디자인** — §5.4는 구현 가능한 초안. 디자이너 개입 시 SVG만 교체하면 됨
3. **확장 표시 이름/브랜딩** — `Neugul Usage`는 프로젝트 폴더명 기반 임시안
4. **Claude 폴백 모드(§3.3) 포함 여부** — v1.0에 넣을지 v1.1로 미룰지
