
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
- 결과: `백준/Bronze/III/2444. 별 찍기 - 7` 대신 `백준/Bronze/III/별찍기7`

적용 코드:
- `scripts/baekjoon/parsing.js`: `buildDirectoryTitle()`로 디렉토리명 정규화

### 4) Java 파일명/패키지 자동화
- 배경: Java 제출 파일명이 문제명 기반이면 실행 파일명(`Main.java`)과 불일치가 발생
- 변경:
  - Java 업로드 파일명을 항상 `Main.java`로 고정
  - Java 코드 상단에 `package ...;` 선언을 디렉토리 기반으로 자동 삽입
- 결과:
  - 파일명 불일치 문제 해소
  - 예: `src/main/java/problem/백준/Bronze/III/별찍기7/Main.java`
  - 예: `package problem.백준.Bronze.III.별찍기7;`

적용 코드:
- `scripts/baekjoon/parsing.js`: Java 확장자일 때 `Main.java` 강제 및 `addPackageDeclarationIfNeeded()` 적용

### 5) 백준 맞은 문제 전체 업로드(일괄)
- 배경: 확장 사용 전 풀이한 문제들이 레포에 누락되어 폴더 구조가 섞이는 문제
- 변경: 내 백준 status 페이지에서 "BaekjoonHub 전체 업로드" 버튼으로 맞은 문제 전체를 일괄 업로드
- 동작:
  - 중복 제출은 SHA 비교로 자동 스킵
  - 맞은 문제(AC)만 대상으로 전체 페이지를 순회
  - 같은 문제 정답이 여러 개면 성능 기준(시간 → 메모리 → 코드 길이 → 제출번호)으로 1개 선택
  - 변경 대상만 모은 뒤 GitHub에 1회 bulk commit 수행
  - 완료 후 성공/스킵/실패 개수 요약 표시

적용 코드:
- `scripts/baekjoon/baekjoon.js`: `injectBulkUploadButton()`, `beginUploadWithoutUi()` 추가
- `scripts/baekjoon/parsing.js`: `findUniqueResultTableListByUsername()`에서 문제별 최적 제출 선택
- `scripts/baekjoon/uploadfunctions.js`: `uploadBulkSolveProblemsOnGit()`으로 1회 bulk commit 수행
- `scripts/storage.js`: `updateLocalStorageStats()`에서 원격 기준 재구성(수동 삭제 반영)

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
8. 백준 내 계정 status 페이지(`https://www.acmicpc.net/status?user_id=내아이디`)에서 `BaekjoonHub 전체 업로드` 버튼으로 과거 정답 일괄 업로드

## Bulk Upload UI

<video src="./bulkupdate.mp4" controls width="900"></video>

## 커스텀 적용 범위

### 공통 적용 (언어 무관)
1. 업로드 Base Directory 지정
2. 백준 티어 경로 세분화
3. 문제 디렉토리명 정규화
4. 백준 맞은 문제 전체 업로드(AC 수집/중복 선택/일괄 커밋)

### Java 전용 적용
1. 업로드 파일명을 `Main.java`로 고정
2. 코드 상단 `package ...;` 자동 삽입

## Bulk Upload 동작 설명 (Toggle)

<details>
<summary><strong>1) 전체 업로드 버튼을 누르면 내부에서 어떤 순서로 동작하나요?</strong></summary>

1. 현재 사용자의 AC 제출 목록을 `status?result_id=4` 기준으로 전체 페이지 순회해서 수집합니다.
2. 문제번호 기준으로 중복을 제거하며, 같은 문제의 여러 정답 제출 중 1개를 선택합니다.
3. GitHub 원격 트리를 먼저 동기화하여 로컬 캐시(`stats.submission`)를 최신 상태로 맞춥니다.
4. 각 문제에 대해 업로드 데이터(경로/파일명/README/코드)를 생성합니다.
5. 같은 경로 파일의 SHA를 비교해 동일하면 스킵, 다르면 변경 목록에 추가합니다.
6. 변경 목록을 모아 GitHub에 1회 bulk commit 합니다.
7. 끝나면 성공/스킵/실패 개수를 토스트로 보여줍니다.

</details>

<details>
<summary><strong>2) 동일한 문제 정답이 2개 이상이면 어떤 코드가 선택되나요?</strong></summary>

문제별로 아래 우선순위로 1개 제출을 선택합니다.

1. 실행시간(`runtime`)이 더 짧은 제출
2. 실행시간이 같으면 메모리(`memory`)가 더 적은 제출
3. 메모리도 같으면 코드길이(`codeLength`)가 더 짧은 제출
4. 전부 같으면 제출번호(`submissionId`)가 더 큰 제출(더 최근 제출)

</details>

<details>
<summary><strong>3) GitHub에서 파일을 수동 삭제했는데 왜 스킵될 수 있었나요?</strong></summary>

과거 캐시가 남아 있으면 이미 업로드된 파일로 오판할 수 있었습니다.  
현재는 전체 업로드 시작 전에 원격 트리를 강제 동기화하여 이 문제를 방지합니다.

</details>

## Path Examples

- BaseDir 미사용:
  - `백준/Bronze/V/별찍기7/...`
- BaseDir 사용(`src/main/java/problem`):
  - `src/main/java/problem/백준/Bronze/V/별찍기7/Main.java`
  - Java 코드 상단: `package problem.백준.Bronze.V.별찍기7;`

## Notes

- 기존에 이미 올라간 폴더 구조는 자동으로 이동되지 않습니다.
- 새 제출부터 커스텀 경로 규칙이 반영됩니다.
- Base Directory는 앞/뒤 `/`를 자동 정리합니다.
- Java의 경우 기존 코드에 `package` 선언이 이미 있으면 중복 삽입하지 않습니다.
- 일괄 업로드는 맞은 문제 수에 따라 시간이 오래 걸릴 수 있으며, 버튼에서 진행률을 표시합니다.
- 일괄 업로드 진행률은 파일 수가 아니라 대상 문제 수(`문제 처리 n/총문제수`) 기준으로 표시됩니다.
