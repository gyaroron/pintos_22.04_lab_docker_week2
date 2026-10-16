# args.c — 이슈·하위이슈 요구사항 초안

작성일: 2026-10-16 (KST) · 상태: **GitHub 상위 #1·하위 #2~#6 생성, 구현·테스트 미실행**

[상위 args.c #1](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/1) · [공개 Project PintOS Week2](https://github.com/users/gyaroron/projects/10)

아래 내용은 실제 테스트에서 확인한 요구사항, 완료 조건, 학습 목표, 이름 추천, 예상 난이도다. 코드와 테스트를 실행해 PASS/FAIL을 확인한 결과는 아니다.

## 1. 입력과 기준 버전

```text
remote repository = https://github.com/gyaroron/pintos_22.04_lab_docker_week2
local repository = C:\Users\V15_G3_ABA_2023\pintos_lab
test directory = C:\Users\V15_G3_ABA_2023\pintos_lab\pintos\tests\userprog
```

- 로컬 분석 기준: `week2-main@cb2087757d73057b2e3704640ad792e6a169c727`.
- 현재 원격 확인 기준: `main@87f017f4d99a7b5397e9250fc886bf9030930717`.
- 두 끝의 파일 tree는 `b34b9cee1512deeff29308f7a69de0da1eead6aa`로 같다. 커밋 이력은 다르다.
- 분석 시작 시 tracked 코드 변경은 없고, 기존 상태 기록 Markdown 하나만 untracked였다. 로컬 `origin`은 이전 주차 주소이며, `week2`가 이번 원격 주소다. 어느 remote나 브랜치도 변경하지 않았다.
- 분석은 정적 소스 읽기를 기준으로 했다. 빌드·테스트 실행·코드 수정은 하지 않았다.

아래 링크는 로컬에서 확인한 코드와 파일 tree가 같은 원격 전체 SHA에 고정했다. 실제 개발 브랜치를 만들기 전에는 로컬과 원격의 이력 차이를 확인해야 한다. 기존 로컬 브랜치가 현재 원격 기본 브랜치와 동일한 이력이라고 가정하지 않는다.

## 2. 테스트 범위부터 구분

`args.c`는 5개 `args-*` 실행 테스트가 공유하는 소스다. 독립된 `args`라는 채점 항목을 추가로 세지 않는다. 같은 소스로 `child-args` 보조 프로그램도 만들며, 이것은 `exec-arg`에서 사용한다.

| 구분 | 확인한 항목 | 이 초안에서의 처리 |
| --- | --- | --- |
| 직접 테스트 | `args-none`, `args-single`, `args-multiple`, `args-many`, `args-dbl-space` | 상위 issue `args.c`의 필수 5종 |
| 공용 소스 사용 | `child-args` | 보조 프로그램. 별도의 직접 테스트로 세지 않음 |
| 연관 테스트 | `exec-arg` | 관련 이슈에서 다룰 통합·의존 관계. 이 초안의 필수 5종과 구분 |

근거: [소스 설명](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args.c#L1-L4), [5종 소스 등록](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/Make.tests#L25-L29), [보조 프로그램 등록](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/Make.tests#L101-L109), [exec-arg의 사용](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/exec-arg.c#L8-L11).

전체 userprog 범위는 파일 개수와 다르다. 현재 등록 설정에서 최상위 `tests/userprog`는 63개, 기본 설정에 포함된 `no-vm`은 1개다. `dup2`의 추가 2개는 정의되어 있으나 현재 `Make.vars`에서는 활성화가 주석 처리되어 있다. 파일 폴더 전체의 정의된 항목과 현재 기본 실행 범위를 구분해 추적하며, 이 수는 통과한 테스트 수가 아니다. 또한 기본 `make check`에는 `tests/filesys/base`, `tests/threads`도 함께 들어간다. [현재 TEST_SUBDIRS](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/Make.vars#L3-L12)

## 3. 난이도 판단 기준

난이도는 검토자의 예상 판단이며, 현재 코드·검증 범위·필요한 개념을 기준으로 한다. 소요 시간이나 측정한 실패율이 아니다. 테스트가 최종 FAIL이라는 뜻도 아니다.

| 라벨 | 기준 |
| --- | --- |
| 난이도 ⭐ | 범위가 작고 요구·검증 기준이 단순함 |
| 난이도 ⭐⭐ | 한정된 경계조건 또는 반복 가능한 검증 중심 |
| 난이도 ⭐⭐⭐ | 여러 입력·관련 코드·상태나 경계를 함께 확인해야 함 |
| 난이도 ⭐⭐⭐⭐ | 사용자/커널 경계 등 여러 계약과 공통 선행 기능을 함께 충족해야 함 |
| 난이도 ⭐⭐⭐⭐⭐ | 넓은 범위의 상호작용·실패·동시성 조건을 통합 검증해야 함 |

공통 선행 기능이 다른 작업에서 완성되면 해당 sub-issue의 체감 난이도는 달라질 수 있다. 평가는 이유와 함께 변경 이력에 남긴다.

## 4. 상위 issue 본문

**제목:** `args.c`  
**라벨 제안:** `epic`, `난이도 ⭐⭐⭐⭐`

### 목표

5개 직접 테스트에서 사용자 프로그램이 관찰하는 인자의 개수·내용·순서·끝 표시·정렬과 출력·정상 종료가 공식 판정 기준을 충족한다.

### 요구사항과 판정 근거

| 테스트 | 등록된 추가 입력 | 요구 결과 | 근거 |
| --- | --- | --- | --- |
| `args-none` | 없음 | `argc=1`, `argv[0]='args-none'`, `argv[1]=null` | [args-none.ck](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-none.ck#L5-L13) |
| `args-single` | `onearg` | `argc=2`, 프로그램명 뒤에 `onearg`, `argv[2]=null` | [args-single.ck](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-single.ck#L5-L14) |
| `args-multiple` | `some arguments for you!` | `argc=5`, 프로그램명 뒤의 4개 문자열이 내용·순서대로 유지되고 `argv[5]=null` | [args-multiple.ck](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-multiple.ck#L5-L17) |
| `args-many` | `a`부터 `v`까지 22개 | `argc=23`, 문자열 누락·추가·순서 변경 없이 전달되고 `argv[23]=null` | [args-many.ck](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-many.ck#L5-L35) |
| `args-dbl-space` | `two`와 `spaces!` 사이 공백 2개 | `argc=3`, 프로그램명 뒤에 `two`, `spaces!`가 전달되고 빈 인자가 생기지 않으며 `argv[3]=null` | [args-dbl-space.ck](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-dbl-space.ck#L5-L15) |

추가 입력의 근거는 [Make.tests 111–114행](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/Make.tests#L111-L114)이다. `args-none`에는 별도 추가 입력이 등록되어 있지 않다.

공통 요구사항:

- `argv` 주소가 8의 배수여야 한다. 이 테스트 소스가 직접 확인하는 것은 `argv` 주소이며 별도 스택 포인터까지 같은 방식으로 검사한다고 확대하지 않는다. [검사 근거](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args.c#L15-L16)
- `begin`, 인자 정보, `end`, `<실행 테스트 이름>: exit(0)`이 공식 기대 출력과 일치해야 한다. 기대하는 일부 줄만 보이는 것으로 완료 처리하지 않는다.
- 공식 검사기의 부팅·실행 완료·정상 종료 조건을 충족하고 panic·FAIL·TIMEOUT 등 실패 조건이 없어야 한다. [검사 근거](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/tests.pm#L28-L53)
- 테스트·기대 출력·판정 기준을 약화하거나 바꿔서 통과로 만들지 않는다.

### 현재 코드에서 확인한 범위

초기 실행과 사용자 진입에 해당하는 기존 API는 존재하지만, 인자 전달 요구에 해당하는 부분은 미완성 표시가 있다. 출력·정상 종료·기다림에도 관련된 미완성 지점이 있어, 인자 내용만 맞았다고 전체 PASS를 보장할 수 없다. 이것은 정적 코드 관찰이며 실제 실패 결과는 아니다.

근거: [기존 공개 API](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/include/userprog/process.h#L6-L11), [인자 전달 관련 표시](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L417-L418), [대기·종료 관련 범위](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L193-L219), [시스템 호출 처리 범위](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/syscall.c#L40-L46).

### 난이도 판단 이유

**4/5**. 다섯 종류의 입력뿐 아니라 사용자/커널 경계와 시작·출력·종료의 여러 계약이 관련되는 현재 코드 기준으로 판단했다. 개별 케이스의 조건은 작더라도 상위 issue 전체의 통과에는 공통 선행 조건이 필요하다.

### 학습 목표와 이해 확인

실행 인자와 시스템 호출 인자의 역할 차이, 콘솔 출력과 종료 상태의 의미를 설명한다.

- **학습 근거:** [System Calls](https://casys-kaist.github.io/pintos-kaist/project2/system_call.html)(2026-10-16 확인)의 관련 절 및 이 이슈의 고정 테스트 근거. 인자·출력·종료 요구와 System Call Details, exec, write, exit, wait 설명을 연결한 추천이다.

- 이 테스트에서 사용자 프로그램이 실제로 관찰하는 정보는 무엇인가?
- 기대하는 출력 일부가 있어도 공식 PASS로 판단할 수 없는 경우는 무엇인가?
- 이 테스트가 직접 검사하는 조건과 rsp·register·CPU 관련 심화 학습에서 따로 확인해야 할 내용을 구분할 수 있는가?

### 완료 조건

- [ ] 아래 sub-issue의 필요한 작업이 리뷰·통합되었다.
- [ ] 필수 5종의 공식 `.result`가 모두 `PASS`다.
- [ ] 코드 버전·실행 환경·명령·결과와 로그를 기록했다.
- [ ] 하위 이슈 진행률과 별도로 상위의 통합 결과를 확인했다.

## 5. Sub-issue 본문 초안

`ARGS-S1` 등의 초안 ID는 실제 생성 결과에 다음과 같이 연결했다. 현재 배정은 시작용이며 팀에서 요구·공유 범위를 확인해 조정한다. 같은 구현 영역을 다룰 수 있으므로 독립적인 구현으로 기계적으로 병렬 배정하지 않는다.

| 초안 ID | 실제 하위 이슈 | 초기 담당자 | 리뷰어 | 작업 시작 시 사용할 브랜치 |
| --- | --- | --- | --- | --- |
| ARGS-S1 | [#2](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/2) | gyaroron | haihai1222555-droid | `feature/1/2` |
| ARGS-S2 | [#3](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/3) | haihai1222555-droid | gyaroron | `feature/1/3` |
| ARGS-S3 | [#4](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/4) | gyaroron | haihai1222555-droid | `feature/1/4` |
| ARGS-S4 | [#5](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/5) | haihai1222555-droid | gyaroron | `feature/1/5` |
| ARGS-S5 | [#6](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/6) | haihai1222555-droid | gyaroron | `feature/1/6` |

### ARGS-S1 — args.c: 추가 인자 없는 실행의 기본 계약 충족

- **난이도:** `난이도 ⭐⭐⭐` (3/5).
- **요구사항:** `args-none`에서 실행 프로그램 이름, `argc=1`, 마지막 null, 기대 출력과 정상 종료가 일치해야 한다. 등록된 테스트 프로그램을 정상적으로 실행할 수 있어야 한다.
- **완료 조건:** `args-none.result`가 PASS이고 소스·판정 변경 없이 재현된다. 검증한 버전과 로그를 남긴다.
- **난이도 근거:** 입력은 가장 작지만 현재 기준 코드에서 사용자 프로그램 시작과 관찰 가능한 실행 결과라는 공통 전제가 필요하다.
- **학습 목표:** 추가 실행 인자가 없는 경우의 프로그램 진입 요구를 설명하고, 실행 인자와 시스템 호출 인자를 구분하며 정상 종료 상태의 의미를 이해한다.
- **학습 근거:** [System Calls](https://casys-kaist.github.io/pintos-kaist/project2/system_call.html)(2026-10-16 확인)의 관련 절 및 이 이슈의 고정 테스트 근거. args-none의 요구와 System Call Details, exec, exit 설명을 연결했다. argc의 기대값은 테스트 소스를 근거로 한다.
- **이해 확인 질문:** 인자가 없다는 말과 프로그램에서 관찰하는 `argc=1`은 어떤 관계인가?
- **이름 추천:** NAME-001 `launch_command`, NAME-002 `program_name`, NAME-003 `launch_succeeded`. 역할이 필요한 경우의 후보이며, 기존 공개 API 개명을 요구하지 않는다.
- **연결:** 위 상위 issue의 `args-none` 근거 및 [명명 문서](code%20naming%20convention.md).

### ARGS-S2 — args.c: 단일·복수 인자의 내용과 순서 보장

- **난이도:** `난이도 ⭐⭐⭐` (3/5).
- **요구사항:** `args-single`, `args-multiple`에서 개수·문자열 내용·순서·마지막 null이 위 표의 값과 일치해야 한다. 다른 입력의 문자열이나 상태가 섞이지 않아야 한다.
- **완료 조건:** 두 공식 `.result`가 PASS이고 `args-none`도 계속 PASS다.
- **난이도 근거:** 서로 다른 수와 길이의 문자열을 사용자 프로그램이 정확하게 관찰할 수 있어야 하며 관련 경계를 함께 확인한다.
- **학습 목표:** 입력 문자열과 프로그램이 관찰하는 인자 값·순서의 관계를 설명한다.
- **학습 근거:** [System Calls](https://casys-kaist.github.io/pintos-kaist/project2/system_call.html)(2026-10-16 확인)의 관련 절 및 이 이슈의 고정 테스트 근거. 단일·복수 인자 요구와 exec의 실행 인자 설명을 연결했다. 개수·내용·순서의 구체적인 판정은 테스트 소스를 근거로 한다.
- **이해 확인 질문:** 인자 개수는 맞지만 내용이나 순서가 다르면 어떤 판정 근거로 실패를 설명할 수 있는가?
- **이름 추천:** NAME-001 `launch_command`, NAME-002 `program_name`이 필요하면 S1과 같은 의미로 재사용한다. 기존 `argc`, `argv` 이름은 유지한다. 별도 자료구조나 보조 함수 이름을 필수로 정하지 않는다.
- **의존성:** 기본 실행·출력 경로를 S1과 공유한다. 같은 코드를 두 번 구현하는 작업으로 나누지 않는다.

### ARGS-S3 — args.c: 연속 공백 입력의 인자 요구 충족

- **난이도:** `난이도 ⭐⭐` (2/5).
- **요구사항:** 등록된 `two  spaces!` 입력에서 빈 인자가 생기지 않고 `argc=3`, `two`, `spaces!`, 마지막 null이 정확해야 한다.
- **완료 조건:** `args-dbl-space.result`가 PASS이고 앞선 3종의 결과가 유지된다.
- **난이도 근거:** 입력 경계조건은 한정되어 있지만 공백의 수와 실제 인자 개수를 구분해야 한다.
- **학습 목표:** 명령행의 표현과 프로그램이 받는 논리적 인자를 구분하고 경계 입력의 기대 결과를 설명한다.
- **학습 근거:** [System Calls](https://casys-kaist.github.io/pintos-kaist/project2/system_call.html)(2026-10-16 확인)의 관련 절 및 이 이슈의 고정 테스트 근거. 연속 공백 요구와 exec의 실행 인자 설명을 연결했다. 공백의 처리 조건은 args-dbl-space의 등록 입력과 판정을 근거로 한다.
- **이해 확인 질문:** 연속 공백 수와 인자 수가 반드시 같아야 하는가? 이 테스트의 기대값은 무엇을 요구하는가?
- **이름 추천:** 요청 전체를 나타내는 값이 필요하면 NAME-001 `launch_command`.
- **범위:** 이 테스트를 근거로 따옴표·이스케이프 등 별도의 입력 문법을 필수 요구로 확대하지 않는다.

### ARGS-S4 — args.c: 다수 인자와 관찰 가능한 정렬 조건 충족

- **난이도:** `난이도 ⭐⭐⭐` (3/5).
- **요구사항:** `args-many`에서 추가 인자 22개가 누락·추가·순서 변경 없이 전달되고 `argc=23`, 마지막 null이 정확해야 한다. 5종 모두에서 소스가 검사하는 `argv` 주소의 8바이트 정렬 조건을 충족해야 한다.
- **완료 조건:** `args-many.result`가 PASS이며 5종에서 정렬 경고가 추가 출력되지 않고 이전 조건도 유지된다.
- **난이도 근거:** 수량 증가와 주소 관련 관찰 조건을 함께 확인해야 한다.
- **학습 목표:** 검사되는 주소·정렬 조건을 설명하고, 실행 시 인자 계약과 시스템 호출 레지스터 계약을 구분한다.
- **학습 근거:** [System Calls](https://casys-kaist.github.io/pintos-kaist/project2/system_call.html)(2026-10-16 확인)의 관련 절 및 이 이슈의 고정 테스트 근거. 다수 인자·주소 검사와 System Call Details를 비교한 추천이다. 정렬 수치의 근거는 args.c이며 시스템 호출 문서에서 유도하지 않는다.
- **이해 확인 질문:** 이 테스트가 직접 검사하는 주소와 직접 검사하지 않는 상태를 어떻게 구분할 수 있는가?
- **이름 추천:** 기존 `argc`, `argv` 유지. 이번 요구만으로 새 식별자를 추가할 필요는 없으며 실제 역할이 정해지면 명명 문서에 추천을 추가한다.
- **범위:** 테스트 소스와 공식 판정에서 관찰하는 조건을 기준으로 검증한다.

### ARGS-S5 — args.c: 출력·정상 종료와 공식 테스트 5종 검증

- **난이도:** `난이도 ⭐⭐⭐` (3/5).
- **요구사항:** 5종의 공식 출력·정상 종료와 결과 파일을 함께 검증한다. 현재 관련 기능의 미완성 여부가 검증을 막으면 해당 관찰과 필요한 행동 요구를 공유하고 연결 작업으로 관리한다.
- **완료 조건:** 5개의 `.result`가 모두 PASS, 검증 버전·환경·명령·새 실행의 로그가 기록되어 있다. 테스트·기대 출력·판정 기준을 변경하지 않는다. 기존 캐시 결과를 이번 실행 결과로 오인하지 않는다.
- **난이도 근거:** 재현성 확인에 더해 현재 코드의 출력·종료 등 공통 전제가 영향을 준다. 구현이 끝난 뒤 단순 결과 수집만 남았다면 평가를 낮출 수 있다.
- **학습 목표:** 콘솔 출력, 정상 종료 상태, 부모의 종료 관찰을 구분해 공식 판정 결과와 연결한다.
- **학습 근거:** [System Calls](https://casys-kaist.github.io/pintos-kaist/project2/system_call.html)(2026-10-16 확인)의 관련 절 및 이 이슈의 고정 테스트 근거. 출력·종료 검증과 write, exit, wait 설명을 연결했다.
- **이해 확인 질문:** 출력 일부의 일치와 공식 PASS 판정 사이에는 어떤 차이가 있는가?
- **이름 추천:** 종료 결과를 표현할 새 역할이 필요하면 NAME-004 `exit_status`. 명명만으로 별도 종료 구현 구조를 정하지 않는다.
- **의존성:** 검증 계획·기대 결과 정리는 먼저 할 수 있지만 최종 PASS 확인은 앞선 요구가 충족된 뒤 수행한다. 공유 출력·종료 기능이 다른 테스트 이슈에도 필요하면 중복 구현 작업을 만들지 않는다.

## 6. 학습 확인 기록

각 하위 이슈의 학습 목표와 이해 확인 질문을 기준으로 설명과 근거를 기록한다. 테스트 통과 결과와 본인이 설명할 수 있는 개념을 구분해 PR에서 검토한다.

## 7. 실제 검증 시 사용할 명령 안내

**아래 명령은 아직 실행하지 않았다.** Linux 개발 컨테이너에서 해당 코드 저장소 내부의 터미널을 열고, 프로젝트 도구와 활성화 상태를 확인한 뒤 사용한다.

```bash
cd "$(git rev-parse --show-toplevel)/pintos/userprog"
make -B check TESTS='tests/userprog/args-none tests/userprog/args-single tests/userprog/args-multiple tests/userprog/args-many tests/userprog/args-dbl-space'
```

`-B`는 기존 결과에 의존하지 않고 해당 명령의 재생성을 요청한다. 실제 환경에서 빌드·실행이 성공하는지는 아직 확인하지 않았다. 검증 당시 전체 SHA와 tracked 변경 여부를 먼저 기록하고, `build/tests/userprog/`의 각 `.result`, `.output`, `.errors`를 함께 확인한다. 위 명령은 args 5종 선택 실행이며 전체 userprog 통과를 증명하지 않는다.

근거: [check의 build 디렉터리 실행](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/Makefile.kernel#L3-L14), [결과 집계](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/Make.tests#L27-L45), [공식 판정 실행](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/Make.tests#L71-L78).

## 8. 적용과 변경 상태

- 완료: 로컬 소스·5종 판정·등록 관계 분석, 요구사항과 완료 조건·학습 목표·난이도·명명 후보 작성.
- GitHub 적용: 상위 #1·하위 #2~#6 생성·부모 연결·난이도와 담당 배정, 공개 Project #10 등록. 모두 Todo다.
- 구현·빌드·테스트는 미실행이다. 작업용 feature 브랜치는 담당자가 시작할 때 만들며, 문서·양식은 별도 설정 PR로 반영한다.
- 전체 userprog의 나머지 테스트별 상세 분석·작업 분해는 아직 수행하지 않았다. 범위 목록 확인과 현재 args.c 상세 분석을 구분한다.
