// Set to true to enable console log
const debug = false;

/* 
  문제 제출 맞음 여부를 확인하는 함수
  2초마다 문제를 파싱하여 확인
*/
let loader;

const currentUrl = window.location.href;
const currentPath = window.location.pathname;
const currentQuery = new URL(window.location.href).searchParams;
log(currentUrl);

// 문제 제출 사이트의 경우에는 로더를 실행하고, 유저 페이지의 경우에는 버튼을 생성한다.
// 백준 사이트 로그인 상태이면 username이 있으며, 아니면 없다.
const username = findUsername();
const statusUserId = currentQuery.get('user_id');

// status 페이지에서는 DOM 파싱 실패와 무관하게 URL의 user_id로 버튼을 노출한다.
if (currentPath === '/status' && !isEmpty(statusUserId)) {
  injectBulkUploadButton(statusUserId);
}

if (!isNull(username)) {
  if (['status', `user_id=${username}`, 'problem_id', 'from_mine=1'].every((key) => currentUrl.includes(key))) startLoader();
  if (currentUrl.match(/\.net\/problem\/\d+/) !== null) parseProblemDescription();
}

function startLoader() {
  loader = setInterval(async () => {
    // 기능 Off시 작동하지 않도록 함
    const enable = await checkEnable();
    if (!enable) stopLoader();
    else if (isExistResultTable()) {
      const table = findFromResultTable();
      if (isEmpty(table)) return;
      const data = table[0];
      if (data.hasOwnProperty('username') && data.hasOwnProperty('resultCategory')) {
        const { username, resultCategory } = data;
        if (username === findUsername() &&
          (resultCategory.includes(RESULT_CATEGORY.RESULT_ACCEPTED) ||
            resultCategory.includes(RESULT_CATEGORY.RESULT_ENG_ACCEPTED))) {
          stopLoader();
          console.log('풀이가 맞았습니다. 업로드를 시작합니다.');
          startUpload();
          const bojData = await findData();
          await beginUpload(bojData);
        }
      }
    }
  }, 2000);
}

function stopLoader() {
  clearInterval(loader);
  loader = null;
}

function toastThenStopLoader(toastMessage, errorMessage){
  Toast.raiseToast(toastMessage)
  stopLoader()
  throw new Error(errorMessage)
}

/* 파싱 직후 실행되는 함수 */
async function beginUpload(bojData) {
  bojData = preProcessEmptyObj(bojData);
  log('bojData', bojData);
  if (isNotEmpty(bojData)) {
    const { stats, hook } = await ensureUploadPrerequisites();

    const currentVersion = stats.version;
    /* 버전 차이가 발생하거나, 해당 hook에 대한 데이터가 없는 경우 localstorage의 Stats 값을 업데이트하고, version을 최신으로 변경한다 */
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    /* 현재 제출하려는 소스코드가 기존 업로드한 내용과 같다면 중지 */
    const cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`)
    const calcSHA = calculateBlobSHA(bojData.code)
    log('cachedSHA', cachedSHA, 'calcSHA', calcSHA)

    if (cachedSHA == calcSHA) {
      markUploadedCSS(stats.branches, bojData.directory);
      console.log(`현재 제출번호를 업로드한 기록이 있습니다.` /* submissionID ${bojData.submissionId}` */);
      return { status: 'skipped' };
    }
    /* 신규 제출 번호라면 새롭게 커밋  */
    await uploadOneSolveProblemOnGit(bojData, markUploadedCSS);
    return { status: 'uploaded' };
  }
  return { status: 'failed' };
}

async function versionUpdate() {
  log('start versionUpdate');
  const stats = await updateLocalStorageStats();
  // update version.
  stats.version = getVersion();
  await saveStats(stats);
  log('stats updated.', stats);
}

function injectBulkUploadButton(username) {
  if (document.getElementById('BaekjoonHub_bulk_upload_btn')) return;

  const button = document.createElement('button');
  button.id = 'BaekjoonHub_bulk_upload_btn';
  button.textContent = 'BaekjoonHub 전체 업로드';
  button.title = 'BaekjoonHub 전체 업로드';
  button.style.padding = '12px 16px';
  button.style.border = 'none';
  button.style.background = '#ff5a00';
  button.style.color = '#ffffff';
  button.style.borderRadius = '999px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '13px';
  button.style.fontWeight = '700';
  button.style.boxShadow = '0 10px 24px rgba(255, 90, 0, 0.45)';
  button.style.position = 'fixed';
  button.style.right = '20px';
  button.style.bottom = '20px';
  button.style.zIndex = '99999';

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    button.disabled = true;
    const oldText = button.textContent;
    button.textContent = '목록 확인 중...';

    try {
      const enable = await checkEnable();
      if (!enable) {
        Toast.raiseToast('확장이 비활성화되어 있습니다.');
        return;
      }

      const acceptedList = await findUniqueResultTableListByUsername(username);
      if (isEmpty(acceptedList)) {
        Toast.raiseToast('업로드할 맞은 문제를 찾지 못했습니다.');
        return;
      }

      const ok = window.confirm(`맞은 문제 ${acceptedList.length}개를 순차적으로 GitHub에 업로드합니다. 계속할까요?`);
      if (!ok) return;
      button.textContent = '원격 동기화 중...';
      await forceSyncStatsWithRemote();
      const { hook } = await ensureUploadPrerequisites();

      let uploaded = 0;
      let skipped = 0;
      let failed = 0;
      let firstError = null;
      const total = acceptedList.length;
      const pendingUploadItems = [];

      for (let i = 0; i < total; i += 1) {
        const solved = acceptedList[i];
        button.textContent = `업로드 중... (${i + 1}/${total})`;

        try {
          const bojData = await findData(solved);
          if (isNull(bojData)) {
            throw new Error(`문제 데이터 파싱 실패(problemId=${solved?.problemId}, submissionId=${solved?.submissionId})`);
          }
          const result = await prepareBulkUploadItem(bojData, hook);
          if (result.status === 'pending') pendingUploadItems.push(result.item);
          else if (result.status === 'skipped') skipped += 1;
          else {
            failed += 1;
            if (isNull(firstError) && !isEmpty(result.reason)) firstError = result.reason;
            console.log('[BaekjoonHub][BulkUpload][Failed]', {
              problemId: solved?.problemId,
              submissionId: solved?.submissionId,
              reason: result.reason || 'unknown',
            });
          }
        } catch (error) {
          failed += 1;
          if (isNull(firstError) && !isNull(error)) firstError = error.message || String(error);
          console.log('[BaekjoonHub][BulkUpload][Exception]', {
            problemId: solved?.problemId,
            submissionId: solved?.submissionId,
            reason: error?.message || String(error),
          });
          console.error('Bulk upload failed', solved?.problemId, error);
        }
      }

      if (!isEmpty(pendingUploadItems)) {
        button.textContent = `일괄 커밋 중... (${pendingUploadItems.length}개)`;
        try {
          const commitMessage = `[Bulk Upload] ${pendingUploadItems.length} problems -BaekjoonHub`;
          await uploadBulkSolveProblemsOnGit(
            pendingUploadItems,
            commitMessage,
            null,
            ({ phase, current, total }) => {
              if (phase === 'item') {
                button.textContent = `일괄 커밋 중... 문제 처리 ${current}/${total}`;
              } else if (phase === 'tree') {
                button.textContent = `일괄 커밋 중... 트리 생성`;
              } else if (phase === 'commit') {
                button.textContent = `일괄 커밋 중... 커밋 생성`;
              } else if (phase === 'updateHead') {
                button.textContent = `일괄 커밋 중... 브랜치 갱신`;
              }
            }
          );
          uploaded += pendingUploadItems.length;
        } catch (error) {
          failed += pendingUploadItems.length;
          if (isNull(firstError)) firstError = error?.message || String(error);
          console.log('[BaekjoonHub][BulkUpload][BatchCommitFailed]', {
            count: pendingUploadItems.length,
            reason: error?.message || String(error),
          });
        }
      }

      const summary = `전체 업로드 완료 - 성공 ${uploaded}, 스킵 ${skipped}, 실패 ${failed}`;
      Toast.raiseToast(summary, 8000);
      if (failed > 0 && !isEmpty(firstError)) {
        Toast.raiseToast(`실패 원인(첫 번째): ${firstError}`, 9000);
      }
    } catch (error) {
      console.error(error);
      Toast.raiseToast(`전체 업로드 중 오류가 발생했습니다: ${error.message || error}`);
    } finally {
      button.disabled = false;
      button.textContent = oldText;
    }
  });

  document.body.appendChild(button);
}

async function beginUploadWithoutUi(bojData) {
  if (isNull(bojData)) {
    console.log('[BaekjoonHub][BulkUpload][ValidationFailed]', { reason: '문제 데이터 파싱 실패(bojData is null)' });
    return { status: 'failed', reason: '문제 데이터 파싱 실패(bojData is null)' };
  }
  bojData = preProcessEmptyObj(bojData);
  if (!hasRequiredUploadFields(bojData)) {
    console.log('[BaekjoonHub][BulkUpload][ValidationFailed]', {
      reason: '문제 데이터 파싱 실패(필수 필드 누락)',
      directory: bojData.directory,
      fileName: bojData.fileName,
      message: bojData.message,
      hasReadme: !isEmpty(bojData.readme),
      hasCode: !isNull(bojData.code),
    });
    return { status: 'failed', reason: '문제 데이터 파싱 실패(필수 필드 누락)' };
  }

  try {
    const { stats, hook } = await ensureUploadPrerequisites();
    const currentVersion = stats.version;
    if (isNull(currentVersion) || currentVersion !== getVersion() || isNull(await getStatsSHAfromPath(hook))) {
      await versionUpdate();
    }

    const cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`);
    const calcSHA = calculateBlobSHA(bojData.code);
    if (cachedSHA == calcSHA) {
      return { status: 'skipped' };
    }

    await uploadOneSolveProblemOnGit(bojData);
    return { status: 'uploaded' };
  } catch (error) {
    return { status: 'failed', reason: error?.message || String(error) };
  }
}

async function prepareBulkUploadItem(bojData, hook) {
  if (isNull(bojData)) {
    return { status: 'failed', reason: '문제 데이터 파싱 실패(bojData is null)' };
  }
  bojData = preProcessEmptyObj(bojData);
  if (!hasRequiredUploadFields(bojData)) {
    return { status: 'failed', reason: '문제 데이터 파싱 실패(필수 필드 누락)' };
  }

  try {
    const cachedSHA = await getStatsSHAfromPath(`${hook}/${bojData.directory}/${bojData.fileName}`);
    const calcSHA = calculateBlobSHA(bojData.code);
    if (cachedSHA == calcSHA) {
      return { status: 'skipped' };
    }
    return { status: 'pending', item: bojData };
  } catch (error) {
    return { status: 'failed', reason: error?.message || String(error) };
  }
}

async function ensureUploadPrerequisites() {
  const token = await getToken();
  const hook = await getHook();
  if (isEmpty(token) || isEmpty(hook)) {
    throw new Error('GitHub 연동이 필요합니다. 확장 팝업에서 저장소 연결을 먼저 확인해주세요.');
  }

  let stats = await getStats();
  let needSave = false;
  if (isNull(stats)) {
    stats = {};
    needSave = true;
  }
  if (isNull(stats.version)) {
    stats.version = getVersion();
    needSave = true;
  }
  if (isNull(stats.branches)) {
    stats.branches = {};
    needSave = true;
  }
  if (isNull(stats.submission)) {
    stats.submission = {};
    needSave = true;
  }
  if (isNull(stats.problems)) {
    stats.problems = {};
    needSave = true;
  }
  if (needSave) {
    await saveStats(stats);
  }

  return { stats, hook };
}

function hasRequiredUploadFields(bojData) {
  return !isEmpty(bojData.directory)
    && !isEmpty(bojData.fileName)
    && !isEmpty(bojData.message)
    && !isEmpty(bojData.readme)
    && !isNull(bojData.code);
}

async function forceSyncStatsWithRemote() {
  const stats = await updateLocalStorageStats();
  stats.version = getVersion();
  await saveStats(stats);
}
