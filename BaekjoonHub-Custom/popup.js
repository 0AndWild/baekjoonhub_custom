/* global oAuth2 */
/* eslint no-undef: "error" */

let action = false;

const RECOMMEND_SETTING_KEY = 'bjhRecommendSettings';
const RECOMMEND_CACHE_KEY = 'bjhRecommendCache';
const RECOMMEND_REMOTE_SETTINGS_SUFFIX = 'extension/setting.json';
const RECOMMEND_REMOTE_SETTINGS_LEGACY_SUFFIX = 'extension/setting';

const WEEKDAY_ORDER = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_LABELS = {
  sun: '일요일',
  mon: '월요일',
  tue: '화요일',
  wed: '수요일',
  thu: '목요일',
  fri: '금요일',
  sat: '토요일',
};

const RECOMMEND_TAG_OPTIONS = [
  '구현',
  '시뮬레이션',
  '자료 구조',
  '문자열',
  '그래프 이론',
  '그래프 탐색',
  '깊이 우선 탐색',
  '너비 우선 탐색',
  '다이나믹 프로그래밍',
  '그리디 알고리즘',
  '정렬',
  '이분 탐색',
  '투 포인터',
  '누적 합',
  '브루트포스 알고리즘',
  '백트래킹',
  '최단 경로',
  '트리',
  '분리 집합',
  '우선순위 큐',
  '해시를 사용한 집합과 맵',
  '수학',
  '비트마스킹',
  '스택',
  '큐',
  '재귀',
];

const DEFAULT_WEEKDAY_TAGS = {
  mon: ['구현', '문자열'],
  tue: ['자료 구조', '해시를 사용한 집합과 맵', '스택', '큐'],
  wed: ['그래프 탐색', '트리', '최단 경로'],
  thu: ['다이나믹 프로그래밍'],
  fri: ['정렬', '이분 탐색', '투 포인터'],
  sat: ['그리디 알고리즘', '우선순위 큐', '누적 합'],
  sun: ['브루트포스 알고리즘', '백트래킹'],
};

const TIER_LABELS = {
  0: 'Unrated',
  1: 'Bronze V',
  2: 'Bronze IV',
  3: 'Bronze III',
  4: 'Bronze II',
  5: 'Bronze I',
  6: 'Silver V',
  7: 'Silver IV',
  8: 'Silver III',
  9: 'Silver II',
  10: 'Silver I',
  11: 'Gold V',
  12: 'Gold IV',
  13: 'Gold III',
  14: 'Gold II',
  15: 'Gold I',
  16: 'Platinum V',
  17: 'Platinum IV',
  18: 'Platinum III',
  19: 'Platinum II',
  20: 'Platinum I',
  21: 'Diamond V',
  22: 'Diamond IV',
  23: 'Diamond III',
  24: 'Diamond II',
  25: 'Diamond I',
  26: 'Ruby V',
  27: 'Ruby IV',
  28: 'Ruby III',
  29: 'Ruby II',
  30: 'Ruby I',
  31: 'Master',
};

const DEFAULT_RECOMMEND_SETTINGS = {
  count: 3,
  minLevel: 7,
  maxLevel: 14,
  weekdayTags: DEFAULT_WEEKDAY_TAGS,
};

let recommendationInitialized = false;
let recommendationLoading = false;
let settingsActionLoading = false;
let weekdayTagSelections = createDefaultWeekdayTagSelections();

$('#authenticate').on('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

/* Get URL for welcome page */
$('#welcome_URL').attr('href', 'https://github.com/0AndWild/baekjoonhub_custom');
$('#hook_URL').attr('href', `chrome-extension://${chrome.runtime.id}/welcome.html`);

initializeRecommendationUI();

chrome.storage.local.get('BaekjoonHub_token', (data) => {
  const token = data.BaekjoonHub_token;
  if (token === null || token === undefined) {
    action = true;
    $('#auth_mode').show();
  } else {
    // To validate user, load user object from GitHub.
    const AUTHENTICATION_URL = 'https://api.github.com/user';

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          /* Show MAIN FEATURES */
          chrome.storage.local.get('mode_type', (data2) => {
            if (data2 && data2.mode_type === 'commit') {
              $('#commit_mode').show();
              initializeRecommendationFeature();
              /* Get problem stats and repo link */
              chrome.storage.local.get(['stats', 'BaekjoonHub_hook'], (data3) => {
                const BaekjoonHubHook = data3.BaekjoonHub_hook;
                if (BaekjoonHubHook) {
                  $('#repo_url').html(`Your Repo: <a target="blank" style="color: cadetblue !important;" href="https://github.com/${BaekjoonHubHook}">${BaekjoonHubHook}</a>`);
                }
              });
            } else {
              $('#hook_mode').show();
            }
          });
        } else if (xhr.status === 401) {
          // bad oAuth
          // reset token and redirect to authorization process again!
          chrome.storage.local.set({ BaekjoonHub_token: null }, () => {
            console.log('BAD oAuth!!! Redirecting back to oAuth process');
            action = true;
            $('#auth_mode').show();
          });
        }
      }
    });
    xhr.open('GET', AUTHENTICATION_URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.send();
  }
});

/*
  초기에 활성화 데이터가 존재하는지 확인, 없으면 새로 생성, 있으면 있는 데이터에 맞게 버튼 조정
 */
chrome.storage.local.get('bjhEnable', (data4) => {
  if (data4.bjhEnable === undefined) {
    $('#onffbox').prop('checked', true);
    chrome.storage.local.set({ bjhEnable: $('#onffbox').is(':checked') }, () => { });
  } else {
    $('#onffbox').prop('checked', data4.bjhEnable);
    chrome.storage.local.set({ bjhEnable: $('#onffbox').is(':checked') }, () => { });
  }
});

/*
  활성화 버튼 클릭 시 storage에 활성 여부 데이터를 저장.
 */
$('#onffbox').on('click', () => {
  chrome.storage.local.set({ bjhEnable: $('#onffbox').is(':checked') }, () => { });
});

function initializeRecommendationUI() {
  renderLevelSelectOptions();
  renderWeekdayTagInputs();
  loadRecommendationSettings().then((settings) => {
    applyRecommendationSettingsToUI(settings);
  });
}

function initializeRecommendationFeature() {
  if (recommendationInitialized) return;
  recommendationInitialized = true;

  $('#save_recommend_settings').on('click', async () => {
    if (settingsActionLoading) return;
    setSettingsActionLoading(true);

    try {
      const settings = collectRecommendationSettingsFromUI();
      await saveRecommendationSettings(settings);

      const auth = await getGithubAuthOrThrow();
      const remotePath = await saveRecommendationSettingsToRemote(settings, auth.hook, auth.token);

      setRecommendStatus(`설정을 저장했습니다. (원격: ${remotePath})`);
    } catch (error) {
      setRecommendStatus(`설정 저장 실패: ${error.message || String(error)}`);
    } finally {
      setSettingsActionLoading(false);
    }
  });

  $('#load_recommend_settings').on('click', async () => {
    if (settingsActionLoading) return;
    setSettingsActionLoading(true);

    try {
      const auth = await getGithubAuthOrThrow();
      const remoteLoaded = await loadRecommendationSettingsFromRemote(auth.hook, auth.token);
      if (!remoteLoaded || !remoteLoaded.settings) {
        throw new Error('원격 설정 파일을 찾지 못했습니다. 먼저 현재 환경에서 설정 저장을 1회 진행해주세요.');
      }

      const merged = mergeRecommendationSettings(remoteLoaded.settings);
      applyRecommendationSettingsToUI(merged);
      await saveRecommendationSettings(merged);
      setRecommendStatus(`GitHub 설정을 불러와 적용했습니다. (원격: ${remoteLoaded.path})`);
    } catch (error) {
      setRecommendStatus(`설정 불러오기 실패: ${error.message || String(error)}`);
    } finally {
      setSettingsActionLoading(false);
    }
  });

  $('#reset_recommend_weekday_tags').on('click', () => {
    if (settingsActionLoading) return;
    weekdayTagSelections = createDefaultWeekdayTagSelections();
    WEEKDAY_ORDER.forEach((dayKey) => renderWeekdayTagChips(dayKey));
    setRecommendStatus('요일별 문제 유형을 추천 조합으로 초기화했습니다. 필요하면 설정 저장을 눌러 반영하세요.');
  });

  $('#recommend_button').on('click', () => {
    if (recommendationLoading || settingsActionLoading) return;
    recommendProblems();
  });

  $('#recommend_refresh_button').on('click', () => {
    if (recommendationLoading || settingsActionLoading) return;
    recommendProblems({ forceRefresh: true });
  });

  setRecommendStatus('요일별 설정을 확인한 뒤 "문제 추천 받기" 또는 "다시 추천 받기"를 눌러주세요.');
}

async function recommendProblems(options = {}) {
  const forceRefresh = Boolean(options && options.forceRefresh);
  setRecommendationLoading(true, '추천 생성 중...');
  let currentStep = '초기화';
  let debugCandidateUrls = [];
  let debugCandidateStats = null;

  try {
    currentStep = '로컬 설정 로드';
    const settings = await loadRecommendationSettings();
    applyRecommendationSettingsToUI(settings);

    const dayKey = getTodayDayKey();
    const dayLabel = WEEKDAY_LABELS[dayKey];
    const cacheDate = getDateKey();
    const configHash = hashRecommendationSettings(settings);

    const cacheObj = await getStorageLocal([RECOMMEND_CACHE_KEY]);
    const cache = cacheObj[RECOMMEND_CACHE_KEY];

    if (!forceRefresh && isValidRecommendationCache(cache, cacheDate, dayKey, configHash)) {
      renderRecommendationResult(cache.items);
      setRecommendStatus(`${dayLabel} 추천 캐시를 보여주고 있습니다. (${cache.items.length}문제)`);
      return;
    }
    if (forceRefresh) {
      setRecommendStatus('캐시를 무시하고 새 추천을 생성하는 중...');
    }

    currentStep = 'GitHub 인증 확인';
    const auth = await getGithubAuthOrThrow();
    const token = auth.token;
    const hook = auth.hook;

    currentStep = 'GitHub 업로드 문제 조회';
    setRecommendStatus('GitHub 업로드 문제 목록을 조회하는 중...');
    const solvedProblemIds = await fetchSolvedProblemIdsFromGitHub(hook, token);

    currentStep = 'BOJ/solved.ac 태그 목록 조회';
    setRecommendStatus('BOJ 문제 분류 태그를 불러오는 중...');
    const tagMap = await fetchBaekjoonTagMap();

    currentStep = '태그 매칭';
    const requestedTags = normalizeTagArray(settings.weekdayTags[dayKey]);
    if (!requestedTags.length) {
      throw new Error(`${dayLabel}에 설정된 문제 유형이 없습니다. 요일별 추천 설정을 확인해주세요.`);
    }

    const { resolved, unresolved } = resolveRequestedTags(requestedTags, tagMap);
    if (!resolved.length) {
      throw new Error(`${dayLabel}에 설정된 문제 유형을 BOJ 태그에서 찾지 못했습니다.`);
    }

    currentStep = '후보 문제 수집';
    setRecommendStatus('태그별 후보 문제를 수집하는 중...');
    const buildResult = await buildRecommendations(resolved, settings, solvedProblemIds);
    const recommendations = buildResult.items;
    debugCandidateUrls = Array.isArray(buildResult.requestedUrls) ? buildResult.requestedUrls : [];
    debugCandidateStats = buildResult.debugStats || null;

    if (!recommendations.length) {
      throw new Error('조건에 맞는 추천 문제를 찾지 못했습니다. 난이도/유형 조건을 완화해보세요.');
    }

    currentStep = '추천 문제 난이도 보강';
    await hydrateRecommendationLevels(recommendations);

    const payload = {
      dateKey: cacheDate,
      dayKey,
      configHash,
      createdAt: Date.now(),
      items: recommendations,
    };

    await setStorageLocal({ [RECOMMEND_CACHE_KEY]: payload });
    renderRecommendationResult(recommendations);

    const shortageMessage = recommendations.length < settings.count
      ? ` 요청 ${settings.count}개 중 ${recommendations.length}개만 추천되었습니다.`
      : '';
    const noCandidateTagMessage = Array.isArray(buildResult.noCandidateTags) && buildResult.noCandidateTags.length > 0
      ? ` 추천 불가 유형: ${buildResult.noCandidateTags.join(', ')}. 난이도 범위를 더 올리거나 다른 유형을 넣어주세요.`
      : '';
    const unresolvedMessage = unresolved.length
      ? ` (미매칭: ${unresolved.join(', ')})`
      : '';
    setRecommendStatus(
      `${dayLabel} 추천 ${recommendations.length}문제를 생성했습니다.${shortageMessage}${noCandidateTagMessage}${unresolvedMessage}`
    );
  } catch (error) {
    const rawMessage = error?.message || String(error);
    const urlMessage = formatCandidateUrlDebug(debugCandidateUrls);
    const statsMessage = formatCandidateStatsDebug(debugCandidateStats);
    if (String(rawMessage).includes('Failed to fetch')) {
      setRecommendStatus(`추천 실패: ${currentStep} 단계에서 네트워크/권한 오류(Failed to fetch)가 발생했습니다.${urlMessage}${statsMessage}`);
    } else {
      setRecommendStatus(`추천 실패: ${currentStep} 단계 - ${rawMessage}${urlMessage}${statsMessage}`);
    }
    renderRecommendationResult([]);
  } finally {
    setRecommendationLoading(false, '문제 추천 받기');
  }
}

function setRecommendationLoading(loading, label) {
  recommendationLoading = loading;
  const button = $('#recommend_button');
  const refreshButton = $('#recommend_refresh_button');
  button.prop('disabled', loading);
  button.text(label);
  refreshButton.prop('disabled', loading);
}

function setSettingsActionLoading(loading) {
  settingsActionLoading = loading;
  $('#save_recommend_settings').prop('disabled', loading);
  $('#load_recommend_settings').prop('disabled', loading);
  $('#reset_recommend_weekday_tags').prop('disabled', loading);
}

function setRecommendStatus(message) {
  $('#recommend_status').text(message || '');
}

function renderRecommendationResult(items) {
  const container = $('#recommend_result');
  container.empty();

  if (!Array.isArray(items) || items.length === 0) {
    container.html('<div class="recommend-meta">표시할 추천 결과가 없습니다.</div>');
    return;
  }

  items.forEach((item, index) => {
    const title = escapeHtml(`${index + 1}. [${item.tierLabel}] ${item.title} (${item.problemId})`);
    const problemUrl = `https://www.acmicpc.net/problem/${item.problemId}`;
    const tagUrl = `https://www.acmicpc.net/problem/tag/${item.tagId}`;
    const solvedUrl = `https://solved.ac/problem/${item.problemId}`;

    const card = `
      <div class="recommend-card">
        <div class="recommend-card-title"><a href="${problemUrl}" target="_blank">${title}</a></div>
        <div class="recommend-meta">유형: <a href="${tagUrl}" target="_blank">${escapeHtml(item.tagName)}</a></div>
        <div class="recommend-meta">난이도: <a href="${solvedUrl}" target="_blank">${escapeHtml(item.tierLabel)}</a></div>
        <div class="recommend-meta"><a href="${problemUrl}" target="_blank">문제 바로가기</a></div>
      </div>
    `;

    container.append(card);
  });
}

function createDefaultWeekdayTagSelections() {
  const data = {};
  WEEKDAY_ORDER.forEach((dayKey) => {
    data[dayKey] = normalizeTagArray(DEFAULT_WEEKDAY_TAGS[dayKey]);
  });
  return data;
}

function renderWeekdayTagInputs() {
  const container = $('#weekday_tag_rows');
  container.empty();

  const optionsHtml = ['<option value="">유형 선택</option>']
    .concat(RECOMMEND_TAG_OPTIONS.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`))
    .join('');

  WEEKDAY_ORDER.forEach((dayKey) => {
    const label = WEEKDAY_LABELS[dayKey];
    const row = `
      <div class="recommend-setting-row" data-day="${dayKey}">
        <label>${label}</label>
        <div>
          <div class="weekday-tag-editor">
            <select id="weekday_tag_select_${dayKey}" class="ui dropdown compact">${optionsHtml}</select>
            <button class="ui mini button weekday-tag-add-btn" data-day="${dayKey}">추가</button>
          </div>
          <div id="weekday_tag_chip_${dayKey}" class="weekday-tag-chip-list"></div>
        </div>
      </div>
    `;
    container.append(row);
  });

  container.off('click', '.weekday-tag-add-btn');
  container.on('click', '.weekday-tag-add-btn', (event) => {
    const dayKey = String($(event.currentTarget).data('day'));
    const select = $(`#weekday_tag_select_${dayKey}`);
    const selectedTag = String(select.val() || '').trim();
    if (!selectedTag) return;

    const next = normalizeTagArray([...(weekdayTagSelections[dayKey] || []), selectedTag]);
    weekdayTagSelections[dayKey] = next;
    renderWeekdayTagChips(dayKey);
    select.val('');
  });

  container.off('click', '.weekday-tag-chip-remove');
  container.on('click', '.weekday-tag-chip-remove', (event) => {
    const dayKey = String($(event.currentTarget).data('day'));
    const tag = String($(event.currentTarget).data('tag') || '');
    const next = (weekdayTagSelections[dayKey] || []).filter((x) => x !== tag);
    weekdayTagSelections[dayKey] = next;
    renderWeekdayTagChips(dayKey);
  });

  WEEKDAY_ORDER.forEach((dayKey) => renderWeekdayTagChips(dayKey));
}

function renderWeekdayTagChips(dayKey) {
  const container = $(`#weekday_tag_chip_${dayKey}`);
  container.empty();

  const tags = normalizeTagArray(weekdayTagSelections[dayKey]);
  if (!tags.length) {
    container.append('<span class="recommend-meta">선택된 유형 없음</span>');
    return;
  }

  tags.forEach((tag) => {
    const chip = `
      <span class="weekday-tag-chip">
        ${escapeHtml(tag)}
        <button class="weekday-tag-chip-remove" data-day="${dayKey}" data-tag="${escapeHtml(tag)}" title="삭제">×</button>
      </span>
    `;
    container.append(chip);
  });
}

function renderLevelSelectOptions() {
  const minSelect = $('#recommend_min_level');
  const maxSelect = $('#recommend_max_level');
  minSelect.empty();
  maxSelect.empty();

  Object.keys(TIER_LABELS)
    .map((x) => Number(x))
    .sort((a, b) => a - b)
    .forEach((level) => {
      const label = `${level}: ${TIER_LABELS[level]}`;
      minSelect.append(`<option value="${level}">${label}</option>`);
      maxSelect.append(`<option value="${level}">${label}</option>`);
    });
}

function applyRecommendationSettingsToUI(settings) {
  $('#recommend_count').val(String(settings.count));
  $('#recommend_min_level').val(String(settings.minLevel));
  $('#recommend_max_level').val(String(settings.maxLevel));

  const nextSelections = createDefaultWeekdayTagSelections();
  WEEKDAY_ORDER.forEach((dayKey) => {
    nextSelections[dayKey] = normalizeTagArray(settings.weekdayTags[dayKey]);
  });

  weekdayTagSelections = nextSelections;
  WEEKDAY_ORDER.forEach((dayKey) => renderWeekdayTagChips(dayKey));
}

function collectRecommendationSettingsFromUI() {
  const count = normalizeRecommendCount(Number($('#recommend_count').val()));
  let minLevel = Number($('#recommend_min_level').val());
  let maxLevel = Number($('#recommend_max_level').val());

  if (Number.isNaN(minLevel)) minLevel = DEFAULT_RECOMMEND_SETTINGS.minLevel;
  if (Number.isNaN(maxLevel)) maxLevel = DEFAULT_RECOMMEND_SETTINGS.maxLevel;
  if (minLevel > maxLevel) {
    const temp = minLevel;
    minLevel = maxLevel;
    maxLevel = temp;
  }

  const weekdayTags = {};
  WEEKDAY_ORDER.forEach((dayKey) => {
    weekdayTags[dayKey] = normalizeTagArray(weekdayTagSelections[dayKey]);
  });

  return mergeRecommendationSettings({ count, minLevel, maxLevel, weekdayTags });
}

function mergeRecommendationSettings(raw) {
  const merged = {
    count: normalizeRecommendCount(Number(raw?.count)),
    minLevel: Number.isInteger(raw?.minLevel) ? raw.minLevel : DEFAULT_RECOMMEND_SETTINGS.minLevel,
    maxLevel: Number.isInteger(raw?.maxLevel) ? raw.maxLevel : DEFAULT_RECOMMEND_SETTINGS.maxLevel,
    weekdayTags: {},
  };

  if (merged.minLevel > merged.maxLevel) {
    const temp = merged.minLevel;
    merged.minLevel = merged.maxLevel;
    merged.maxLevel = temp;
  }

  WEEKDAY_ORDER.forEach((dayKey) => {
    const hasRawValue = raw?.weekdayTags && Object.prototype.hasOwnProperty.call(raw.weekdayTags, dayKey);
    const source = hasRawValue ? raw.weekdayTags[dayKey] : DEFAULT_WEEKDAY_TAGS[dayKey];
    merged.weekdayTags[dayKey] = normalizeTagArray(source);
  });

  return merged;
}

function normalizeTagArray(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((x) => String(x || '').trim()).filter((x) => x.length > 0)));
  }

  if (typeof value === 'string') {
    return Array.from(new Set(value.split(',').map((x) => x.trim()).filter((x) => x.length > 0)));
  }

  return [];
}

function normalizeRecommendCount(value) {
  if (!Number.isInteger(value)) return DEFAULT_RECOMMEND_SETTINGS.count;
  if (value < 1) return 1;
  if (value > 10) return 10;
  return value;
}

async function loadRecommendationSettings() {
  const obj = await getStorageLocal([RECOMMEND_SETTING_KEY]);
  return mergeRecommendationSettings(obj[RECOMMEND_SETTING_KEY] || DEFAULT_RECOMMEND_SETTINGS);
}

async function saveRecommendationSettings(settings) {
  return setStorageLocal({ [RECOMMEND_SETTING_KEY]: settings });
}

async function getGithubAuthOrThrow() {
  const auth = await getStorageLocal(['BaekjoonHub_token', 'BaekjoonHub_hook']);
  const token = auth.BaekjoonHub_token;
  const hook = auth.BaekjoonHub_hook;

  if (!token || !hook) {
    throw new Error('GitHub 저장소 연결이 필요합니다. 먼저 Hook 연결을 확인해주세요.');
  }

  return { token, hook };
}

async function saveRecommendationSettingsToRemote(settings, hook, token) {
  const remotePath = await resolvePrimaryRecommendRemotePath(hook, token);
  const existing = await githubGetContentByPath(hook, token, remotePath);
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    path: remotePath,
    recommendSettings: settings,
  };

  const body = {
    message: '[BaekjoonHub] update recommendation settings',
    content: encodeUtf8ToBase64(JSON.stringify(payload, null, 2)),
  };

  if (existing?.sha) {
    body.sha = existing.sha;
  }

  await githubPutContentByPath(hook, token, remotePath, body);
  return remotePath;
}

async function loadRecommendationSettingsFromRemote(hook, token) {
  const candidates = await resolveRecommendRemotePathCandidates(hook, token);

  for (let i = 0; i < candidates.length; i += 1) {
    const path = candidates[i];
    const data = await githubGetContentByPath(hook, token, path);
    if (!data || !data.content) continue;

    const decoded = decodeBase64ToUtf8(data.content);
    if (!decoded) continue;

    let parsed = null;
    try {
      parsed = JSON.parse(decoded);
    } catch (error) {
      throw new Error(`원격 설정 파일 파싱에 실패했습니다. (${path})`);
    }

    if (parsed && parsed.recommendSettings) {
      return { settings: parsed.recommendSettings, path };
    }
    if (parsed) {
      return { settings: parsed, path };
    }
  }

  return null;
}

async function resolvePrimaryRecommendRemotePath(hook, token) {
  const candidates = await resolveRecommendRemotePathCandidates(hook, token);
  return candidates[0];
}

async function resolveRecommendRemotePathCandidates(hook, token) {
  const roots = await findBaekjoonRootsFromRepo(hook, token);
  const paths = roots.map((root) => `${root}/${RECOMMEND_REMOTE_SETTINGS_SUFFIX}`);
  const legacyPaths = roots.map((root) => `${root}/${RECOMMEND_REMOTE_SETTINGS_LEGACY_SUFFIX}`);

  const localFallback = await buildLocalFallbackRecommendRemotePath();
  if (!paths.includes(localFallback)) {
    paths.push(localFallback);
  }
  legacyPaths.forEach((path) => {
    if (!paths.includes(path)) paths.push(path);
  });

  if (!paths.length) {
    return [`baekjoon/${RECOMMEND_REMOTE_SETTINGS_SUFFIX}`];
  }
  return paths;
}

async function findBaekjoonRootsFromRepo(hook, token) {
  const response = await githubApiFetch(`https://api.github.com/repos/${hook}/git/trees/HEAD?recursive=1`, token, '설정 저장 경로 탐색 실패');
  const tree = Array.isArray(response.tree) ? response.tree : [];
  const counter = new Map();

  tree.forEach((item) => {
    if (!item || item.type !== 'blob' || !item.path) return;
    const segments = String(item.path).split('/').filter((x) => x.length > 0);
    const idx = segments.findIndex((seg) => seg.toLowerCase() === 'baekjoon');
    if (idx < 0) return;

    const root = segments.slice(0, idx + 1).join('/');
    counter.set(root, (counter.get(root) || 0) + 1);
  });

  return Array.from(counter.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].length - b[0].length;
    })
    .map((x) => x[0]);
}

async function buildLocalFallbackRecommendRemotePath() {
  const local = await getStorageLocal(['BaekjoonHub_BaseDir']);
  const baseDir = normalizePathSegment(local.BaekjoonHub_BaseDir);
  const root = baseDir ? `${baseDir}/baekjoon` : 'baekjoon';
  return `${root}/${RECOMMEND_REMOTE_SETTINGS_SUFFIX}`;
}

function normalizePathSegment(path) {
  return String(path || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

function getTodayDayKey() {
  const index = new Date().getDay();
  return WEEKDAY_ORDER[index];
}

function getDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashRecommendationSettings(settings) {
  const normalizedTags = {};
  WEEKDAY_ORDER.forEach((dayKey) => {
    normalizedTags[dayKey] = normalizeTagArray(settings.weekdayTags[dayKey]).join(',');
  });

  return JSON.stringify({
    count: settings.count,
    minLevel: settings.minLevel,
    maxLevel: settings.maxLevel,
    weekdayTags: normalizedTags,
  });
}

function isValidRecommendationCache(cache, dateKey, dayKey, configHash) {
  if (!cache) return false;
  if (cache.dateKey !== dateKey) return false;
  if (cache.dayKey !== dayKey) return false;
  if (cache.configHash !== configHash) return false;
  if (!Array.isArray(cache.items) || cache.items.length === 0) return false;
  return true;
}

async function fetchSolvedProblemIdsFromGitHub(hook, token) {
  const response = await githubApiFetch(`https://api.github.com/repos/${hook}/git/trees/HEAD?recursive=1`, token, '저장소 트리 조회 실패');
  const tree = Array.isArray(response.tree) ? response.tree : [];
  const solvedIds = new Set();

  const readmeBlobs = [];
  tree.forEach((item) => {
    if (!item || item.type !== 'blob' || !item.path) return;
    extractProblemIdsFromText(item.path).forEach((id) => solvedIds.add(id));

    if (/readme\.md$/i.test(item.path) && /baekjoon|백준/i.test(item.path)) {
      readmeBlobs.push(item);
    }
  });

  let processed = 0;
  await asyncPool(5, readmeBlobs, async (item) => {
    try {
      const blob = await githubApiFetch(`https://api.github.com/repos/${hook}/git/blobs/${item.sha}`, token, 'README blob 조회 실패');
      const text = decodeBase64ToUtf8(blob.content || '');
      extractProblemIdsFromText(text).forEach((id) => solvedIds.add(id));
    } catch (error) {
      console.log('Failed to parse README blob', item.path, error?.message || error);
    } finally {
      processed += 1;
      if (processed % 40 === 0 || processed === readmeBlobs.length) {
        setRecommendStatus(`GitHub 업로드 문제 파싱 중... (${processed}/${readmeBlobs.length})`);
      }
    }
  });

  return solvedIds;
}

async function fetchBaekjoonTagMap() {
  try {
    const res = await fetch('https://www.acmicpc.net/problem/tags');
    if (!res.ok) {
      throw new Error(`BOJ 태그 목록 조회 실패 (${res.status})`);
    }

    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[href*="/problem/tag/"]'));

    const byExact = new Map();
    const tagList = [];
    const idSet = new Set();

    anchors.forEach((anchor) => {
      const href = anchor.getAttribute('href') || '';
      const match = href.match(/problem\/tag\/(\d+)/);
      if (!match) return;

      const id = Number(match[1]);
      const name = cleanTagName(anchor.textContent || '');
      if (!name) return;

      if (!idSet.has(id)) {
        tagList.push({ id, name });
        idSet.add(id);
      }

      const normalized = normalizeTagName(name);
      if (normalized && !byExact.has(normalized)) {
        byExact.set(normalized, { id, name });
      }

      const withoutAlgorithm = normalizeTagName(name.replace(/알고리즘/g, ''));
      if (withoutAlgorithm && !byExact.has(withoutAlgorithm)) {
        byExact.set(withoutAlgorithm, { id, name });
      }
    });

    if (tagList.length > 0) {
      return { byExact, tagList };
    }
  } catch (error) {
    console.log('Failed to parse BOJ tags page, fallback to solved.ac tags', error?.message || error);
  }

  const fallback = await fetchSolvedACTagMap();
  if (!fallback || !fallback.tagList || fallback.tagList.length === 0) {
    throw new Error('BOJ 태그 목록을 파싱하지 못했습니다.');
  }
  return fallback;
}

async function fetchSolvedACTagMap() {
  const res = await fetch('https://solved.ac/api/v3/tag/list?language=ko');
  if (!res.ok) return null;

  const json = await res.json();
  const list = Array.isArray(json)
    ? json
    : (Array.isArray(json?.items) ? json.items : []);

  const byExact = new Map();
  const tagList = [];
  const idSet = new Set();

  list.forEach((item) => {
    const id = Number(item?.bojTagId || item?.id || item?.tagId);
    if (!Number.isInteger(id)) return;

    let name = '';
    if (Array.isArray(item?.displayNames)) {
      const ko = item.displayNames.find((x) => x?.language === 'ko');
      const first = item.displayNames.find((x) => !!x?.name);
      name = ko?.name || first?.name || '';
    }
    if (!name) name = String(item?.displayName || item?.key || '').trim();
    name = cleanTagName(name);
    if (!name) return;

    if (!idSet.has(id)) {
      tagList.push({ id, name });
      idSet.add(id);
    }

    const normalized = normalizeTagName(name);
    if (normalized && !byExact.has(normalized)) {
      byExact.set(normalized, { id, name });
    }

    const withoutAlgorithm = normalizeTagName(name.replace(/알고리즘/g, ''));
    if (withoutAlgorithm && !byExact.has(withoutAlgorithm)) {
      byExact.set(withoutAlgorithm, { id, name });
    }
  });

  return { byExact, tagList };
}

function resolveRequestedTags(requestedTags, tagMap) {
  const resolved = [];
  const unresolved = [];
  const usedIds = new Set();

  requestedTags.forEach((tagName) => {
    const normalized = normalizeTagName(tagName);
    if (!normalized) return;

    let matched = tagMap.byExact.get(normalized);

    if (!matched) {
      matched = tagMap.tagList.find((tag) => {
        const key = normalizeTagName(tag.name);
        return key.includes(normalized) || normalized.includes(key);
      });
    }

    if (!matched) {
      unresolved.push(tagName);
      return;
    }

    if (usedIds.has(matched.id)) return;
    usedIds.add(matched.id);
    resolved.push(matched);
  });

  return { resolved, unresolved };
}

async function buildRecommendations(tags, settings, solvedProblemIds) {
  const maxPagePerTag = Math.min(20, Math.max(5, settings.count * 2));
  const sampledTagCount = Math.min(settings.count, tags.length);
  const requestedUrlSet = new Set();
  const sampledTags = sampleWithoutReplacement(tags, sampledTagCount);
  const debugStats = {
    solvedSetSize: solvedProblemIds instanceof Set ? solvedProblemIds.size : 0,
    sampledTags: sampledTags.map((tag) => ({ id: tag.id, name: tag.name })),
    pages: [],
    totals: {
      rows: 0,
      excludedSolved: 0,
      duplicateInTag: 0,
      added: 0,
    },
  };
  const tagStates = sampledTags.map((tag) => ({
    tag,
    nextPage: 1,
    done: false,
    candidates: [],
    seenProblemIds: new Set(),
    selectedCount: 0,
  }));
  const selected = [];
  const selectedIdSet = new Set();
  const pickCountByTag = {};
  sampledTags.forEach((tag) => {
    pickCountByTag[tag.id] = 0;
  });

  // 1차: 샘플된 각 유형에서 "한 페이지씩" 순환 조회하며 1문제씩 확보 시도
  let phase1Guard = 0;
  while (selected.length < settings.count && phase1Guard < 1000) {
    phase1Guard += 1;
    const pendingStates = tagStates.filter((state) => state.selectedCount === 0 && !state.done);
    if (pendingStates.length === 0) break;

    let progressed = false;
    for (let i = 0; i < pendingStates.length && selected.length < settings.count; i += 1) {
      const state = pendingStates[i];
      const beforePage = state.nextPage;
      await fillTagStateOnePage(state, settings, solvedProblemIds, maxPagePerTag, requestedUrlSet, debugStats);
      if (state.nextPage !== beforePage) progressed = true;

      const item = popRandomCandidate(state, selectedIdSet);
      if (!item) continue;
      selected.push(item);
      selectedIdSet.add(item.problemId);
      state.selectedCount += 1;
      pickCountByTag[state.tag.id] = (pickCountByTag[state.tag.id] || 0) + 1;
      progressed = true;
    }

    if (!progressed) break;
  }

  // 2차: 선택한 유형 수보다 추천 개수가 많을 때만(어쩔 수 없이) 유형 중복 허용
  const allowDuplicateTags = settings.count > sampledTagCount;
  if (allowDuplicateTags) {
    let guard = 0;
    while (selected.length < settings.count && guard < 1000) {
      guard += 1;

      const pickedBeforeFetch = pickFromTagPools(tagStates, selected, selectedIdSet, pickCountByTag, settings.count);
      if (selected.length >= settings.count) break;

      const activeStates = tagStates.filter((state) => !state.done);
      if (activeStates.length === 0) break;

      let fetchedAny = false;
      for (let i = 0; i < activeStates.length; i += 1) {
        const state = activeStates[i];
        const beforePage = state.nextPage;
        await fillTagStateOnePage(state, settings, solvedProblemIds, maxPagePerTag, requestedUrlSet, debugStats);
        if (state.nextPage !== beforePage) fetchedAny = true;
      }

      const pickedAfterFetch = pickFromTagPools(tagStates, selected, selectedIdSet, pickCountByTag, settings.count);
      if (!fetchedAny && pickedBeforeFetch === 0 && pickedAfterFetch === 0) {
        break;
      }
      if (fetchedAny && pickedBeforeFetch === 0 && pickedAfterFetch === 0) {
        const hasFuture = tagStates.some((state) => !state.done && state.nextPage <= maxPagePerTag);
        if (!hasFuture) break;
      }
    }
  }

  const noCandidateTags = tagStates
    .filter((state) => state.selectedCount === 0)
    .map((state) => state.tag.name);

  return {
    items: selected.slice(0, settings.count),
    sampledTagNames: sampledTags.map((tag) => tag.name),
    noCandidateTags,
    requestedUrls: Array.from(requestedUrlSet),
    debugStats,
  };
}

async function fillTagStateOnePage(state, settings, solvedProblemIds, maxPagePerTag, requestedUrlSet, debugStats) {
  if (state.done) return;
  if (state.nextPage > maxPagePerTag) {
    state.done = true;
    return;
  }

  const currentPage = state.nextPage;
  const pageResult = await fetchProblemIdsByTagPage(state.tag.id, currentPage, settings);
  if (requestedUrlSet instanceof Set) {
    if (Array.isArray(pageResult?.requestedUrls)) {
      pageResult.requestedUrls.forEach((url) => {
        if (url) requestedUrlSet.add(url);
      });
    } else if (pageResult?.requestedUrl) {
      requestedUrlSet.add(pageResult.requestedUrl);
    }
  }
  state.nextPage += 1;
  if (pageResult.endReached || state.nextPage > maxPagePerTag + 1) {
    state.done = true;
  }
  const items = Array.isArray(pageResult.items) ? pageResult.items : [];
  let excludedSolved = 0;
  let duplicateInTag = 0;
  let added = 0;
  const solvedMatchedSample = [];

  items.forEach((item) => {
    const problemId = String(item.problemId);
    if (solvedProblemIds.has(problemId)) {
      excludedSolved += 1;
      if (solvedMatchedSample.length < 5) {
        solvedMatchedSample.push(problemId);
      }
      return;
    }

    const candidate = {
      problemId,
      title: item.title || problemId,
      level: null,
      tierLabel: '난이도 확인',
      tagId: state.tag.id,
      tagName: state.tag.name,
    };

    if (state.seenProblemIds.has(candidate.problemId)) {
      duplicateInTag += 1;
      return;
    }
    state.seenProblemIds.add(candidate.problemId);
    state.candidates.push(candidate);
    added += 1;
  });

  if (debugStats && Array.isArray(debugStats.pages) && debugStats.totals) {
    debugStats.pages.push({
      tagId: state.tag.id,
      tagName: state.tag.name,
      page: currentPage,
      url: Array.isArray(pageResult.requestedUrls)
        ? pageResult.requestedUrls.join(' -> ')
        : (pageResult.requestedUrl || ''),
      parserMode: pageResult.parserMode || '',
      fetchSource: pageResult.fetchSource || '',
      responseStatus: Number(pageResult.responseStatus || 0),
      responseFinalUrl: pageResult.responseFinalUrl || '',
      responseContentType: pageResult.responseContentType || '',
      responseContentLength: pageResult.responseContentLength || '',
      htmlLength: Number(pageResult.htmlLength || 0),
      hasProblemsetTable: Boolean(pageResult.hasProblemsetTable),
      anchorCount: Number(pageResult.anchorCount || 0),
      raw: items.length,
      excludedSolved,
      duplicateInTag,
      added,
      solvedMatchedSample,
    });
    if (debugStats.pages.length > 12) {
      debugStats.pages.shift();
    }

    debugStats.totals.rows += items.length;
    debugStats.totals.excludedSolved += excludedSolved;
    debugStats.totals.duplicateInTag += duplicateInTag;
    debugStats.totals.added += added;
  }
}

async function hydrateRecommendationLevels(items) {
  if (!Array.isArray(items) || items.length === 0) return;
  const ids = Array.from(new Set(items.map((item) => String(item.problemId)).filter((id) => /^\d+$/.test(id))));
  if (!ids.length) return;

  const lookup = await fetchSolvedAcProblemsByIds(ids);
  if (!Array.isArray(lookup) || lookup.length === 0) return;

  const byId = new Map();
  lookup.forEach((problem) => {
    if (!Number.isInteger(problem?.problemId)) return;
    byId.set(String(problem.problemId), problem);
  });

  items.forEach((item) => {
    const matched = byId.get(String(item.problemId));
    if (!matched) return;

    const level = Number(matched.level);
    if (Number.isInteger(level) && level > 0) {
      item.level = level;
      item.tierLabel = TIER_LABELS[level] || `Level ${level}`;
    }
    if (!item.title || item.title === String(item.problemId)) {
      item.title = matched.titleKo || matched.title || item.title;
    }
  });
}

function popRandomCandidate(state, selectedIdSet) {
  if (!Array.isArray(state.candidates) || state.candidates.length === 0) return null;
  const available = state.candidates.filter((item) => !selectedIdSet.has(item.problemId));
  state.candidates = available;
  if (!available.length) return null;
  const index = Math.floor(Math.random() * available.length);
  const [picked] = state.candidates.splice(index, 1);
  return picked || null;
}

function pickFromTagPools(tagStates, selected, selectedIdSet, pickCountByTag, targetCount) {
  let added = 0;
  const diversityMode = targetCount >= 2 && tagStates.length >= 2;

  while (selected.length < targetCount) {
    const orderedStates = diversityMode
      ? [...tagStates].sort((a, b) => {
        const countDiff = (pickCountByTag[a.tag.id] || 0) - (pickCountByTag[b.tag.id] || 0);
        if (countDiff !== 0) return countDiff;
        return a.tag.id - b.tag.id;
      })
      : tagStates;

    let chosenState = null;
    for (let i = 0; i < orderedStates.length; i += 1) {
      const state = orderedStates[i];
      const candidate = popRandomCandidate(state, selectedIdSet);
      if (!candidate) continue;
      chosenState = state;
      chosenState.__pickedCandidate = candidate;
      break;
    }

    if (!chosenState || !chosenState.__pickedCandidate) break;
    const item = chosenState.__pickedCandidate;
    delete chosenState.__pickedCandidate;
    selected.push(item);
    selectedIdSet.add(item.problemId);
    pickCountByTag[chosenState.tag.id] = (pickCountByTag[chosenState.tag.id] || 0) + 1;
    chosenState.selectedCount += 1;
    added += 1;
  }

  return added;
}

async function fetchProblemIdsByTagPage(tagId, page, settings) {
  const primaryUrl = buildProblemsetUrl(tagId, page, settings, 'random_desc');
  const requestedUrls = [primaryUrl];
  const primaryResult = await fetchAndParseProblemsetPage(primaryUrl);
  const toPageResult = (result, options = {}) => ({
    items: Array.isArray(options.items) ? options.items : (Array.isArray(result?.items) ? result.items : []),
    endReached: typeof options.endReached === 'boolean'
      ? options.endReached
      : Boolean(result?.endReached),
    requestedUrls,
    parserMode: result?.parserMode || '',
    fetchSource: result?.fetchSource || '',
    responseStatus: Number(result?.responseStatus || 0),
    responseFinalUrl: result?.responseFinalUrl || '',
    responseContentType: result?.responseContentType || '',
    responseContentLength: result?.responseContentLength || '',
    htmlLength: Number(result?.htmlLength || 0),
    hasProblemsetTable: Boolean(result?.hasProblemsetTable),
    anchorCount: Number(result?.anchorCount || 0),
  });

  if (primaryResult.items.length > 0) {
    return toPageResult(primaryResult);
  }

  // random_desc에서 0건이 발생하는 환경이 있어 ac_desc로 1회 폴백
  const fallbackUrl = buildProblemsetUrl(tagId, page, settings, 'ac_desc');
  if (fallbackUrl !== primaryUrl) {
    requestedUrls.push(fallbackUrl);
    const fallbackResult = await fetchAndParseProblemsetPage(fallbackUrl);
    if (fallbackResult.items.length > 0) {
      return toPageResult(fallbackResult, {
        items: shuffle(fallbackResult.items),
      });
    }
    return toPageResult(fallbackResult, { items: [], endReached: true });
  }

  return toPageResult(primaryResult, { items: [], endReached: true });
}

function buildTierFilterValues(minLevel, maxLevel) {
  const min = Number(minLevel);
  const max = Number(maxLevel);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return [];

  const start = Math.max(1, Math.min(30, Math.min(min, max)));
  const end = Math.max(1, Math.min(30, Math.max(min, max)));
  const values = [];
  for (let tier = start; tier <= end; tier += 1) {
    values.push(tier);
  }
  return values;
}

function buildProblemsetUrl(tagId, page, settings, sort) {
  // /problem/tag/{id} 는 환경에 따라 http problemset 으로 리다이렉트되며 CORS가 발생할 수 있어,
  // 리다이렉트 대상 URL을 https로 직접 호출한다.
  const params = new URLSearchParams();
  params.set('sort', String(sort || 'random_desc'));
  params.append('algo', String(tagId));
  params.set('algo_if', 'and');
  if (page > 1) {
    params.set('page', String(page));
  }

  const tierValues = buildTierFilterValues(settings?.minLevel, settings?.maxLevel);
  if (tierValues.length) {
    params.set('tier', tierValues.join(','));
  }

  return `https://www.acmicpc.net/problemset?${params.toString()}`;
}

async function fetchAndParseProblemsetPage(url) {
  let html = '';
  let responseStatus = 0;
  let responseFinalUrl = url;
  let responseContentType = '';
  let responseContentLength = '';
  let fetchSource = 'popup-fetch';

  const popupRes = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    redirect: 'follow',
  });
  responseStatus = popupRes.status;
  responseFinalUrl = popupRes.url || url;
  responseContentType = popupRes.headers.get('content-type') || '';
  responseContentLength = popupRes.headers.get('content-length') || '';

  if (!popupRes.ok) {
    throw new Error(`BOJ 문제 목록 조회 실패 (${popupRes.status}) - ${url}`);
  }

  html = await popupRes.text();
  if (!html || html.length === 0) {
    const proxy = await fetchTextViaBackground(url);
    if (proxy && proxy.ok && typeof proxy.text === 'string') {
      html = proxy.text;
      fetchSource = 'background-fetch';
      responseStatus = Number(proxy.status || 0);
      responseFinalUrl = proxy.finalUrl || url;
      responseContentType = proxy.contentType || '';
      responseContentLength = proxy.contentLength || '';
    }
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const htmlLength = String(html || '').length;
  const hasProblemsetTable = !!doc.querySelector('table#problemset');

  const scopedAnchors = Array.from(doc.querySelectorAll('#problemset a[href^="/problem/"]'));
  const tableAnchors = Array.from(doc.querySelectorAll('table a[href^="/problem/"]'));
  const globalAnchors = Array.from(doc.querySelectorAll('a[href^="/problem/"]'));
  const anchors = scopedAnchors.length
    ? scopedAnchors
    : (tableAnchors.length ? tableAnchors : globalAnchors);
  const anchorCount = anchors.length;

  const byId = new Map();
  const upsertCandidate = (problemId, rawTitle) => {
    const text = cleanTagName(rawTitle || '');
    const prev = byId.get(problemId);
    const prevTitle = prev?.title || problemId;
    const prevScore = Number(prev?.score || 0);
    const nextScore = /[A-Za-z가-힣]/.test(text) ? 2 : (/\d/.test(text) ? 1 : 0);
    const shouldReplace = !prev
      || nextScore > prevScore
      || (nextScore === prevScore && text.length > prevTitle.length);

    if (shouldReplace) {
      byId.set(problemId, {
        problemId,
        title: text || prevTitle || problemId,
        score: nextScore,
      });
    }
  };

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/\/problem\/(\d+)/);
    if (!match) return;

    const problemId = String(match[1]);
    upsertCandidate(problemId, anchor.textContent || '');
  });

  let parserMode = 'dom';
  if (byId.size === 0) {
    parserMode = 'regex-anchor';
    const anchorRegex = /<a\b[^>]*href=["'](?:https?:\/\/www\.acmicpc\.net)?\/problem\/(\d{3,6})["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match = anchorRegex.exec(html);
    while (match !== null) {
      const problemId = String(match[1]);
      const inner = stripHtmlTags(match[2] || '');
      upsertCandidate(problemId, inner);
      match = anchorRegex.exec(html);
    }
  }

  if (byId.size === 0) {
    parserMode = 'td-problem-id';
    const ids = Array.from(doc.querySelectorAll('td.list_problem_id'))
      .map((td) => cleanTagName(td.textContent || ''))
      .map((text) => {
        const matched = text.match(/(\d{3,6})/);
        return matched ? String(matched[1]) : '';
      })
      .filter((id) => id.length > 0);

    ids.forEach((problemId) => {
      upsertCandidate(problemId, problemId);
    });
  }

  if (byId.size === 0) {
    parserMode = 'regex-id-only';
    const idRegex = /\/problem\/(\d{3,6})/g;
    let match = idRegex.exec(html);
    while (match !== null) {
      const problemId = String(match[1]);
      upsertCandidate(problemId, problemId);
      match = idRegex.exec(html);
    }
  }

  const items = Array.from(byId.values()).map((item) => ({
    problemId: item.problemId,
    title: item.title || item.problemId,
  }));

  return {
    items,
    endReached: items.length === 0,
    parserMode,
    fetchSource,
    responseStatus,
    responseFinalUrl,
    responseContentType,
    responseContentLength,
    htmlLength,
    hasProblemsetTable,
    anchorCount,
  };
}

function formatCandidateUrlDebug(urls) {
  if (!Array.isArray(urls) || urls.length === 0) return '';
  const maxLinks = 5;
  const visible = urls.slice(0, maxLinks);
  const extra = urls.length - visible.length;
  const summary = visible.join(' | ');
  if (extra > 0) {
    return ` 사용링크: ${summary} 외 ${extra}개`;
  }
  return ` 사용링크: ${summary}`;
}

function formatCandidateStatsDebug(stats) {
  if (!stats || typeof stats !== 'object') return '';
  const totals = stats.totals || {};
  const pages = Array.isArray(stats.pages) ? stats.pages : [];
  const solvedSetSize = Number.isInteger(stats.solvedSetSize) ? stats.solvedSetSize : 0;
  const sampledTags = Array.isArray(stats.sampledTags)
    ? stats.sampledTags.map((tag) => tag.name).filter((x) => !!x).join(', ')
    : '';

  const pageSummary = pages.slice(-3).map((page) => {
    const sample = Array.isArray(page.solvedMatchedSample) && page.solvedMatchedSample.length > 0
      ? `,기풀이샘플=${page.solvedMatchedSample.join('/')}`
      : '';
    const mode = `,파서=${page.parserMode || 'unknown'}`;
    const shape = `,html=${page.htmlLength || 0},table=${page.hasProblemsetTable ? 1 : 0},a=${page.anchorCount || 0}`;
    const response = `,src=${page.fetchSource || 'unknown'},st=${page.responseStatus || 0},ct=${page.responseContentType || '-'},cl=${page.responseContentLength || '-'}`;
    return `${page.tagName}#${page.page}(원본${page.raw},기풀이제외${page.excludedSolved},중복제외${page.duplicateInTag},추가${page.added}${mode}${shape}${response}${sample})`;
  }).join(' | ');

  const totalsPart = ` solvedSet=${solvedSetSize},전체원본=${totals.rows || 0},전체기풀이제외=${totals.excludedSolved || 0},전체중복제외=${totals.duplicateInTag || 0},전체후보추가=${totals.added || 0}`;
  const tagsPart = sampledTags ? `,샘플유형=${sampledTags}` : '';
  const pagesPart = pageSummary ? `,최근페이지=${pageSummary}` : '';

  return ` 디버그:${totalsPart}${tagsPart}${pagesPart}`;
}

function sampleWithoutReplacement(arr, count) {
  const copy = [...arr];
  const target = Math.max(0, Math.min(copy.length, count));
  const sampled = [];

  for (let i = 0; i < target; i += 1) {
    const index = Math.floor(Math.random() * copy.length);
    sampled.push(copy[index]);
    copy.splice(index, 1);
  }

  return sampled;
}

async function fetchSolvedAcProblemsByIds(problemIds) {
  const chunks = [];
  for (let i = 0; i < problemIds.length; i += 100) {
    chunks.push(problemIds.slice(i, i + 100));
  }

  const result = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const query = chunks[i].join('%2C');
    const res = await fetch(`https://solved.ac/api/v3/problem/lookup?problemIds=${query}`);
    if (!res.ok) continue;

    const list = await res.json();
    if (Array.isArray(list)) {
      list.forEach((item) => result.push(item));
    }
  }

  return result;
}

async function githubApiFetch(url, token, errorPrefix) {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    const message = data?.message || `${res.status}`;
    throw new Error(`${errorPrefix}: ${message}`);
  }

  return data;
}

async function githubGetContentByPath(hook, token, path) {
  const encodedPath = encodeGithubPath(path);
  const res = await fetch(`https://api.github.com/repos/${hook}/contents/${encodedPath}`, {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (res.status === 404) return null;
  if (!res.ok) {
    const message = data?.message || `${res.status}`;
    throw new Error(`원격 설정 파일 조회 실패: ${message}`);
  }

  return data;
}

async function githubPutContentByPath(hook, token, path, body) {
  const encodedPath = encodeGithubPath(path);
  const res = await fetch(`https://api.github.com/repos/${hook}/contents/${encodedPath}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    data = null;
  }

  if (!res.ok) {
    const message = data?.message || `${res.status}`;
    throw new Error(`원격 설정 파일 저장 실패: ${message}`);
  }

  return data;
}

function encodeGithubPath(path) {
  return String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function encodeUtf8ToBase64(text) {
  const bytes = new TextEncoder().encode(String(text || ''));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function decodeBase64ToUtf8(content) {
  const normalized = String(content || '').replace(/\n/g, '');
  if (!normalized) return '';

  try {
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (error) {
    return '';
  }
}

function extractProblemIdsFromText(text) {
  const ids = [];
  if (!text) return ids;

  const linkRegex = /acmicpc\.net\/problem\/(\d{3,6})/g;
  let match = linkRegex.exec(text);
  while (match !== null) {
    ids.push(String(match[1]));
    match = linkRegex.exec(text);
  }

  const pathRegex = /(?:^|\/)(\d{3,6})(?:[._-]|$)/g;
  match = pathRegex.exec(text);
  while (match !== null) {
    ids.push(String(match[1]));
    match = pathRegex.exec(text);
  }

  return ids;
}

function cleanTagName(name) {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

function stripHtmlTags(text) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchTextViaBackground(url) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({
        sender: 'popup',
        task: 'FetchText',
        url,
      }, (response) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }
        if (!response || !response.success) {
          resolve(null);
          return;
        }
        resolve(response);
      });
    } catch (error) {
      resolve(null);
    }
  });
}

function normalizeTagName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

async function getStorageLocal(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (data) => resolve(data || {}));
  });
}

async function setStorageLocal(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, () => resolve());
  });
}

async function asyncPool(limit, array, iteratorFn) {
  const ret = [];
  const executing = [];

  for (let i = 0; i < array.length; i += 1) {
    const item = array[i];
    const p = Promise.resolve().then(() => iteratorFn(item, i));
    ret.push(p);

    if (limit <= array.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(ret);
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
