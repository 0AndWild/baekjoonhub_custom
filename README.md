<h1 align="center">
  <img src="assets/thumbnail.png" alt="BaekjoonHub - Automatically sync your code to GitHub." width="400">
  <br>
  BaekjoonHub - Automatically sync your code to GitHub.
  <br>
  <br>
</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="license"/></a>
  <a href="https://chrome.google.com/webstore/detail/ccammcjdkpgjmcpijpahlehmapgmphmk"><img src="https://img.shields.io/chrome-web-store/v/ccammcjdkpgjmcpijpahlehmapgmphmk.svg" alt="chrome-webstore"/></a>
  <a href="https://chrome.google.com/webstore/detail/ccammcjdkpgjmcpijpahlehmapgmphmk"><img src="https://img.shields.io/chrome-web-store/d/ccammcjdkpgjmcpijpahlehmapgmphmk.svg" alt="users"></a>
    
</a>
</p>

</br>

## Custom Patch Notes (Local)

이 저장소는 기본 BaekjoonHub에 아래 2가지 기능을 추가한 커스텀 버전입니다.

### 1) 업로드 Base Directory 지정
- 배경: 기본 동작은 커밋 폴더가 항상 레포지토리 루트에 생성됨
- 변경: 사용자가 원하는 시작 경로(예: `src/main/java/problem`)를 지정 가능
- 결과: 최종 경로가 `BaseDir/플랫폼/레벨/문제번호.문제명` 형태로 생성됨

적용 코드:
- `welcome.html`: Base Directory 입력 필드 추가
- `welcome.js`: `BaekjoonHub_BaseDir` 저장/복원
- `scripts/storage.js`: 실제 커밋 경로 생성 시 BaseDir prefix 적용

### 2) 백준 티어 경로 세분화
- 배경: 기존은 `Bronze/문제`처럼 대분류만 사용
- 변경: `Bronze/V/문제`처럼 세부 티어까지 분리
- 결과: 예시 경로 `백준/Bronze/V/2444.별 찍기 - 7`

적용 코드:
- `scripts/baekjoon/parsing.js`: `level` 값을 `tierGroup/tierLevel`로 분리해서 경로 생성

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
  - `백준/Bronze/V/2444.별 찍기 - 7/...`
- BaseDir 사용(`src/main/java/problem`):
  - `src/main/java/problem/백준/Bronze/V/2444.별 찍기 - 7/...`

## Notes

- 기존에 이미 올라간 폴더 구조는 자동으로 이동되지 않습니다.
- 새 제출부터 커스텀 경로 규칙이 반영됩니다.
- Base Directory는 앞/뒤 `/`를 자동 정리합니다.
