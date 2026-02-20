
## Custom Patch Notes (Local)

이 저장소는 기본 BaekjoonHub에 아래 기능을 추가한 커스텀 버전입니다.

### 1) 업로드 Base Directory 지정
- 배경: 기본 동작은 커밋 폴더가 항상 레포지토리 루트에 생성됨
- 변경: 사용자가 원하는 시작 경로(예: `src/main/java/problem`)를 지정 가능
- 결과: 최종 경로가 `BaseDir/플랫폼/레벨/...` 형태로 생성됨

적용 코드:
- `welcome.html`: Base Directory 입력 필드 추가
- `welcome.js`: `BaekjoonHub_BaseDir` 저장/복원
- `scripts/storage.js`: 실제 커밋 경로 생성 시 BaseDir prefix 적용

### 2) 백준 티어 경로 세분화
- 배경: 기존은 `Bronze/문제`처럼 대분류만 사용
- 변경: `Bronze/V/문제`처럼 세부 티어까지 분리
- 결과: 예시 경로 `백준/Bronze/V/문제명`

적용 코드:
- `scripts/baekjoon/parsing.js`: `level` 값을 `tierGroup/tierLevel`로 분리해서 경로 생성

### 3) 백준 문제 디렉토리명 정규화
- 배경: `2444. 별 찍기 - 7` 형태는 Java 패키지 경로로 바로 사용하기 어려움
- 변경: 디렉토리명에서 문제번호/공백/불필요 특수문자를 제거해 문제명 중심으로 생성
- 결과: `백준/Bronze/III/2444. 별 찍기 - 7` 대신 `백준/Bronze/III/별찍기`

적용 코드:
- `scripts/baekjoon/parsing.js`: `buildDirectoryTitle()`로 디렉토리명 정규화

### 4) Java 파일명/패키지 자동화
- 배경: Java 제출 파일명이 문제명 기반이면 실행 파일명(`Main.java`)과 불일치가 발생
- 변경:
  - Java 업로드 파일명을 항상 `Main.java`로 고정
  - Java 코드 상단에 `package ...;` 선언을 디렉토리 기반으로 자동 삽입
- 결과:
  - 파일명 불일치 문제 해소
  - 예: `src/main/java/problem/백준/Bronze/III/별찍기/Main.java`
  - 예: `package problem.백준.Bronze.III.별찍기;`

적용 코드:
- `scripts/baekjoon/parsing.js`: Java 확장자일 때 `Main.java` 강제 및 `addPackageDeclarationIfNeeded()` 적용

## How To Use This Custom Version

1. Chrome에서 `chrome://extensions` 접속
2. `개발자 모드` 활성화
3. `압축해제된 확장 프로그램을 로드합니다` 클릭
4. `manifest.json`이 있는 폴더 선택  
   - 예: `.../BaekjoonHub-1.2.8/BaekjoonHub-1.2.8`
5. 확장 팝업에서 레포를 연결/생성
6. `Base Directory (optional)`에 원하는 시작 경로 입력  
   - 예: `src/main/java/problem`
7. 백준 정답 제출 후 자동 커밋 확인

## Path Examples

- BaseDir 미사용:
  - `백준/Bronze/V/별찍기/...`
- BaseDir 사용(`src/main/java/problem`):
  - `src/main/java/problem/백준/Bronze/V/별찍기/Main.java`
  - Java 코드 상단: `package problem.백준.Bronze.V.별찍기;`

## Notes

- 기존에 이미 올라간 폴더 구조는 자동으로 이동되지 않습니다.
- 새 제출부터 커스텀 경로 규칙이 반영됩니다.
- Base Directory는 앞/뒤 `/`를 자동 정리합니다.
- Java의 경우 기존 코드에 `package` 선언이 이미 있으면 중복 삽입하지 않습니다.
