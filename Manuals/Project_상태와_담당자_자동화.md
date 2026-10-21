# Project 상태·담당자·부모 Issue 자동화

대상: [PintOS Week2 Project #10](https://github.com/users/gyaroron/projects/10) · [팀 저장소](https://github.com/gyaroron/pintos_22.04_lab_docker_week2)

이 문서는 2026-10-21에 합의한 정책과 배포 절차다. 기본 자동화는 PR #161의 `main` 병합과 설정·활성화를 마쳤다. **이 문서의 `Todo → 담당 해제` 변경은 별도 추가 PR의 승인·`main` 병합 후 적용된다.** 기본 자동화의 활성 여부와 이 추가 변경의 배포 여부를 구분한다. 기존의 `Closes`와 GitHub 기본 보드 자동화에 더해 설치하는 기능이다.

## 1. 어떤 동작을 추가하는가

```text
사람이 카드를 Todo / In Progress / In Review / Done으로 이동
  → 보드 Status 변경
  → 추가 자동화가 최근 사람 이동 이벤트 확인
  → Todo: 실제 Assignees를 모두 해제
  → In Progress / In Review / Done: 실제 Assignees를 이동자 한 명으로 교체
  → 본문 주 담당자와 상위 Issue 표를 실제 Assignees에 맞춤

같은 Project의 native 자식 카드가 전부 Done
  → 상위 Issue를 Closed로 종료
  → 기존 Item closed 자동화가 부모 카드를 Done으로 변경
  → 이미 Closed인데 카드만 미완료이면 추가 자동화가 Done 보완
```

| 상황 | 처리 |
| --- | --- |
| 사람이 카드를 Todo로 이동 | 기존 Assignees 전체 해제. 본문·상위 표의 주 담당자도 공란 |
| 사람이 카드를 In Progress·In Review·Done으로 이동 | 최근 이동자 한 명으로 기존 Assignees를 덮어쓴다 |
| Bot·GitHub 기본 자동화가 카드 이동 | 담당자를 새로 배정하지 않는다 |
| 도입 시각 이전의 수동 이동 | 과거 배정을 재생하지 않는다 |
| 자식 중 하나라도 Todo·In Progress·In Review | 부모를 자동 완료하지 않는다 |
| 자식이 0개 | 빈 집합을 완료로 간주하지 않는다 |
| native 관계·자식 카드·권한·상태 정보 누락 | 완료 처리를 중단한다 |
| leaf 카드를 사람이 Done으로 이동 | 담당자는 이동자. 그 leaf Issue를 닫는 기능은 아니다 |
| 사람이 리뷰어를 고르지 않음 | 리뷰어는 공란. 자동 리뷰 요청 없음 |

약 5분 간격의 예약 실행과 Issue 생성·종료·재개방 이벤트, 수동 실행을 사용한다. 카드 이동 자체가 repository Actions 이벤트를 즉시 발생시키는 방식은 아니므로 반영 지연이 있을 수 있다. GitHub 예약 실행도 지연될 수 있어 5분 안의 완료를 보장하지 않는다.

## 2. 완료 판정과 담당자 판정의 기준

부모의 완료 기준은 GitHub의 **실제 native Sub-issue 관계**와 해당 Project의 **Status=Done**이다. 본문의 링크·체크박스·`Refs` 문구나 Issue Closed 수를 대체 기준으로 사용하지 않는다. 모든 자식과 중첩 자식이 같은 저장소·Project 안에 있어야 하며, 보관되지 않고 조회 가능해야 한다. 변경 직전에 보드와 관계를 다시 확인한다.

`Refs #상위번호`는 상위를 참조하고, `Closes #하위번호`는 해당 PR이 기본 브랜치로 병합될 때 하위를 닫는다. PR에서 상위 전체를 일찍 닫는 `Closes #상위번호`를 넣지 않는다. 부모 종료는 실제 자식 전체의 Done 판정을 따른다. 카드만 Done이라고 테스트·승인·merge가 증명되는 것은 아니므로, 완료 조건과 통합 테스트를 확인하고 옮긴다.

담당자 처리는 Issue timeline의 `ProjectV2ItemStatusChangedEvent`에서 현재 Project의 최신 사람 이벤트를 확인한다. 그 이벤트의 도착 상태가 `Todo`이면 실제 Assignees를 빈 목록으로 바꾸고, 나머지 세 상태이면 이동자 한 명으로 교체한다. Status 값의 `creator`는 최신 이동자가 아니다. Bot은 `wasAutomated=false`로 기록될 수도 있어 User/Bot 유형과 자동화 여부를 함께 확인한다. 사람 계정의 API 변경과 UI 수동 변경은 완전히 구분할 수 없다. 자체 부모 Done 변경은 숨김 체크포인트로 재배정을 막는다.

본문의 숨김 `project-status-automation:v1` 주석은 처리한 최신 이벤트와 자체 변경 제외 정보를 저장한다. 이전 담당자 목록을 별도로 저장하지 않는다. 주석을 임의로 복제하거나 삭제하면 반복 처리나 중단이 발생할 수 있으므로, 이상이 있으면 로그와 현재 이벤트를 확인한다. GitHub 자체의 배정/활동 기록을 지우는 기능은 아니다.

완료한 부모를 자동 재개방하는 규칙은 없다. 재작업으로 자식을 미완료 상태로 되돌릴 때 부모의 재개방도 함께 검토한다.

## 3. 배포 전 준비

추가 Todo 해제 PR은 기본 자동화가 켜져 있어도 별도 승인·병합이 필요하다. 배포 직후 dry run에서 `Todo` 담당 해제 계획을 확인하고 실제 실행 후 Assignees·본문·상위 표가 모두 공란인지 확인한다. 기존 도입 시각과 활성 변수를 초기화하지 않는다.

구정책에서 도입 이후의 최신 수동 `Todo` 이벤트가 이미 처리되었고 현재도 `Todo`인 카드는 정책 전환 시 한 번 다시 확인해 기존 배정을 해제한다. 이 보정은 담당자가 공란이거나 당시 Todo 이동자 한 명인 경우에만 진행한다. 다른 담당자를 별도로 선택했거나 최종 확인 중 담당자·체크포인트가 바뀌면 쓰기를 보류한다. 도입 이전 이벤트와 Bot·기본 자동화 이동은 소급 정리하지 않는다. 같은 이벤트를 재실행할 때 반복해서 수동 배정을 덮지 않는지 검사한다.

1. 구현 PR의 코드·테스트·이 매뉴얼을 검토한다.
2. 작성자를 제외한 다른 팀원의 최소 1명 승인을 받아 `main`으로 병합한다. 현재 보호 규칙을 끄거나 우회하지 않는다.
3. 계정과 대상 저장소를 확인한다. 아래 명령은 실제 관리자 터미널에서 직접 실행한다.

```bash
# Linux Bash / VS Code DevContainer
TeamRepo='gyaroron/pintos_22.04_lab_docker_week2'
gh auth status
gh api user --jq '.login'
gh repo view "$TeamRepo" --json nameWithOwner,defaultBranchRef
```

```powershell
# Windows PowerShell
$TeamRepo = 'gyaroron/pintos_22.04_lab_docker_week2'
gh auth status
gh api user --jq '.login'
gh repo view $TeamRepo --json nameWithOwner,defaultBranchRef
```

Bash와 PowerShell 블록을 섞어 붙여 넣지 않는다. 오류가 나면 다음 설정으로 진행하지 않는다.

구현 파일을 받은 로컬 작업 폴더에서는 다음 fixture 테스트를 실행할 수 있다. Bash와 PowerShell 모두 같은 `node` 명령을 사용하며 실제 GitHub를 변경하지 않는다.

```text
node --test .github/scripts/tests/project-status-core.test.cjs .github/scripts/tests/project-status-client.test.cjs .github/scripts/tests/sync-project-status.test.cjs
```

## 4. Project 자격증명 등록

repository의 기본 `GITHUB_TOKEN`은 Issue 쓰기에 사용하지만, 사용자 소유 ProjectV2의 수정 권한은 별도 자격증명이 필요하다.

- Project에 쓰기 권한이 있는 계정에서 만료일을 정한 **classic personal access token**을 만든다.
- GitHub 개인 **Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic)**에서 만든다.
- 이 공개 저장소·사용자 Project 구성에서는 `project` scope를 부여한다. 저장소 Issue 쓰기는 별도 bot 토큰이 수행한다.
- 저장소 **Settings → Secrets and variables → Actions → New repository secret**에 이름 `PROJECT_AUTOMATION_TOKEN`으로 등록하거나 아래 입력 프롬프트를 사용한다.
- 토큰 값을 문서·PR·코드·명령행 인자에 적지 않는다. `--body <토큰>` 방식이나 토큰이 출력되는 디버그 명령을 사용하지 않는다.

```bash
gh secret set PROJECT_AUTOMATION_TOKEN --repo "$TeamRepo"
gh secret list --repo "$TeamRepo"
```

```powershell
gh secret set PROJECT_AUTOMATION_TOKEN --repo $TeamRepo
gh secret list --repo $TeamRepo
```

첫 명령이 표시하는 비밀 입력 칸에 토큰을 붙여 넣는다. `secret list`에서는 이름만 확인한다. 만료·폐기·권한 변경 시 새 토큰으로 같은 secret을 교체한다.

2026-10-21 구현 전 조회에서 이 저장소의 Actions secret은 0개였다. 별도 등록 완료와 이후 실제 실행 결과를 확인해야 한다.

## 5. 최초 설치의 도입 기준 시각과 비활성 상태 설정

아래 설정은 **처음 설치할 때** 사용한다. 이번 Todo 정책 업데이트처럼 이미 운영 중인 저장소에서는 기존 `PROJECT_AUTOMATION_START_AT`을 보존하고, 도입 시각을 다시 생성해 덮어쓰지 않는다.

도입 기준은 **UTC ISO 8601**로 저장한다. 이 시각 이전 이동은 담당자 변경에 재적용하지 않는다. 정상 운영 중 이 값을 임의로 앞당기거나 매번 현재 시각으로 다시 설정하지 않는다.

```bash
StartAt=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
printf '%s\n' "$StartAt"
gh variable set PROJECT_AUTOMATION_ENABLED --repo "$TeamRepo" --body false
gh variable set PROJECT_AUTOMATION_START_AT --repo "$TeamRepo" --body "$StartAt"
gh variable set PROJECT_CLOSE_PARENT --repo "$TeamRepo" --body true
gh variable list --repo "$TeamRepo"
```

```powershell
$StartAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
Write-Output $StartAt
gh variable set PROJECT_AUTOMATION_ENABLED --repo $TeamRepo --body false
gh variable set PROJECT_AUTOMATION_START_AT --repo $TeamRepo --body $StartAt
gh variable set PROJECT_CLOSE_PARENT --repo $TeamRepo --body true
gh variable list --repo $TeamRepo
```

`PROJECT_CLOSE_PARENT=true`는 이번 정책인 부모 Issue Closed+카드 Done을 뜻한다. `false`는 부모 카드만 Done으로 정리하는 별도 선택지이며 현재 팀 정책에는 사용하지 않는다.

## 6. dry run → 실제 실행 → 예약 활성화

dry run은 변경 계획만 조회하며 Assignees·Issue 본문·부모 상태를 쓰지 않는다.

```bash
gh workflow run project-status-sync.yml --repo "$TeamRepo" -f apply=false
gh run list --repo "$TeamRepo" --workflow project-status-sync.yml --limit 5
```

```powershell
gh workflow run project-status-sync.yml --repo $TeamRepo -f apply=false
gh run list --repo $TeamRepo --workflow project-status-sync.yml --limit 5
```

출력에서 **방금 시작한 실행 ID**를 확인하고 아래 `실행ID`를 실제 숫자로 바꾼다. 다른 사람의 실행을 최신이라고 추측하지 않는다.

```bash
RunId='실행ID'
gh run watch "$RunId" --repo "$TeamRepo" --exit-status
gh run view "$RunId" --repo "$TeamRepo" --log
```

```powershell
$RunId = '실행ID'
gh run watch $RunId --repo $TeamRepo --exit-status
gh run view $RunId --repo $TeamRepo --log
```

planned assignments의 `Todo` 담당 해제와 나머지 세 상태의 단독 배정, planned parent completions가 의도한 대상인지, applied 수가 0인지, errors가 없는지 확인한다. 기존에 자식 전체가 Done인데 부모 Issue만 열려 있으면 첫 실행의 종료 계획에 포함될 수 있다. 검토를 마친 뒤에만 실제 실행한다.

```bash
gh workflow run project-status-sync.yml --repo "$TeamRepo" -f apply=true
gh run list --repo "$TeamRepo" --workflow project-status-sync.yml --limit 5
# 방금 실행 ID의 watch/view 로그와 실제 보드·Assignees·부모 Closed를 확인한 뒤
gh variable set PROJECT_AUTOMATION_ENABLED --repo "$TeamRepo" --body true
```

```powershell
gh workflow run project-status-sync.yml --repo $TeamRepo -f apply=true
gh run list --repo $TeamRepo --workflow project-status-sync.yml --limit 5
# 방금 실행 ID의 watch/view 로그와 실제 보드·Assignees·부모 Closed를 확인한 뒤
gh variable set PROJECT_AUTOMATION_ENABLED --repo $TeamRepo --body true
```

`apply=true` 수동 실행은 ENABLED 변수가 false여도 실제 변경한다. 비활성 변수는 예약·Issue 이벤트 실행을 막는 용도이며, 실행 중인 작업을 취소하거나 완료한 변경을 되돌리는 명령은 아니다.

## 7. 팀원 인수 확인

1. 도입 시각 이후 본인이 실제 맡을 카드 하나를 올바른 상태로 이동한다.
2. **Actions → Sync project status and ownership**의 실행 완료와 errors=0을 확인한다. 필요하면 담당 관리자가 수동 실행한다.
3. `In Progress`·`In Review`·`Done` 이동 후 실제 Assignees가 최신 이동자 한 명이고 본문과 상위 표가 일치하는지 확인한다. `Todo`로 돌린 뒤에는 세 곳의 주 담당자가 모두 공란인지 확인한다.
4. Bot의 PR 병합 후 Done 이동이 담당자를 merge한 사람이나 토큰 소유자로 바꾸지 않는지 확인한다.
5. 실제 완료된 부모만 자식 전체의 Done·부모 Issue Closed·부모 카드 Done을 함께 확인한다. 검증을 위해 미완료 카드를 거짓 Done으로 옮기지 않는다.
6. 같은 이벤트로 다시 실행했을 때 불필요한 재배정·반복 종료가 없는지 로그를 확인한다.

## 8. 중지·오류 대응

```bash
gh variable set PROJECT_AUTOMATION_ENABLED --repo "$TeamRepo" --body false
gh run list --repo "$TeamRepo" --workflow project-status-sync.yml --limit 5
```

```powershell
gh variable set PROJECT_AUTOMATION_ENABLED --repo $TeamRepo --body false
gh run list --repo $TeamRepo --workflow project-status-sync.yml --limit 5
```

실행 중인 쓰기도 중지해야 하면 실제 실행 ID를 확인한 뒤 `gh run cancel <실행ID> --repo <팀저장소>`로 취소한다. 중간까지 성공한 변경은 자동 롤백되지 않으므로 현재 Issue와 보드를 다시 확인한다.

| 오류·현상 | 확인할 항목 |
| --- | --- |
| secret 미등록·403·Project 조회 실패 | 토큰 유효기간, classic `project` scope, Project 접근·쓰기 권한 |
| 예약 실행이 없음 | `main` 병합 여부, ENABLED=true, GitHub Actions 활성 상태·예약 지연 |
| 최근 이동자가 배정되지 않음 | Todo는 담당 해제가 정상이다. 나머지 세 상태이면 기준 시각·Project·User 유형·배정 가능한 계정을 확인 |
| Todo인데 기존 담당자가 남음 | 추가 Todo 해제 PR의 main 병합 여부, 최신 사람 이벤트·1회 정책 전환 계획, 실행 errors·실제 Assignees와 표시 동기화 확인 |
| 부모가 닫히지 않음 | 실제 native 관계, 자식 누락·보관·다른 저장소, 중첩 자식의 미완료, 변경 중단 로그 |
| 부모 Closed지만 카드가 미완료 | 기존 Item closed→Done 설정, 추가 자동화의 보완 실행·권한·로그 |
| 숨김 marker 오류 | Issue 본문 주석 중복·수동 변경 여부. 추측해 지우지 않고 이벤트·현재 상태와 대조 |
| 자체 변경 이벤트가 불명확함 | 담당자를 추측하지 않고 보류한다. pending/blocked 기록과 보드·이벤트를 사람이 확인한다 |

Issue 표시만 다시 맞추려면 기존 **Sync issue role display**를 수동 실행한다. 두 작업은 같은 저장소 동시 실행 잠금을 공유해 본문 갱신이 겹치지 않도록 한다.

## 근거 문서

- [GitHub Projects를 Actions로 자동화](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions)
- [GraphQL ProjectV2ItemStatusChangedEvent](https://docs.github.com/en/graphql/reference/projects#projectv2itemstatuschangedevent)
- [Project 기본 자동화](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-built-in-automations)
- [Actions 예약 실행과 지연](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [gh secret set](https://cli.github.com/manual/gh_secret_set) · [gh variable set](https://cli.github.com/manual/gh_variable_set) · [gh workflow run](https://cli.github.com/manual/gh_workflow_run)
