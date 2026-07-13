# 투표 제출 후 결과 화면 전환 설계

## 목표

`What’s the BEST part of a family gathering?` 투표에서 사용자가 `Submit`을 누르면 중간의 `View results` 클릭 없이 기존 `How everyone voted` 결과 화면을 즉시 표시한다. 다른 단계로 이동했다가 투표 단계에 재진입하면 선택했던 항목과 `View results` 버튼을 복원해 결과를 다시 볼 수 있게 한다.

## 현재 동작과 원인

현재 `submitVote()`는 `pollSubmitted`와 `pollDone`을 `true`로 변경한 뒤 `View results` 버튼만 생성한다. 결과 화면을 만드는 `showPollResults()`는 해당 버튼의 클릭 이벤트에서만 실행되므로 최초 제출에 두 번의 클릭이 필요하다.

`openPoll()`은 이미 제출한 투표에 재진입할 때 `submitVote()`를 다시 호출한다. 따라서 `submitVote()`에 `showPollResults()` 호출만 추가하면 최초 제출뿐 아니라 재진입도 곧바로 결과 화면이 되어, 재진입 시 `View results` 버튼을 제공해야 한다는 요구사항을 충족하지 못한다.

## 검토한 접근

1. 제출 완료 UI 복원을 별도 함수로 분리
   - 최초 제출은 완료 UI를 준비한 뒤 결과를 즉시 열고, 재진입은 완료 UI만 복원한다. 두 진입 경로의 목적이 명확하고 테스트하기 쉬워 이 방식을 선택한다.
2. `submitVote(showImmediately)` 매개변수 추가
   - 변경량은 작지만 클릭 이벤트 핸들러와 재진입 호출이 한 함수에 남아 상태 변경과 화면 복원의 책임이 섞인다.
3. 제출 후 결과 화면 상태를 계속 유지
   - 구현은 단순하지만 재진입 시 `View results` 버튼으로 결과를 다시 볼 수 있어야 한다는 요구사항과 다르다.

## 설계

### 제출 완료 UI

`showSubmittedPollActions()`를 추가한다. 이 함수는 `poll-actions`를 다시 표시하고 `View results` 버튼을 생성하며, 버튼 클릭 시 기존 `showPollResults()`를 호출하도록 연결한다. 결과 영역은 숨기고 선택지 영역은 표시된 상태를 유지한다.

함수는 투표 상태를 변경하지 않는다. 제출 완료 화면을 복원하는 UI 책임만 가진다.

### 최초 제출

`submitVote()`는 다음 순서로 동작한다.

1. `pollSubmitted=true`, `pollDone=true`로 완료 상태를 저장한다.
2. `showSubmittedPollActions()`로 재사용 가능한 완료 UI를 준비한다.
3. `showPollResults()`를 호출해 기존 결과 화면을 즉시 표시한다.
4. 노드 경로와 이동 화살표를 갱신한다.

결과 화면은 기존 투표 수 합산, 사용자 선택 표시, 순위 애니메이션을 그대로 사용한다. 다음 스테이지로 자동 이동하지 않는다.

### 재진입

`openPoll()`에서 `pollSubmitted`가 `true`이면 `submitVote()`를 다시 호출하지 않고 `showSubmittedPollActions()`만 호출한다. 따라서 다음 상태로 복원된다.

- 이전에 선택한 항목이 표시된다.
- `View results` 버튼이 표시된다.
- 결과 영역은 아직 숨겨져 있다.
- 버튼을 누르면 기존 `showPollResults()`로 결과를 다시 연다.

## 상태 및 예외 처리

- 선택하지 않은 상태에서는 기존과 동일하게 `Submit` 버튼이 생성되지 않는다.
- 제출은 기존 버튼 흐름에서만 가능하므로 `pollChoice` 유효성 규칙은 변경하지 않는다.
- 재진입은 기존 `pollChoice`와 `pollSubmitted` 값을 사용하며 별도 저장소를 추가하지 않는다.
- 결과 표시 함수가 숨기는 `poll-actions`는 다음 재진입 시 `showSubmittedPollActions()`가 다시 표시한다.
- `pollDone`을 이용하는 다음 단계 이동 조건은 변경하지 않는다.

## 구현 범위

- 수정: `index.html`의 `openPoll()`, `submitVote()` 및 제출 완료 UI 헬퍼
- 수정: `tests/storyboard-party-flow.test.mjs`의 투표 제출·재진입 회귀 테스트
- 유지: 투표 문구, 선택지, 기본 득표 수, 결과 계산, 결과 애니메이션, 스테이지 이동 조건
- 제외: 자동 다음 단계 이동, 투표 영구 저장, 결과 화면 디자인 변경

## 테스트 및 검증

1. 최초 `submitVote()`가 완료 상태를 저장하고 `showPollResults()`를 즉시 호출하는지 검증한다.
2. `openPoll()` 재진입 경로가 `submitVote()`를 다시 호출하지 않고 `showSubmittedPollActions()`를 호출하는지 검증한다.
3. `showSubmittedPollActions()`가 `View results` 버튼을 만들고 기존 결과 함수에 연결하는지 검증한다.
4. 결과 화면이 다음 스테이지로 자동 이동하는 호출을 포함하지 않는지 검증한다.
5. 전체 테스트와 인라인 JavaScript 구문 검사를 실행한다.

## 개선 사항 검토 및 반영

1. 상태 변경과 UI 복원을 분리해 재진입 시 불필요한 재제출을 막는다.
2. 최초 제출과 재진입 경로를 별도 회귀 테스트로 고정해 동작 차이를 문서화한다.
3. 기존 `showPollResults()`를 그대로 재사용해 결과 계산·애니메이션 중복 구현을 피한다.

세 항목은 변경 범위를 줄이면서 요구사항을 안정적으로 유지하므로 모두 반영한다.
