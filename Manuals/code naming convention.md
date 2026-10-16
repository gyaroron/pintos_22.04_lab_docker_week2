# Code naming convention

작성일: 2026-10-16 (KST) · 상태: args.c 4개 및 추가 테스트 38개 역할별 선택 후보 기록 · 코드 적용 없음

## 1. 목적과 사용 범위

sub-issue에서 작성할 함수·변수·매개변수·구조체·필드·상수 등의 이름을 검토자가 추천하고, **역할·추천 이유·근거·연결 작업·채택 상태**를 기록한다. 이 문서의 name은 코드 식별자를 뜻한다. 상위 issue 제목(`args.c`), sub-issue 제목, 브랜치명과 구분한다.

이름은 역할을 설명하는 후보로 추천하며, 구현 담당자가 실제로 필요한 식별자를 선택한다.

명명 후보는 작업 담당 배정을 뜻하지 않는다. 모든 Issue·Sub-issue의 주 담당자·리뷰어와 후보 검토 담당은 사용자가 정하기 전까지 공란으로 유지하며 자동화가 자동 배정하거나 리뷰 요청을 보내지 않는다.

담당자는 사용자가 이슈 오른쪽 **Assignees**에서 직접 선택·해제한다. 자동화가 기본 브랜치에 병합된 뒤 이 선택을 본문 주 담당자와 상위 이슈 표에 반영하며, 해제하면 공란으로 표시한다. 리뷰어는 자동 배정하지 않는다. [담당자 선택과 자동 갱신](담당자_선택과_자동_갱신.md)을 참고한다.

## 2. 입력과 분석 기준

```text
remote repository = https://github.com/gyaroron/pintos_22.04_lab_docker_week2
local repository = C:\Users\V15_G3_ABA_2023\pintos_lab
최초 상위 issue 제목: args.c
추가 범위: userprog의 나머지 테스트 61종
```

| 기준 | 확인 결과 |
| --- | --- |
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
| 역할에 맞는 선택 | 구현 담당자가 필요한 역할과 범위에 맞는 후보를 선택할 수 있는가 | 명명 문서의 목적 |

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

상태는 `추천 → 채택 → 코드 사용 확인`으로 구분한다. 사용하지 않기로 했으면 `미채택`, 교체되면 `대체됨`으로 표시한다. 구현 담당자가 이름을 선택하고 PR에서 검토한다. 범위를 바꾸는 개명·공개 인터페이스 변경은 별도 변경안으로 다룬다.

## 5. 최초 이름 추천 목록 — args.c

연결 문서: [args.c 이슈·하위이슈 요구사항 초안](args.c_이슈_하위이슈_요구사항.md)

`ARGS-S1` 등은 초안에서 사용한 작업 ID다. 실제 생성 결과는 ARGS-S1=#2, S2=#3, S3=#4, S4=#5, S5=#6이고 상위는 [args.c #1](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/1)이다. 아래 4개 이름은 **필요한 역할이 실제 구현에 생기는 경우의 선택 후보**다. 실제 타입·사용 범위·선언 위치는 담당자가 코드와 요구사항을 확인해 결정한다.

| 추천 ID | 연결 sub-issue | 추천 이름 | 역할 | 추천 이유 | 비교한 대안 / 선택 기준 | 상태 |
| --- | --- | --- | --- | --- | --- | --- |
| NAME-001 | ARGS-S1, S2, S3 | `launch_command` | 실행 요청 전체를 나타내는 값 | 요청 전체와 프로그램 이름의 의미를 구분한다. 역할을 드러내고 소문자·밑줄 관례와 맞는다. | `file_name`은 실행 파일 이름이라는 뜻으로 읽힐 수 있다. 기존 공개 매개변수를 이 이름으로 자동 개명하라는 뜻은 아니다. | 추천, 미채택·미적용 |
| NAME-002 | ARGS-S1, S2 | `program_name` | 실행할 프로그램의 이름을 뜻하는 값 | 테스트가 기대하는 프로그램 이름이라는 의미를 바로 읽을 수 있다. | `name`보다 대상이 분명하다. 역할에 맞는 타입과 사용 범위를 구현 단계에서 검토한다. | 추천, 미채택·미적용 |
| NAME-003 | ARGS-S1 | `launch_succeeded` | 실행 준비의 성공 여부를 나타내는 값이 필요한 경우 | 참·거짓으로 읽히며 무엇의 성공인지 드러난다. | `success`도 좁은 범위에서는 충분하다. 이미 있는 값을 이름만 바꾸거나 같은 의미의 변수를 추가할 필요는 없다. | 추천, 미채택·미적용 |
| NAME-004 | ARGS-S5 | `exit_status` | 프로그램 종료 결과를 나타내는 값이 필요한 경우 | 단순한 일반 반환값과 종료 결과를 구분한다. | `result`보다 의미가 구체적이다. 기존 종료 결과를 나타내는 값이 있다면 먼저 그 역할과 이름을 확인한다. | 추천, 미채택·미적용 |

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
| 2026-10-16 | 최초 생성. 기존 표기·API 확인, 역할 중심 후보 4개와 이유·대안·근거 등록 | 요구사항과 로컬 소스를 근거로 추천. 코드 적용·채택 없음 |

이름을 바꾸면 날짜·추천 ID·이전 이름·새 이름·이유·관련 sub-issue·검증한 버전을 새 행으로 추가한다. 미채택 후보도 이유를 남겨 같은 논의를 반복하지 않게 한다.


<!-- REMAINING-TEST-NAMES-BEGIN -->

## 추가 테스트의 역할별 이름 후보 — 2026-10-16

아래는 실제 작업에서 해당 역할이 필요한 경우 선택할 후보다. 추천·채택·코드 사용은 구분하며 기존 공개 API·테스트 이름은 유지한다.

| ID | 연결 테스트·작업 | 후보 | 역할 | 이유·기준 | 대안 | 상태 |
|---|---|---|---|---|---|---|
| W2-NAME-exit-01 | exit / [#13](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/13) | `exit_status` | 프로세스가 종료 시 전달하는 상태 값 | 호출자의 임시 계산 값과 프로세스 종료 결과를 구별한다. 종료 결과를 나타내는 범위에서만 사용하고 기존 API 인자는 유지 | status | 추천·미채택·미적용 |
| W2-NAME-create-normal-01 | create-normal / [#15](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/15) | `initial_size_bytes` | 생성 요청의 초기 파일 크기(바이트) | 크기 단위를 이름에서 확인할 수 있다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | initial_size | 추천·미채택·미적용 |
| W2-NAME-create-long-01 | create-long / [#23](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/23) | `file_name_length` | 요청한 파일명의 문자 수 | 주소나 배열 용량과 문자열 길이를 구분하는 역할이 드러난다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | name_length | 추천·미채택·미적용 |
| W2-NAME-create-exists-01 | create-exists / [#25](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/25) | `creation_succeeded` | 개별 생성 요청의 성공 여부 | 파일 존재 여부와 이번 요청의 반환 결과를 구분한다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | create_result | 추천·미채택·미적용 |
| W2-NAME-open-normal-01 | open-normal / [#29](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/29) | `opened_fd` | 새로 연 파일에 대해 반환된 디스크립터 | 정수의 역할이 fd임을 명확히 나타낸다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | file_handle | 추천·미채택·미적용 |
| W2-NAME-open-twice-01 | open-twice / [#41](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/41) | `first_opened_fd` | 함께 관찰하는 첫 번째 open의 반환 fd | 동일 파일명과 서로 다른 open 결과를 구분한다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | first_fd | 추천·미채택·미적용 |
| W2-NAME-open-twice-02 | open-twice / [#41](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/41) | `second_opened_fd` | 함께 관찰하는 두 번째 open의 반환 fd | 두 반환 결과 사이의 비교 역할을 드러낸다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | second_fd | 추천·미채택·미적용 |
| W2-NAME-close-normal-01 | close-normal / [#43](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/43) | `fd_to_close` | 닫기 요청 대상의 파일 디스크립터 | 열린 파일 자체와 닫을 정수 식별자의 역할을 구분한다. 저장소의 snake_case와 역할 명시 원칙을 따른 새 지역 변수의 선택 후보이며 기존 공개 API·테스트 이름은 유지한다. | closing_fd | 추천·미채택·미적용 |
| W2-NAME-read-normal-01 | read-normal / [#49](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/49) | `bytes_read` | 한 번의 읽기로 관찰한 바이트 수 | read의 결과가 바이트 개수임을 이름에 명시하여 오류 코드나 파일 크기와 혼동을 줄인다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | result | 추천·미채택·미적용 |
| W2-NAME-read-bad-ptr-01 | read-bad-ptr / [#51](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/51) | `user_buffer` | 사용자 프로세스가 넘긴 데이터 버퍼 주소 | 주소의 소유 영역을 드러내되, 유효성 검사 방식이나 자료구조를 이름에 고정하지 않는다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | buffer | 추천·미채택·미적용 |
| W2-NAME-read-boundary-01 | read-boundary / [#53](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/53) | `bytes_read` | 경계 버퍼로 읽은 실제 바이트 수 | 요청 길이와 관찰된 길이를 단위가 드러나는 이름으로 비교할 수 있다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | byte_cnt | 추천·미채택·미적용 |
| W2-NAME-read-zero-01 | read-zero / [#55](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/55) | `bytes_read` | 0바이트 요청의 관찰된 읽기 길이 | 0과 오류 값을 비교할 때 결과가 바이트 수라는 의미를 유지한다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | result | 추천·미채택·미적용 |
| W2-NAME-write-normal-01 | write-normal / [#61](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/61) | `bytes_written` | 쓰기 호출이 보고한 실제 바이트 수 | 파일 크기·요청 크기와 반환 수를 혼동하지 않도록 바이트 단위를 명시한다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | result | 추천·미채택·미적용 |
| W2-NAME-write-bad-ptr-01 | write-bad-ptr / [#63](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/63) | `user_buffer` | 사용자 프로세스가 넘긴 쓰기 원본 버퍼 | 버퍼의 출처를 드러내면서 유효성 처리 방식을 고정하지 않는 역할 중심 후보이다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | buffer | 추천·미채택·미적용 |
| W2-NAME-write-boundary-01 | write-boundary / [#65](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/65) | `bytes_written` | 경계 버퍼 쓰기의 관찰된 반환 길이 | 경계를 넘는 버퍼 주소와 실제 쓰인 바이트 수의 역할을 구분한다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | byte_cnt | 추천·미채택·미적용 |
| W2-NAME-write-zero-01 | write-zero / [#67](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/67) | `bytes_written` | 0바이트 쓰기 요청의 관찰된 반환 수 | 0이 성공한 바이트 수인지 일반 상태 코드인지 드러내는 역할 이름이다. 기존 API·테스트 이름은 유지하고, 새 지역 변수에 필요할 때 역할과 단위를 드러내는 이름을 선택한다. | result | 추천·미채택·미적용 |
| W2-NAME-fork-once-01 | fork-once / [#73](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/73) | `child_pid` | 부모가 받은 직접 자식의 프로세스 식별자 | 현재 프로세스의 PID와 기다릴 자식 PID를 구별한다. 값이 직접 자식을 가리키는 범위에서만 child 접두어 사용 | pid | 추천·미채택·미적용 |
| W2-NAME-fork-multiple-01 | fork-multiple / [#77](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/77) | `child_exit_status` | 이번 회차에서 wait로 받은 자식 종료 상태 | 부모의 종료 상태나 다음 자식의 결과와 구별한다. 자식 결과를 저장·출력하는 역할이 명확할 때 선택 | status | 추천·미채택·미적용 |
| W2-NAME-fork-recursive-01 | fork-recursive / [#80](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/80) | `child_exit_status` | 직접 자식에서 회수한 종료 결과 | 여러 세대의 자기 상태와 자식 상태를 구분한다. 직접 자식의 wait 결과인 경우에만 사용 | status | 추천·미채택·미적용 |
| W2-NAME-fork-read-01 | fork-read / [#82](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/82) | `bytes_read` | 이번 read 호출에서 실제로 읽은 바이트 수 | 요청 길이와 실제 읽기 결과를 구별하고 단위를 드러낸다. 읽기 결과가 저장되는 범위에서 사용 | byte_cnt | 추천·미채택·미적용 |
| W2-NAME-fork-close-01 | fork-close / [#85](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/85) | `inherited_fd` | 자식에서 상속되어 사용하는 파일 디스크립터 | 새로 연 핸들과 fork로 물려받은 핸들을 구분한다. 상속 경로를 설명할 필요가 있는 범위에서만 선택 | fd | 추천·미채택·미적용 |
| W2-NAME-fork-boundary-01 | fork-boundary / [#88](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/88) | `child_name` | fork 호출에 전달되는 자식의 표시 이름 | 실행 파일 경로와 새 프로세스의 이름 역할을 구별한다. 실행 파일 로딩 명령과 혼동하지 않는 경우 선택 | name | 추천·미채택·미적용 |
| W2-NAME-exec-once-01 | exec-once / [#91](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/91) | `exec_command` | 교체할 프로그램과 인자를 나타내는 exec 입력 | fork용 표시 이름과 실행 교체 명령의 차이를 드러낸다. 이미 cmd_line을 쓰는 API·코드와의 일관성을 우선 고려 | cmd_line | 추천·미채택·미적용 |
| W2-NAME-exec-arg-01 | exec-arg / [#93](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/93) | `exec_command` | 교체 프로그램과 추가 인자를 함께 표현하는 입력 | 파일명 단독 값과 전체 실행 명령을 구별한다. 인자를 포함하는 전체 문자열이면 command 역할이 적합 | program_name | 추천·미채택·미적용 |
| W2-NAME-exec-boundary-01 | exec-boundary / [#96](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/96) | `exec_command` | exec에 전달하는 경계 문자열 명령 | 자식 이름 인자와 실제 교체 명령의 역할을 구별한다. 주변 코드가 cmd_line을 사용하면 일관성을 우선 | command_line | 추천·미채택·미적용 |
| W2-NAME-exec-read-01 | exec-read / [#103](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/103) | `inherited_fd` | exec 이후에도 사용하는 상속 파일 디스크립터 | 교체 프로그램에서 새로 연 핸들과 역할을 구별한다. 원래라는 상대 표현보다 상속 경로를 드러낼 필요가 있을 때 선택 | original_fd | 추천·미채택·미적용 |
| W2-NAME-wait-simple-01 | wait-simple / [#106](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/106) | `child_exit_status` | 대상 자식의 종료 후 wait가 전달한 값 | 프로세스 식별자와 종료 상태의 다른 의미를 드러낸다. 결과가 자식의 종료 상태임을 명확히 해야 할 때 선택 | result | 추천·미채택·미적용 |
| W2-NAME-wait-twice-01 | wait-twice / [#108](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/108) | `child_pid` | 두 번의 wait가 대상으로 삼는 같은 직접 자식의 식별자 | 서로 다른 자식을 기다리는 테스트로 오해하지 않게 한다. PID 값을 나타내는 경우 식별자 역할을 명시 | child | 추천·미채택·미적용 |
| W2-NAME-wait-killed-01 | wait-killed / [#110](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/110) | `child_exit_status` | 실패한 직접 자식의 종료 결과 | 부모 자신의 종료 결과 0과 구별한다. 값의 역할을 종료 상태로 설명하는 범위에서 선택 | wait_result | 추천·미채택·미적용 |
| W2-NAME-wait-bad-pid-01 | wait-bad-pid / [#112](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/112) | `wait_target_pid` | 대기 대상으로 입력된 PID 값 | 실제 자식임이 확인되기 전 child_pid로 부르는 오해를 피한다. 직접 자식 여부가 확인되지 않은 입력을 나타낼 때 선택 | pid | 추천·미채택·미적용 |
| W2-NAME-multi-recurse-01 | multi-recurse / [#114](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/114) | `recursion_depth` | 해당 프로그램 실행이 받은 재귀 깊이 | 프로세스 개수 및 PID와 깊이를 구별한다. 재귀 깊이를 나타내는 값일 때 의미를 명시 | n | 추천·미채택·미적용 |
| W2-NAME-multi-child-fd-01 | multi-child-fd / [#117](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/117) | `inherited_fd` | 교체 자식에서 전달받아 사용하는 파일 디스크립터 | 새로 연 핸들과 상속 핸들의 역할을 구별한다. 상속 경로를 강조해야 할 범위에서 선택 | handle | 추천·미채택·미적용 |
| W2-NAME-rox-simple-01 | rox-simple / [#120](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/120) | `executable_fd` | 현재 실행 파일에 대한 파일 디스크립터 | 일반 데이터 파일 핸들과 실행 파일 대상 역할을 구별한다. 변수 범위에서 대상이 실행 파일임을 드러낼 필요가 있을 때 선택 | fd | 추천·미채택·미적용 |
| W2-NAME-rox-child-01 | rox-child / [#123](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/123) | `child_exit_status` | 실행 파일을 사용하던 자식의 종료 결과 | write의 실제 바이트 수와 프로세스 종료 상태를 구별한다. wait로 수집한 종료 값임을 드러낼 때 선택 | status | 추천·미채택·미적용 |
| W2-NAME-rox-multichild-01 | rox-multichild / [#126](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/126) | `child_exit_status` | 각 세대가 직접 자식에서 수집하는 종료 상태 | 실행 깊이와 반환된 상태 12를 구별한다. 깊이가 달라도 자식 결과라는 의미가 유지되는 범위에서 사용 | status | 추천·미채택·미적용 |
| W2-NAME-no-vm-multi-oom-01 | multi-oom / [#140](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/140) | `first_run_depth` | 추가 반복과 비교하는 최초 생성 깊이 | 고정 최소 기준 10과 최초 실제 관찰 깊이를 구별한다. 첫 측정 결과라는 시간적 역할을 드러내고 비교 기준과 구별 | baseline_depth | 추천·미채택·미적용 |
| W2-NAME-dup2-dup2-complex-01 | dup2-complex / [#144](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/144) | `target_fd` | dup2에서 결과가 배치될 대상 디스크립터 번호 | 원본·복제 결과와 대상 번호의 입력 역할을 구별한다. 기존에 열려 있을 수도 있는 대상이므로 단순히 새 번호라고 부르지 않음 | new_fd | 추천·미채택·미적용 |
| W2-NAME-dup2-dup2-simple-01 | dup2-simple / [#148](https://github.com/gyaroron/pintos_22.04_lab_docker_week2/issues/148) | `duplicate_fd` | dup2의 복제 결과를 가리키는 대상 디스크립터 | 원본 디스크립터와 복제 대상 역할을 구별한다. 새 open과 구별할 필요가 있을 때 복제 역할 명시 | new_fd | 추천·미채택·미적용 |

각 후보의 직접 근거는 연결 이슈의 전체 SHA 고정 테스트·검사기 링크와 학습 근거에서 확인한다. 현재 새 후보의 코드 적용은 하지 않았다.

<!-- REMAINING-TEST-NAMES-END -->


브랜치 이름은 코드 식별자와 구분한다. [브랜치 명명 규칙과 전체 대응표](브랜치_명명_규칙과_이슈별_대응표.md)에서 Issue·Sub-issue별 이름을 확인한다.
