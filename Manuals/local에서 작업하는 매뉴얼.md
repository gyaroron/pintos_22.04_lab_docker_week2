# local에서 작업하는 매뉴얼

작성 기준: 2026-10-16. 이 문서는 실행 안내이며, 여기 적힌 명령을 실제로 실행하거나 테스트에 통과했다는 기록은 아니다.
이슈에는 요구사항과 완료 조건을 기록하고, 구현·검증·리뷰 결과는 연결된 PR에 남긴다.

## 1. 이번 팀의 기준

| 항목 | 값 |
|---|---|
| 팀 저장소 | `https://github.com/gyaroron/pintos_22.04_lab_docker_week2` |
| 팀 기준 브랜치 | `main` |
| 팀원 | `gyaroron`, `haihai1222555-droid` |
| 칸반 보드 | 공개 `PintOS Week2`, `https://github.com/users/gyaroron/projects/10` 하나에 계속 누적 |
| 첫 상위 Issue | `args.c` [#1](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/1) |
| 첫 작업 단위 | 상위 Issue에 연결된 Sub-issue 5개 중 본인 담당 1개 |
| 이후 작업 단위 | 각 테스트 소스의 상위 Issue에 연결된 본인 담당 Sub-issue 1개 |
| 브랜치 이름 | `feature/issue-<Issue번호>-<상위작업명>/sub-<Sub번호>-<개별작업명>` |
| 기본 흐름 | 개인 fork의 작업 브랜치 → 팀 저장소 `main`으로 PR → 상대방 리뷰 → 권한자 merge |

`gyaroron`은 팀 저장소의 소유자이므로 같은 저장소를 다시 fork하지 않는다. 본인 팀 저장소의 작업 브랜치에서 PR을 만든다.
이 예외에서도 `main`에 직접 작업하지 않으며, 자기 PR을 스스로 승인하지 않는다. 조직 저장소로 이전하는 작업은 포함하지 않는다.

## 2. PowerShell과 Linux 터미널을 구분한다

- **Windows PowerShell:** 이 문서의 Git·GitHub CLI(`gh`)·파일 작성 명령을 실행한다.
- **Linux DevContainer의 Bash:** 해당 저장소 README에 따라 개발 환경을 활성화한 뒤 빌드·테스트 명령을 실행한다.
- PowerShell 코드 블록과 Bash 코드 블록을 한 터미널에 섞어 붙여 넣지 않는다.
- 명령이 실패하면 오류를 확인하고 해당 단계에서 멈춘다. 실패한 상태로 다음 명령을 계속 실행하지 않는다.

개발 환경의 설치·컨테이너 진입·필요 패키지·설정은 **새로 받은 현재 팀 저장소의 README와 개발 환경 문서**를 따른다.
이 문서는 Docker 이미지명이나 컨테이너 진입 명령을 추정하지 않는다. `git --version`, `gh --version`으로 도구 존재 여부를 먼저 확인한다.

## 3. 기존 `pintos_lab`를 그대로 사용하지 않는 이유

기존 `C:\Users\V15_G3_ABA_2023\pintos_lab`는 이전 주차 주소가 `origin`에 연결되어 있던 체크아웃이다.
확인 당시 로컬은 `week2-main@cb2087757d73057b2e3704640ad792e6a169c727`이었다.
조사 시 팀 원격 `main`과 파일 트리는 같았지만 커밋 이력에 공통 조상이 없어, 그 브랜치를 그대로 팀 `main`에 PR하면 정상적인 비교·병합이 어려울 수 있다.
파일 내용이 같다는 사실만으로 브랜치의 이력까지 같다고 판단하지 않는다. 이 정보는 조사 당시의 상태이며 현재 원격 버전 확인을 대신하지 않는다.

**기존 폴더와 그 `origin`은 수정하지 않는다.** 아래에서 새 폴더에 현재 원격 이력을 받아 작업한다.
이미 작업한 코드가 있다면 먼저 별도 보관하고, 필요한 변경만 새 작업 브랜치에 검토하여 옮긴다. `.git`을 복사하거나 이전 이력을 억지로 합치지 않는다.

## 4. GitHub 계정과 개인 fork를 확인한다

다음은 PowerShell이다. 인증 계정은 실제로 작업할 본인의 계정이어야 한다.

```powershell
gh auth status
$Login = (gh api user --jq '.login').Trim()
$Login
$TeamRepo = 'gyaroron/pintos_22.04_lab_docker_week2'
$TeamUrl = 'https://github.com/gyaroron/pintos_22.04_lab_docker_week2'
$RepoName = 'pintos_22.04_lab_docker_week2'
```

`$Login`이 본인 ID가 아니면 기존 인증을 임의로 사용하지 않는다. 본인 계정으로 `gh auth login` 또는 `gh auth switch`를 진행한 뒤 다시 확인한다.
공용 컴퓨터에서 다른 사람의 계정으로 push하거나, 인증 토큰을 문서·화면 캡처·PR에 붙여 넣지 않는다.

`haihai1222555-droid`의 최초 준비:

1. 브라우저에서 팀 저장소를 연다. 주소의 소유자가 `gyaroron`, 저장소가 `pintos_22.04_lab_docker_week2`인지 확인한다.
2. **Fork → Create a new fork**를 선택하고 Owner를 본인 계정으로 정한다.
3. 생성 후 `haihai1222555-droid/pintos_22.04_lab_docker_week2`인지 확인한다.
4. 저장소 제목 아래의 **forked from**이 팀 저장소를 가리키는지 확인한다. 이미 fork가 있으면 새로 만들지 않고 기존 fork를 점검한다.

`gyaroron`은 이 fork 생성 단계를 건너뛴다. 다음 명령으로 사용할 저장소 정보를 확인한다.

```powershell
gh api "repos/$Login/$RepoName" --jq '{full_name:.full_name,fork:.fork,parent:.parent.full_name}'
```

팀원 fork의 `parent`는 `$TeamRepo`여야 한다. 소유자 본인의 저장소는 `fork=false`, `parent=null`일 수 있다.
같은 이름의 다른 저장소나 다른 원본에서 만든 fork이면 여기서 멈추고 대상을 바로잡는다.

## 5. 새 폴더에 clone하고 원격 주소를 고정한다

```powershell
$CloneParent = Join-Path $HOME 'source'
$WorkPath = Join-Path $CloneParent "pintos_week2_$Login"
if (Test-Path -LiteralPath $WorkPath) { throw '이미 있는 폴더입니다. 새 경로를 정하거나 그 폴더의 상태를 먼저 확인하세요.' }
New-Item -ItemType Directory -Path $CloneParent -Force | Out-Null
gh repo clone "$Login/$RepoName" "$WorkPath"
Set-Location -LiteralPath $WorkPath
git remote -v
$ExistingUpstream = git remote get-url upstream 2>$null
if ($LASTEXITCODE -eq 0) {
    if (($ExistingUpstream.TrimEnd('/') -replace '\.git$', '') -ne $TeamUrl) { throw '기존 upstream 주소가 팀 저장소와 다릅니다.' }
} else {
    git remote add upstream "$TeamUrl.git"
}
git remote -v
git status --short --branch
```

`gh repo clone`이 fork의 `upstream`을 자동 등록한 경우 위 검사는 주소를 확인하고 재사용한다. 없을 때만 추가한다.
다른 저장소의 원격을 `set-url`로 덮어쓰지 않는다.

| 원격 이름 | 팀원 `haihai1222555-droid` | 소유자 `gyaroron` |
|---|---|---|
| `origin` | 본인 fork | 팀 저장소 |
| `upstream` | 팀 저장소 | 팀 저장소: `origin`과 동일 주소 허용 |

## 6. 사용자 선택 후 부모·자식 번호와 브랜치를 연결한다

담당 정책(2026-10-21): 실제 맡을 Sub-issue 카드를 본인이 In Progress·In Review·Done으로 이동하면, 추가 자동화가 최근 이동자를 실제 Assignees 한 명으로 등록하고 기존 명단을 교체한다. Todo로 옮기면 실제 Assignees를 모두 해제하고 본문·상위 표의 주 담당자를 공란으로 만든다. 도입 시각 이전 이동은 재적용하지 않는다. 리뷰어와 리뷰 요청은 자동 지정하지 않는다. PR 병합에는 작성자 외 다른 팀원 1명의 유효한 승인이 필요하다.

오른쪽 Assignees의 직접 선택·해제도 본문과 상위 표에 반영하지만 이후 새 수동 카드 이동은 Todo이면 담당 해제, 나머지 세 상태이면 최근 이동자 한 명으로 바뀐다. 기본 자동화는 PR #161 병합 후 활성화했지만 Todo 해제 변경은 별도 추가 PR의 승인·main 병합 후 적용된다. 약 5분 간격으로 확인하며 GitHub 예약 지연이 있을 수 있다. [담당자 선택](담당자_선택과_자동_갱신.md)과 [배포·검증 명령](Project_상태와_담당자_자동화.md)을 참고한다.

이슈 번호는 실제 생성된 번호를 입력한다. 아래의 S1~S5는 순번이며 GitHub 이슈 번호가 아니다.

현재 연결은 S1=#2, S2=#3, S3=#4, S4=#5, S5=#6이다. 예를 들어 #2 작업 브랜치는 `feature/issue-1-args/sub-2-args-none`, #3은 `feature/issue-1-args/sub-3-args-single-multiple`이다. 두 사람은 같은 상위 Issue #1을 공유하면서 서로 다른 Sub-issue를 맡는다. `issue-1-args`는 공통 상위 작업을 나타내며, 부모 자체를 구현하는 별도 브랜치를 만들라는 뜻이 아니다.

이후 작업도 실제 번호와 각 이슈 본문에 정한 영문 작업명을 함께 사용한다. 작업명은 소문자·숫자·하이픈으로 적고, 같은 상위 Issue의 모든 Sub-issue에는 같은 상위 작업명을 사용한다. [이슈별 브랜치 대응표](브랜치_명명_규칙과_이슈별_대응표.md)에서 전체 이름을 확인한다. 이름만으로 GitHub 연결이 생성되지 않으므로 실제 부모·자식 관계와 PR 연결은 별도로 유지한다.

```powershell
$ParentIssue = Read-Host '본인이 맡은 테스트의 상위 Issue 번호: 숫자만'
$ChildIssue = Read-Host '본인이 맡을 Sub-issue 번호: 숫자만'
if ($ParentIssue -notmatch '^[1-9][0-9]*$' -or $ChildIssue -notmatch '^[1-9][0-9]*$') { throw '실제 양의 정수 이슈 번호를 입력하세요.' }
gh issue view $ParentIssue --repo $TeamRepo --web
gh issue view $ChildIssue --repo $TeamRepo --web
gh api "repos/$TeamRepo/issues/$ParentIssue/sub_issues" --jq '.[] | {number,title,assignees:[.assignees[].login]}'
```

부모가 맡은 테스트 소스(첫 예시는 `args.c`)이고 자식이 그 부모에 실제로 연결되어 있는지 웹 화면과 위 목록에서 확인한다.
본문에 `Parent #번호`만 적혀 있는 것으로 GitHub의 실제 Sub-issue 관계가 생겼다고 간주하지 않는다.
자식의 요구사항·완료 조건·의존 작업을 읽고, 다른 팀원이 진행 중인 작업과 담당자를 확인한다.

```powershell
git status --short --branch
git fetch upstream
$BaseSha = (git rev-parse upstream/main).Trim()
$BaseSha
$ParentSlug = Read-Host '상위 Issue 본문의 상위작업명: 예 args'
$ChildSlug = Read-Host 'Sub-issue 본문의 개별작업명: 예 args-none'
if ($ParentSlug -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$' -or $ChildSlug -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') { throw '본문에 정한 소문자·숫자·하이픈 작업명을 입력하세요.' }
$FeatureBranch = "feature/issue-${ParentIssue}-${ParentSlug}/sub-${ChildIssue}-${ChildSlug}"
git check-ref-format --branch $FeatureBranch
if ($LASTEXITCODE -ne 0) { throw '브랜치 이름 형식을 확인하세요.' }
git switch --no-track -c $FeatureBranch upstream/main
git branch --show-current
git status --short --branch
```

작업 트리에 기존 변경이 있으면 브랜치를 만들기 전에 내용을 확인한다. 위 명령은 새 브랜치가 아직 없다는 전제다.
같은 이름의 브랜치가 있다면 강제로 재생성하지 말고 그 브랜치의 담당 작업·기준 커밋·미반영 변경을 확인한다.
작업 기록에는 `upstream/main@$BaseSha`를 시작 기준으로 남긴다. 이후 fetch로 `upstream/main`이 바뀌어도 이 시작 기준을 덮어쓰지 않는다.
칸반 보드에서 본인이 맡을 자식을 `In Progress`로 옮긴다. 자동화 실행 후 실제 Assignees가 본인 한 명인지 확인한다. 프로젝트에 항목이 없으면 해당 Sub-issue를 추가한다.
상위 Issue는 자식 전체의 진행 상태를 요약한다. 한 자식만 끝났다고 부모를 닫지 않는다. 모든 native 자식과 중첩 자식 카드가 Done이면 활성화된 추가 자동화가 부모 Issue Closed+카드 Done을 처리한다.

새 규칙은 새 작업 브랜치부터 사용한다. 이미 push했거나 PR이 있는 브랜치는 이름 변경·삭제 없이 이어가며, 해당 Sub-issue에 실제 브랜치와 PR을 적는다. 아직 원격에 올리지 않았고 PR도 없는 로컬 브랜치만 변경하려면 현재 브랜치와 작업 상태를 확인한 뒤 `git branch -m $FeatureBranch`로 이름을 바꿀 수 있다. 이 명령은 원격 브랜치나 GitHub의 연결을 바꾸지 않는다.

## 7. Git 작성자와 커미터를 본인으로 확인한다

인증 계정과 커밋 작성자 정보는 서로 다르므로 둘 다 확인해야 한다. `gyaroron`의 확인된 이름·이메일은 `Jun`, `gyaroron@gmail.com`이다.
다른 팀원은 그 값을 복사하지 않고 자신의 이름과 GitHub 계정에 연결된 검증 이메일 또는 본인 GitHub의 noreply 이메일을 사용한다.

```powershell
gh api user --jq '{login:.login,name:.name,email:.email}'
gh api user/emails --jq '.[] | select(.verified == true) | .email'
$AuthorName = Read-Host '본인 Git 작성자 이름'
$AuthorEmail = Read-Host '본인 GitHub 계정에 연결된 이메일'
git config --local user.name "$AuthorName"
git config --local user.email "$AuthorEmail"
git config --show-origin --get-regexp '^user\.(name|email)$'
Get-ChildItem Env: | Where-Object { $_.Name -match '^GIT_(AUTHOR|COMMITTER)_' }
git config --show-origin --get core.hooksPath
git rev-parse --git-path hooks
```

`user/emails` 조회가 권한 부족으로 실패하면 GitHub **Settings → Emails**에서 본인 이메일을 확인한다. 임의의 이메일을 만들지 않는다.
`core.hooksPath`가 설정되지 않았다면 해당 조회에 출력이 없을 수 있다. 실제 hooks 위치에서 활성화된 후크가 작성자나 커밋 메시지를 바꾸는지도 확인한다.
기존 환경 변수는 Git 설정을 덮어쓸 수 있다. 이번 PowerShell 세션에서는 확인한 본인 정보로 다음 값을 맞춘다.

```powershell
$env:GIT_AUTHOR_NAME = $AuthorName
$env:GIT_AUTHOR_EMAIL = $AuthorEmail
$env:GIT_COMMITTER_NAME = $AuthorName
$env:GIT_COMMITTER_EMAIL = $AuthorEmail
git var GIT_AUTHOR_IDENT
git var GIT_COMMITTER_IDENT
```

새 터미널에서는 다시 확인한다. author·committer에는 실제 작업자의 GitHub 계정에 연결된 정보를 사용한다.
커밋 후 실제 메타데이터와 본문도 확인한다. 후크가 변경했다면 잘못된 커밋을 업로드하기 전에 바로잡는다.

## 8. 요구사항을 구현하고 해당 테스트를 확인한다

실제 구현은 담당 Sub-issue 요구사항을 근거로 본인이 작성한다. 이름 제안의 의미·선정 기준은 `code naming convention.md`를 참고한다.
범위를 넘는 수정이 필요하면 대상·이유·변경안·영향을 먼저 제시한다. 테스트 소스나 `.ck` 기대값을 약화하여 PASS를 만들지 않는다.
공유 파일을 수정할 때는 상대방과 수정 영역·의존 순서를 조정한다. 서로 다른 Sub-issue라도 같은 파일에서 충돌할 수 있다.

### 8-1. 담당 케이스의 명령을 확인한다

**모든 상위 Issue와 Sub-issue에 각 테스트 케이스의 실행 방법을 첨부한다.** 상위에는 연결된 전체 케이스를, 하위에는 담당 케이스와 회귀 범위를 적는다. 실제 테스트 이름·개별 명령·결과 파일·복수 선택 및 통합 실행 방법은 [userprog_테스트별_실행_명령어.md](userprog_테스트별_실행_명령어.md)에서 찾는다. 같은 C를 사용하는 케이스도 실제 `TESTS` 키별로 구분한다.

이슈 본문에는 다음 항목을 적는다.

- 환경: 저장소 README에 따라 활성화한 **Linux DevContainer의 Bash**.
- 실행 위치: **저장소 루트의 `pintos/userprog`**.
- 각 케이스의 정확한 `TESTS` 키와 바로 실행할 개별 명령.
- 해당 위치 기준 `build/<TESTS 키>.result`, `.output`, `.errors` 경로.
- 원본 `.ck`의 허용 결과, `.result`의 `PASS` 확인 방법, 필요한 회귀 범위.
- 선택 케이스·추가 빌드 설정·시간·메모리 조건, 실제 실행 여부와 검증한 전체 SHA.

예를 들어 `create-normal.c`에 대응하는 한 케이스는 다음과 같이 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)/pintos/userprog"
make -B check TESTS='tests/userprog/create-normal'
cat build/tests/userprog/create-normal.result
```

같은 실행 위치에서 `build/tests/userprog/create-normal.output`은 테스트 출력, `build/tests/userprog/create-normal.errors`는 오류 출력을 담는다. `.result`가 `PASS`인지 확인하고 세 파일의 경로와 필요한 내용을 PR에 첨부한다. 빌드 오류로 결과 파일이 생성되지 않았다면 그 상태를 적는다. 이전 실행의 결과 파일과 이번 결과를 혼동하지 않는다.

### 8-2. 첫 범위인 args.c를 검증한다

| 자식 순번 | 확인할 테스트 |
|---|---|
| S1 | `args-none` |
| S2 | `args-none`, `args-single`, `args-multiple` |
| S3 | 앞의 3개 + `args-dbl-space` |
| S4 | 아래의 5개 전체 |
| S5 | 아래의 5개 전체와 통합 증거 |

`args.c` 자체를 이름으로 하는 단일 채점 테스트는 없다. 이 파일을 사용하는 `args-*` 5개가 첫 범위의 필수 대상이다.
개발 환경 활성화는 현재 README를 따른다. **아래 명령은 Linux DevContainer의 Bash에서 실행하는 예시**다.

```bash
cd "$(git rev-parse --show-toplevel)/pintos/userprog"
make -B check TESTS='tests/userprog/args-none'
```

S2는 `TESTS` 값에 해당 3개, S3는 4개를 공백으로 나열한다. S4·S5의 전체 검증은 다음과 같다.

```bash
cd "$(git rev-parse --show-toplevel)/pintos/userprog"
make -B check TESTS='tests/userprog/args-none tests/userprog/args-single tests/userprog/args-multiple tests/userprog/args-dbl-space tests/userprog/args-many'
```

`-B`는 선택한 테스트의 과거 결과를 그대로 재사용하지 않도록 다시 빌드·실행하게 한다. 환경에 따라 시간이 걸린다.
이 문서 작성 시 위 테스트는 실행하지 않았다. 도구 설치 오류·빌드 실패·테스트 실패·미실행을 서로 구분하여 기록한다.
결과에는 실행 환경, 명령, 실행 시점, 검증한 전체 커밋 SHA, 각 테스트의 `.result`와 필요한 출력 근거를 남긴다.
커밋 전 실행했다면 `git rev-parse HEAD`는 수정 전 커밋이므로 “작업 트리 변경 포함”을 명시한다. 커밋 SHA만으로 검증했다고 쓰지 않는다.

### 8-3. 기본·선택 범위와 공식 판정을 구분한다

현재 userprog 등록 범위는 **기본 64개와 선택 `dup2` 2개, 총 66개**다. 기존 `args-*` 5개 외에 기본 59개와 선택 2개가 있다. `child-*` 등 보조 C와 미등록 `null.ck`를 독립 실행 테스트로 세지 않는다. 담당 Issue에 기본·선택 여부를 명시하고 케이스별 명령을 첨부한다.

선택 `dup2`는 기본 `TEST_SUBDIRS`에 포함되지 않는다. 다음은 `Make.vars`를 바꾸지 않고 해당 실행에만 필요한 설정을 더하는 예다. 다른 선택 케이스는 마지막 `TESTS` 키를 명령 목록의 실제 값으로 바꾼다.

```bash
cd "$(git rev-parse --show-toplevel)/pintos/userprog"
make -B check TEST_SUBDIRS='tests/userprog tests/filesys/base tests/userprog/no-vm tests/threads tests/userprog/dup2' TDEFINE=-DEXTRA2 TESTS='tests/userprog/dup2/dup2-simple'
cat build/tests/userprog/dup2/dup2-simple.result
```

`no-vm/multi-oom`은 등록된 `TIMEOUT = 600 -m 20` 조건을 유지한다. 임의로 짧은 제한 시간이나 다른 메모리를 강제하지 않는다.

완료 판단은 공식 `.ck`가 만든 **각 `.result`의 `PASS`**를 기준으로 한다. 모든 프로그램이 `exit(0)`이어야 하는 것은 아니다. `exit` 테스트의 57, 오류 입력 테스트의 의도된 -1, `halt`의 시스템 종료 등은 해당 판정 파일의 기대 조건을 따른다. `make` 종료 코드, 프로그램 종료 상태, 공식 테스트 판정은 각각 구분해 기록한다.

문서화한 명령은 실행 결과가 아니다. 각 케이스를 `PASS / FAIL / 미실행 / 환경·빌드 오류`로 표시하고, 실행한 경우 시점·환경·전체 SHA·미커밋 변경 포함 여부와 `.result`·`.output`·`.errors`를 함께 남긴다. 개별 명령이나 기본 범위만 실행했다면 선택 테스트까지 통과했다고 쓰지 않는다.

## 9. 검토한 변경만 커밋하고 본인 원격에 push한다

다시 Windows PowerShell에서 새 clone 폴더를 사용한다. DevContainer에만 파일이 있는 별도 checkout이면 먼저 동일한 작업 트리인지 확인한다.

```powershell
Set-Location -LiteralPath $WorkPath
git branch --show-current
git status --short
git diff
$ChangedPath = Read-Host '이번 커밋에 포함할 파일의 저장소 상대 경로'
git add -- "$ChangedPath"
git diff --cached
$CommitMessage = Read-Host '변경 내용과 자식 번호를 담은 커밋 메시지'
git commit -m "$CommitMessage"
git show -s --format=fuller HEAD
git log upstream/main..HEAD --format='%h | author=%an <%ae> | committer=%cn <%ce> | %s'
git log upstream/main..HEAD --format='%B'
git push -u origin "$FeatureBranch"
```

여러 파일이면 `git add -- "$ChangedPath"` 단계를 각 파일에 반복한다. 빌드 산출물·비밀정보·관련 없는 변경이 포함되지 않았는지 staged diff를 읽는다.
push 전에 전체 커밋의 author·committer와 메시지를 확인한다. 계정과 연결되지 않은 작성자 정보나 사실과 다른 공동 작성자가 있으면 업로드 전에 바로잡는다.
최종 커밋 후 테스트를 다시 실행하면 검증 대상을 정확한 커밋에 연결하기 쉽다. 실행하지 않은 검증은 PR에도 미실행으로 적는다.

## 10. 팀 저장소 main을 대상으로 PR을 만든다

PR 본문 파일은 작업 편의를 위한 로컬 문서이며 제품 코드 커밋에 자동 포함하지 않는다. 아래 내용을 실제 결과로 채운다.

```powershell
$TestedSha = (git rev-parse HEAD).Trim()
@"
## 변경 목적
담당 Sub-issue의 요구사항과 최종 동작을 실제 변경에 맞게 작성합니다.
Refs https://github.com/$TeamRepo/issues/$ParentIssue
Closes https://github.com/$TeamRepo/issues/$ChildIssue

## 검증
- 검증 대상 커밋: $TestedSha
- 실행 환경과 위치: Linux DevContainer Bash / 저장소 루트의 pintos/userprog인지 확인합니다.
- 케이스별 정확한 TESTS 키와 실행 명령: 실제 실행 내용을 작성합니다.
- 테스트별 결과: PASS / FAIL / 미실행 / 환경·빌드 오류를 구분하여 작성합니다.
- 결과·로그: 케이스별 .result 판정과 .output·.errors 경로를 작성합니다.
- 미커밋 변경 포함 여부와 선택·시간·메모리 설정: 실제 검증 조건을 작성합니다.
- 아직 남은 조건과 리뷰 요청: 실제 내용을 작성합니다.
"@ | Set-Content -LiteralPath 'pr-body.md' -Encoding utf8
notepad.exe 'pr-body.md'
```

본문을 수정하고 저장한 뒤 실제 결과와 일치하는지 읽는다. 부모 전체를 닫는 `Closes #부모번호`는 넣지 않는다.

```powershell
Get-Content -LiteralPath 'pr-body.md'
gh pr create --repo $TeamRepo --base main --head "${Login}:$FeatureBranch" --title "[$ChildIssue] 담당 요구사항 요약" --body-file pr-body.md
```

제목의 “담당 요구사항 요약”은 실제 변경 내용으로 바꾼다. PR 생성 결과의 URL에서 팀 저장소, base=`main`, head=본인 작업 브랜치를 확인한다. 리뷰어는 자동 지정하지 않으며 사용자가 정하기 전까지 공란으로 유지한다.
`gyaroron`의 같은 저장소 작업도 위와 같이 본인 소유자와 작업 브랜치를 명시한다. fork와 팀 저장소의 방향을 뒤집지 않는다.
본인 카드를 `In Review`로 옮긴다. 다른 사람이 카드를 옮기면 그 사람에게 담당이 바뀌므로, 리뷰어가 단순 정리 목적으로 다른 사람의 카드를 이동하기 전에는 이를 확인한다. 리뷰어는 PR에서 사용자가 따로 선택한다. 권한이나 프로젝트 필드 문제로 상태 변경이 안 되면 원인을 기록하고 권한자에게 요청한다.

## 11. 상대방이 승인 리뷰를 남긴다

1. PR의 **Files changed**에서 실제 변경과 요구사항 충족 여부를 읽는다.
2. 테스트 근거·담당 범위·이름의 의미·미해결 항목을 확인한다. 자신이 확인한 범위를 리뷰 본문에 적는다.
3. 오른쪽 위 **Review changes**를 선택한다.
4. **Comment:** 의견만 남김. **Approve:** 승인함. **Request changes:** 수정이 필요하다고 요청함.
5. 승인하려면 **Approve**를 선택한 뒤 **Submit review**를 누른다.

일반 대화 탭의 **Add comment**로 “승인합니다”라고 적는 것은 GitHub의 승인 리뷰가 아니다.
PR 작성자는 자기 PR을 승인할 수 없다. 두 사람은 서로의 PR을 검토하고 승인한다.
계정 권한에 따라 리뷰 요청·승인 반영·merge 가능 여부가 다를 수 있으므로 실제 GitHub 화면을 확인한다.
GitHub 승인 리뷰, 저장소 보호 규칙 충족, CI 통과, 로컬 테스트 통과는 서로 다른 근거다. 검사가 없다는 사실을 통과로 기록하지 않는다.

## 12. 충돌이 발생했을 때

먼저 작업 내용을 커밋하고 작업 트리가 깨끗한지 확인한다. 현재 브랜치는 담당 Sub-issue에 적힌 `feature/issue-<Issue번호>-<상위작업명>/sub-<Sub번호>-<개별작업명>` 또는 이미 진행 중인 실제 브랜치여야 한다.

```powershell
git branch --show-current
git status --short
git fetch upstream
git merge upstream/main
git status --short
git diff --name-only --diff-filter=U
```

충돌 파일에는 다음과 같은 표식이 생길 수 있다. 아래는 충돌 표식을 설명하는 일반 문장 예시다.

```text
<<<<<<< HEAD
작업 기록에는 날짜를 적습니다.
=======
작업 기록에는 테스트 이름을 적습니다.
>>>>>>> upstream/main
```

`<<<<<<< HEAD` 아래는 현재 작업 브랜치의 내용, `=======` 아래는 이번에 합치는 `upstream/main`의 내용이다.
`>>>>>>> upstream/main`이 충돌 구간의 끝이다. 위쪽이나 아래쪽을 무조건 선택하지 말고 두 변경의 의도를 확인한다.
필요한 최종 내용으로 편집하고 세 표식 줄을 제거한다. 판단이 어려운 공유 변경은 작성한 상대방과 확인한다.

```powershell
$ResolvedPath = Read-Host '충돌을 해결한 파일의 저장소 상대 경로'
git add -- "$ResolvedPath"
git diff --name-only --diff-filter=U
git diff --cached
git commit
```

충돌 파일마다 add하고 미해결 파일 목록이 비었는지 확인한다. 커밋 전 본인 author·committer 환경도 다시 확인한다.
Linux DevContainer에서 해당 범위 테스트를 다시 실행하고, 최종 커밋·결과를 기록한 뒤 PowerShell에서 올린다.

```powershell
git show -s --format=fuller HEAD
git push origin "$FeatureBranch"
```

같은 브랜치에 push하면 기존 PR이 자동 갱신된다. PR 검증 기록을 갱신하고 변경된 내용을 상대방이 다시 검토·승인하도록 요청한다.
병합 중단은 **아직 merge를 완료하지 않은 상태**에서 `git merge --abort`로 한다. 중단 후 `git status`로 원래 상태를 확인한다.
이 흐름에서는 강제 push, `reset --hard`, 충돌 파일의 무조건 삭제를 사용하지 않는다.

## 13. 승인 후 merge하고 main과 fork를 맞춘다

PR의 승인·미해결 대화·필수 검사·충돌 상태를 확인한 **merge 권한자**가 GitHub에서 허용된 방식으로 merge한다.
버튼이 비활성화되어 있으면 원인을 확인한다. 보호 규칙을 임의로 끄거나 검사를 우회하지 않는다.
설정되지 않은 CI나 실행하지 않은 테스트는 “미설정”·“미실행”으로 남긴다. merge했다는 사실만으로 모든 테스트 통과를 뜻하지 않는다.

각 팀원은 작업 트리가 깨끗한 상태에서 다음을 실행한다. `main`에 본인 작업 커밋을 쌓지 않았다는 전제다.

```powershell
git status --short --branch
git fetch upstream
git fetch origin
git switch main
git merge --ff-only upstream/main
$LocalMainSha = (git rev-parse HEAD).Trim()
$TeamMainSha = (git rev-parse upstream/main).Trim()
if ($LocalMainSha -ne $TeamMainSha) { throw '로컬 main과 팀 main이 다릅니다. 추가 커밋과 이력을 확인하세요.' }
git push origin main
git fetch origin
$ForkMainSha = (git rev-parse origin/main).Trim()
if ($ForkMainSha -ne $TeamMainSha) { throw 'origin/main과 팀 main이 다릅니다. 동기화가 완료되지 않았습니다.' }
```

`merge --ff-only`가 성공해도 로컬이 이미 앞서 있으면 SHA가 다를 수 있다. 위의 실제 SHA 비교까지 확인해야 동기화 완료다.
명령이 실패하거나 SHA가 다르면 강제 push로 덮어쓰지 않는다. 변경·이력을 확인하고 필요하면 새 clone에서 작업을 재개한다.
원격이 그 사이 바뀌었다면 다시 fetch하여 같은 시점의 값을 비교한다. 동기화한 `main@전체 SHA`와 확인 시점을 기록한다.
다음 자식 작업은 최신 `upstream/main`에서 **새로운** `feature/issue-<Issue번호>-<상위작업명>/sub-<Sub번호>-<개별작업명>`을 만들어 시작한다.
한 자식의 merge 후 완료 조건·연결된 PR·테스트 근거와 보드 상태를 확인한다. 필요한 통합 검증을 마친 실제 완료 카드만 Done으로 정리한다. 추가 자동화 활성화 후 모든 native 자식과 중첩 자식이 Done이면 부모 Issue를 Closed로 닫고 부모 카드도 Done으로 처리한다. 첫 부모 `args.c`는 자식 5개와 `args-*` 5종의 통합 검증을 확인한다. 이미 닫힌 부모는 자식 재작업만으로 자동 재개방되지 않으므로 별도 확인한다.

## 14. 매 작업에서 남길 최소 기록

- 담당 부모·자식 번호, 담당자, 작업 브랜치, 시작 기준 `upstream/main@전체 SHA`.
- 변경 이유·영향·본인이 이해한 내용과 아직 확인하지 못한 내용.
- 검증한 커밋 또는 작업 트리 상태, Linux Bash 실행 위치·정확한 `TESTS` 키·실제 명령·테스트별 결과와 `.result`/`.output`/`.errors` 경로.
- PR 주소, 상대방 승인 여부, merge 결과와 이후 확인한 `main@전체 SHA`.
- 로컬 기록, 원격 push, PR 승인, merge, 테스트 통과를 각각 구분한 상태.

담당 이슈와 PR에 확인한 버전·변경·검증 결과를 누적한다. 이전 기록을 최신 상태처럼 고쳐 쓰지 않고, 후속 확인 시점과 결과를 구분해 남긴다.
