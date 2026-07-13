# 파티 게스트 상태 이미지 교체 설계

## 목표

`index.html`의 Perfect Party 미니게임에서 SVG로 그리는 세 명의 게스트를 `images` 폴더의 PNG 이미지로 교체한다. 좌석 배치, 음식 선호도, 점수 및 완료 조건은 변경하지 않는다.

## 현재 구조

- 미니게임 문서는 `index.html`의 `PARTY_B64` 문자열에 Base64로 인코딩되어 있다.
- 게스트 식별자는 `g_usa`, `g_china`, `g_korea`이다.
- 기존 `scoreGuestAt()`은 각 게스트의 상태를 `happy`, `normal`, `unhappy`로 계산한다.
- 기존 `guestWrap()`은 계산된 상태를 `guestSVG()`에 전달하여 얼굴을 렌더링한다.

## 선택한 접근 방식

인코딩된 미니게임 문서를 디코딩한 뒤, 게스트 ID와 상태를 외부 PNG 경로로 연결하는 명시적 이미지 매핑을 추가하고 다시 Base64로 인코딩한다.

이 방식은 이미지 파일을 `index.html`에 중복 삽입하지 않으므로 파일 크기 증가를 억제한다. 부모 문서에서 iframe DOM을 후처리하지 않아 렌더링 시점 결합도도 늘리지 않는다.

## 이미지 매핑

| 게스트 ID | `happy` | `normal` | `unhappy` |
| --- | --- | --- | --- |
| `g_usa` | `images/Trump_Smile.png` | `images/Trump_Normal.png` | `images/Trump_Angry.png` |
| `g_china` | `images/Xijingping_Smile.png` | `images/Xijingping_Normal.png` | `images/Xijingping_Angry.png` |
| `g_korea` | `images/JongUn_Smile.png` | `images/JongUn_Normal.png` | `images/JongUn_Angry.png` |

## 렌더링 흐름

1. `scoreGuestAt()`이 현재 좌석과 음식 배치로 상태를 계산한다.
2. `guestWrap()`이 게스트 ID와 상태로 이미지 경로를 조회한다.
3. 대기 중인 게스트는 기존 동작과 동일하게 `unhappy` 상태 이미지를 표시한다.
4. 좌석에 앉은 게스트는 계산 결과에 따라 `happy`, `normal`, `unhappy` 이미지를 표시한다.
5. 이미지 로드에 실패하면 기존 `guestSVG()` 결과로 대체한다.

이미지는 현재 게스트 컨테이너 안에 맞게 표시하며 원본 비율을 유지한다. 기존 드래그 대상과 이벤트가 연결된 `.guestwrap` 구조는 유지한다.

## 오류 처리

- 등록되지 않은 게스트 또는 상태는 기존 SVG 렌더링으로 대체한다.
- PNG 로드 오류가 발생하면 해당 이미지 요소를 숨기고 SVG fallback을 표시한다.
- 경로는 `images/` 기준의 실제 파일명과 대소문자를 그대로 사용한다.

## 검증

- 9개 PNG가 모두 존재하고 PNG로 식별되는지 확인한다.
- 디코딩한 미니게임 문서에 3개 게스트와 9개 상태 경로가 정확히 포함되는지 확인한다.
- 수정 후 `PARTY_B64`가 정상적으로 디코딩되는지 확인한다.
- 브라우저에서 각 게스트의 대기, 보통, 웃음 상태가 올바른 이미지로 전환되는지 확인한다.
- 드래그 앤 드롭, 음식·좌석 판정, 무드 계산, 완료 메시지가 기존과 동일하게 동작하는지 확인한다.

## 범위 제외

- 이미지 자체 편집 또는 리사이즈
- 게스트 이름, 선호 음식, 좌석 및 점수 규칙 변경
- 다른 미니게임 또는 본문 이미지 변경
