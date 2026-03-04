/** 푼 문제들에 대한 단일 업로드는 uploadGit 함수로 합니다.
 * 파라미터는 아래와 같습니다.
 * @param {string} filePath - 업로드할 파일의 경로
 * @param {string} sourceCode - 업로드하는 소스코드 내용
 * @param {string} readme - 업로드하는 README 내용
 * @param {string} filename - 업로드할 파일명
 * @param {string} commitMessage - 커밋 메시지
 * @param {function} cb - 콜백 함수 (ex. 업로드 후 로딩 아이콘 처리 등)
 * @returns {Promise<void>}
 */
async function uploadOneSolveProblemOnGit(bojData, cb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    console.error('token or hook is null', token, hook);
    return;
  }
  return upload(token, hook, bojData.code, bojData.readme, bojData.directory, bojData.fileName, bojData.message, cb);
}

/**
 * 여러 문제를 하나의 커밋으로 업로드합니다.
 * @param {Array<Object>} bulkItems - [{ code, readme, directory, fileName }]
 * @param {string} commitMessage - bulk commit message
 * @param {function} cb - optional callback
 */
async function uploadBulkSolveProblemsOnGit(bulkItems, commitMessage, cb, progressCb) {
  const token = await getToken();
  const hook = await getHook();
  if (isNull(token) || isNull(hook)) {
    throw new Error('token or hook is null');
  }
  if (isEmpty(bulkItems)) return;

  const git = new GitHub(hook, token);
  const stats = await getStats();
  let default_branch = stats.branches[hook];
  if (isNull(default_branch)) {
    default_branch = await git.getDefaultBranchOnRepo();
    stats.branches[hook] = default_branch;
  }
  const { refSHA, ref } = await git.getReference(default_branch);

  // 동일 path 중복 시 마지막 데이터를 우선합니다.
  const treeItemMap = new Map();
  const totalItems = bulkItems.length;
  let processedItems = 0;

  for (const item of bulkItems) {
    const sourcePath = `${item.directory}/${item.fileName}`;
    const readmePath = `${item.directory}/README.md`;
    const sourceBlob = await git.createBlob(item.code, sourcePath);
    const readmeBlob = await git.createBlob(item.readme, readmePath);
    treeItemMap.set(sourcePath, sourceBlob);
    treeItemMap.set(readmePath, readmeBlob);

    processedItems += 1;
    if (typeof progressCb === 'function') {
      progressCb({ phase: 'item', current: processedItems, total: totalItems, directory: item.directory });
    }
  }

  const treeItems = Array.from(treeItemMap.values());
  if (typeof progressCb === 'function') progressCb({ phase: 'tree', current: processedItems, total: totalItems });
  const treeSHA = await git.createTree(refSHA, treeItems);
  if (isEmpty(treeSHA)) throw new Error('createTree failed: empty tree SHA');
  if (typeof progressCb === 'function') progressCb({ phase: 'commit', current: processedItems, total: totalItems });
  const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
  if (isEmpty(commitSHA)) throw new Error('createCommit failed: empty commit SHA');
  if (typeof progressCb === 'function') progressCb({ phase: 'updateHead', current: processedItems, total: totalItems });
  const headSHA = await git.updateHead(ref, commitSHA);
  if (isEmpty(headSHA)) throw new Error('updateHead failed: empty head SHA');

  treeItems.forEach((blob) => {
    updateObjectDatafromPath(stats.submission, `${hook}/${blob.path}`, blob.sha);
  });
  await saveStats(stats);

  if (typeof cb === 'function') {
    cb(stats.branches, '');
  }
}

/** Github api를 사용하여 업로드를 합니다.
 * @see https://docs.github.com/en/rest/reference/repos#create-or-update-file-contents
 * @param {string} token - github api 토큰
 * @param {string} hook - github api hook
 * @param {string} sourceText - 업로드할 소스코드
 * @param {string} readmeText - 업로드할 readme
 * @param {string} directory - 업로드할 파일의 경로
 * @param {string} filename - 업로드할 파일명
 * @param {string} commitMessage - 커밋 메시지
 * @param {function} cb - 콜백 함수 (ex. 업로드 후 로딩 아이콘 처리 등)
 */
async function upload(token, hook, sourceText, readmeText, directory, filename, commitMessage, cb) {
  /* 업로드 후 커밋 */
  const git = new GitHub(hook, token);
  const stats = await getStats();
  let default_branch = stats.branches[hook];
  if (isNull(default_branch)) {
    default_branch = await git.getDefaultBranchOnRepo();
    stats.branches[hook] = default_branch;
  }
  const { refSHA, ref } = await git.getReference(default_branch);
  const source = await git.createBlob(sourceText, `${directory}/${filename}`); // 소스코드 파일
  const readme = await git.createBlob(readmeText, `${directory}/README.md`); // readme 파일
  const treeSHA = await git.createTree(refSHA, [source, readme]);
  if (isEmpty(treeSHA)) throw new Error('createTree failed: empty tree SHA');
  const commitSHA = await git.createCommit(commitMessage, treeSHA, refSHA);
  if (isEmpty(commitSHA)) throw new Error('createCommit failed: empty commit SHA');
  const headSHA = await git.updateHead(ref, commitSHA);
  if (isEmpty(headSHA)) throw new Error('updateHead failed: empty head SHA');

  /* stats의 값을 갱신합니다. */
  updateObjectDatafromPath(stats.submission, `${hook}/${source.path}`, source.sha);
  updateObjectDatafromPath(stats.submission, `${hook}/${readme.path}`, readme.sha);
  await saveStats(stats);
  // 콜백 함수 실행
  if (typeof cb === 'function') {
    cb(stats.branches, directory);
  }
}
