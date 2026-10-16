# Code naming convention

작성일: 2026-10-16 (KST) · 상태: 명명 기준과 최초 추천 목록 작성 · 코드 적용 없음

## 1. 목적과 사용 범위

sub-issue에서 작성할 함수·변수·매개변수·구조체·필드·상수 등의 이름을 Codex가 추천하고, **역할·추천 이유·근거·연결 작업·채택 상태**를 기록한다. 이 문서의 name은 코드 식별자를 뜻한다. 상위 issue 제목(`args.c`), sub-issue 제목, 브랜치명과 구분한다.

사용자 지시에 따라 구현 정답, 코드 본문, 의사코드, 알고리즘, 메모리 배치 절차를 제공하지 않는다. 이름은 역할을 설명하는 수준으로 추천하며, 그 이름을 사용하기 위해 새 함수나 자료구조를 반드시 만들도록 요구하지 않는다.

## 2. 입력과 분석 기준

```text
remote repository = https://github.com/gyaroron/pintos_22.04_lab_docker_week2
local repository = C:\Users\V15_G3_ABA_2023\pintos_lab
학습 목표: 시스템 프로그래밍 전반 — kernel/user pool, kernel thread,
user process/user thread, kernel/user stack, rsp·register·CPU,
semaphore·lock(mutex), thread states와 상태 전이 등
현재 상위 issue 제목: args.c
```

| 기준 | 확인 결과 |
| --- | --- |
| 분석 허용 | 사용자가 로컬 저장소 코드 분석 시작을 명시적으로 요청함 |
| 로컬 분석 버전 | `week2-main@cb2087757d73057b2e3704640ad792e6a169c727` |
| 현재 원격 확인 버전 | `main@87f017f4d99a7b5397e9250fc886bf9030930717` — 2026-10-16 조회 |
| 파일 트리 | 로컬 HEAD와 위 원격 SHA를 가리키는 `week2/main`의 tree가 `b34b9cee1512deeff29308f7a69de0da1eead6aa`로 같음 |
| 수정 상태 | 분석 시작 시 tracked 코드 수정 없음. 기존 저장소 상태 기록 Markdown 1개가 untracked |
| 실행 검증 | 정적 읽기만 수행. 빌드·테스트·구현·새 이름 적용은 하지 않음 |

소스 근거는 실제 로컬 파일을 읽어 확인했다. 아래 GitHub 링크는 같은 파일 트리를 확인한 위 원격 SHA에 고정했다. 두 버전은 파일 내용의 기준이 같지만 커밋 이력이 같은 것은 아니다.

## 3. 추천 기준

| 기준 | 판단할 내용 | 근거 구분 |
| --- | --- | --- |
| 기존 코드와 일치 | 주변 함수·변수의 표기, 이미 쓰는 용어, 역할과 범위 | 실제 코드를 확인한 근거 |
| 역할을 설명 | 이 값이나 동작이 무엇을 의미하는지 읽을 수 있는가 | 추천 이유 |
| 의미를 구분 | 실행 요청 전체, 프로그램 이름, 성공 여부, 종료 결과를 혼동하지 않는가 | 요구사항과 연결한 판단 |
| 표현할 정보 선택 | 단위·수명·소유 관계 등 오해를 줄이는 정보가 필요한가 | 해당 sub-issue에서 검토 |
| 기존 계약 유지 | 테스트·호출부·공개 헤더에서 사용하는 이름을 보존하는가 | 실제 인터페이스 근거 |
| 충돌과 중복 확인 | 같은 범위에 다른 의미로 이미 존재하는 이름이 있는가 | 조회 범위를 명시한 확인 |
| 구현 방식 열어두기 | 특정 알고리즘·자료구조·보조 함수 분해를 강제하지 않는가 | 사용자 학습 방식 |

관찰한 표기 관례는 다음과 같다. 아래는 저장소 전체에 예외 없는 규칙이 있다는 선언이 아니다.

- 함수·변수는 소문자와 밑줄을 사용하는 예가 있다: `process_create_initd`, `process_exec`, `file_name`, `read_bytes`. [process.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L42-L57), [매개변수 예](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L315-L324)
- 매크로·상수에는 대문자와 밑줄을 사용하는 예가 있다: `TID_ERROR`, `PGSIZE`. [process.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L48-L56)
- `argc`, `argv`는 이미 사용자 프로그램 진입 계약에 쓰인다. [entry.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/lib/user/entry.c#L3-L8)

새 이름에는 해당 범위에서 확인한 관례를 우선 적용한다. 가독성만을 이유로 기존 공개 API를 바꾸거나 관련 없는 코드를 일괄 개명하지 않는다. `argc`, `argv`는 기존 테스트·진입 코드의 표기를 유지하는 정책이다. 매개변수 철자 자체가 ABI의 필수 조건이라는 뜻은 아니다.

## 4. 추천·채택·구현 확인을 나누는 방법

1. 분석한 sub-issue의 요구사항과 필요한 역할을 먼저 기록한다.
2. 실제로 새 이름이 필요한 경우에만 후보와 대안을 추천한다. 기존 이름을 그대로 사용하면 그 사실과 이유를 남긴다.
3. sub-issue 본문과 이 문서에 동일한 추천 ID를 기재한다.
4. 구현 담당자가 실제 사용할 이름을 선택하고, PR에서 요구사항·기존 코드와 맞는지 리뷰한다. 문서의 추천 상태만으로 채택이나 구현 완료를 선언하지 않는다.
5. 코드에 사용된 것을 확인한 경우 적용 파일·함수·커밋 SHA를 추가한다. 이름이 바뀌면 이전 추천을 지우지 않고 변경 이력을 남긴다.

상태는 `추천 → 채택 → 코드 사용 확인`으로 구분한다. 사용하지 않기로 했으면 `미채택`, 교체되면 `대체됨`으로 표시한다. 이 명명 절차는 개별 이름마다 사용자의 추가 허가를 요구하는 절차가 아니다. 범위를 바꾸는 개명·공개 인터페이스 변경은 별도 변경안으로 다룬다.

## 5. 최초 이름 추천 목록 — args.c

연결 문서: [args.c 이슈·하위이슈 요구사항 초안](args.c_이슈_하위이슈_요구사항.md)

`ARGS-S1` 등은 초안에서 사용한 작업 ID다. 실제 생성 결과는 ARGS-S1=#2, S2=#3, S3=#4, S4=#5, S5=#6이고 상위는 [args.c #1](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/1)이다. 아래 4개 이름은 **필요한 역할이 실제 구현에 생기는 경우의 선택 후보**다. 코드 구현 방법이나 새 변수의 개수·타입·보관 위치를 정하는 목록이 아니다.

| 추천 ID | 연결 sub-issue | 추천 이름 | 역할 | 추천 이유 | 비교한 대안 / 선택 기준 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| NAME-001 | ARGS-S1, S2, S3 | `launch_command` | 실행 요청 전체를 나타내는 값 | 요청 전체와 프로그램 이름의 의미를 구분한다. 역할을 드러내고 소문자·밑줄 관례와 맞는다. | `file_name`은 실행 파일 이름이라는 뜻으로 읽힐 수 있다. 기존 공개 매개변수를 이 이름으로 자동 개명하라는 뜻은 아니다. | 추천, 미채택·미적용 |
| NAME-002 | ARGS-S1, S2 | `program_name` | 실행할 프로그램의 이름을 뜻하는 값 | 테스트가 기대하는 프로그램 이름이라는 의미를 바로 읽을 수 있다. | `name`보다 대상이 분명하다. 값의 타입이나 만드는 방법은 지정하지 않는다. | 추천, 미채택·미적용 |
| NAME-003 | ARGS-S1 | `launch_succeeded` | 실행 준비의 성공 여부를 나타내는 값이 필요한 경우 | 참·거짓으로 읽히며 무엇의 성공인지 드러난다. | `success`도 좁은 범위에서는 충분하다. 이미 있는 값을 이름만 바꾸거나 같은 의미의 변수를 추가할 필요는 없다. | 추천, 미채택·미적용 |
| NAME-004 | ARGS-S5 | `exit_status` | 프로그램 종료 결과를 나타내는 값이 필요한 경우 | 단순한 일반 반환값과 종료 결과를 구분한다. | `result`보다 의미가 구체적이다. 종료 처리를 새로 설계하라는 지시는 아니다. | 추천, 미채택·미적용 |

각 후보의 근거:

| 추천 ID | 실제로 확인한 근거 | 판단 범위 |
| --- | --- | --- |
| NAME-001 | 실행 요청이 초기 사용자 프로그램 실행 경로로 전달됨. [init.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/threads/init.c#L237-L247), [process.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L36-L57) | 입력 역할을 설명하는 이름 추천 |
| NAME-002 | 각 공식 판정 파일에서 `argv[0]`의 프로그램 이름을 기대함. [args-none.ck](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-none.ck#L6-L11) | 사용자에게 관찰되는 이름의 의미 |
| NAME-003 | 기존 실행 경로에서 성공 여부와 실패 반환을 구분함. [process.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L161-L189) | 성공 여부를 표현할 때의 용어. 기존 `success` 변경은 요구하지 않음 |
| NAME-004 | 종료 상태가 기존 대기 계약의 문서와 공식 기대 출력에 등장함. [process.c 계약](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/userprog/process.c#L193-L203), [판정 파일](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args-single.ck#L6-L12) | 종료 결과라는 의미만 추천 |

검색한 `pintos/userprog`, `pintos/include/userprog`, `pintos/include/threads/thread.h`에서는 위 후보 문자열의 기존 사용을 찾지 못했다. 저장소 전체의 무충돌이나 실제 선언 가능성까지 검증한 것은 아니다. 적용 시 해당 범위를 다시 확인한다.

## 6. 그대로 유지할 기존 이름

| 이름 | 근거 / 유지 이유 | 처리 |
| --- | --- | --- |
| `main`, `argc`, `argv` | 실제 테스트와 사용자 프로그램 진입부가 사용하는 기존 계약 | 새 추천으로 세지 않음. 유지 |
| `_start` | 기존 사용자 프로그램 진입 함수 | 유지 |
| `process_create_initd`, `process_exec`, `process_wait`, `process_exit` | 공개 헤더에 선언된 기존 API | 이번 명명 추천만을 이유로 개명하지 않음 |
| `test_name` | 테스트의 출력 접두사와 연결된 기존 식별자 | 학습 과제 해결을 위해 테스트 식별자를 바꾸지 않음 |

근거: [process.h](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/include/userprog/process.h#L6-L11), [entry.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/lib/user/entry.c#L3-L8), [args.c](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/blob/87f017f4d99a7b5397e9250fc886bf9030930717/pintos/tests/userprog/args.c#L9-L24)

## 7. sub-issue에 넣을 명명 기록 양식

```markdown
## 코드 이름 추천
- 추천 ID:
- 종류 / 추천 이름:
- 필요한 역할:
- 추천 이유:
- 근거 파일·행 / 기준 버전:
- 비교한 대안 / 이 이름을 권하는 기준:
- 기존 계약 이름 유지 여부:
- 상태 (추천 / 채택 / 코드 사용 확인 / 미채택 / 대체됨):
- 채택한 이름 / 적용 파일·커밋 (확인한 경우):
```

로컬 협업 문서와 같은 내용을 설정 PR에 포함한다. 실제 GitHub sub-issue에는 필요한 추천 이유·대안·상태를 본문에도 기재했다. 기본 브랜치의 문서로 제공되는 시점은 설정 PR 병합 후이며, PR 검토 중에는 해당 브랜치의 파일을 확인한다.

## 8. 변경 이력

| 날짜 | 변경 | 근거 / 상태 |
| --- | --- | --- |
| 2026-10-16 | 최초 생성. 기존 표기·API 확인, 역할 중심 후보 4개와 이유·대안·근거 등록 | 사용자 명명 문서 요청과 로컬 코드 분석 시작 요청. 코드 적용·채택 없음 |

이름을 바꾸면 날짜·추천 ID·이전 이름·새 이름·이유·관련 sub-issue·검증한 버전을 새 행으로 추가한다. 미채택 후보도 이유를 남겨 같은 논의를 반복하지 않게 한다.
