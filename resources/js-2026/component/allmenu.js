/**
 * 전체 메뉴 및 설정 다이얼로그 전용 비즈니스 로직 (allmenu.js)
 * 
 * - 전체 메뉴 다이얼로그(nr-allmenu) 오픈/클로즈 및 화면 스타일 연동
 * - 설정 다이얼로그(setting-dialog) 오픈 및 세그먼트/스위치/지도형 서브 라디오 연동
 * - 지도형(map) 모드 iframe 동적 로드/언로드 및 선택 값 postMessage/콜백 전달
 */
import Dialog from './ui-dialog.js';

/**
 * 지도형 선택 변경 사용자 콜백 함수
 */
let mapSelectionCallback = null;

/**
 * 지도형 선택 변경 콜백 등록 함수
 * @param {Function} callback - (data) => void
 * @example
 * setMapChangeCallback((data) => {
 *   console.log(data.path);     // "수지모델 > 바람"
 *   console.log(data.category); // "수지모델"
 *   console.log(data.subItem);  // "바람"
 *   console.log(data.subItemValue); // "wind"
 * });
 */
export const setMapChangeCallback = (callback) => {
  mapSelectionCallback = callback;
};

export const onMapSelectionChange = (callback) => {
  setMapChangeCallback(callback);
};

/**
 * 현재 선택된 지도형 라디오 데이터 반환
 * @returns {Object|null}
 */
export const getMapSelectionData = () => {
  // 1. 현재 선택된 1차 카테고리 (수지모델, 예보, 관측)
  const categoryRadio = document.querySelector(
    '[data-maptype-check] [data-mapsub-area] input[type="radio"]:checked, [data-maptype-check] input[name="allmenu_style_3"]:checked'
  );
  if (!categoryRadio) return null;

  const categoryLabelEl = document.querySelector(`label[for="${categoryRadio.id}"]`);
  const category = categoryLabelEl ? categoryLabelEl.textContent.trim() : categoryRadio.value;
  const categoryValue = categoryRadio.value;

  // 2. 현재 선택된 1차 카테고리에 해당하는 2차 서브 메뉴 영역
  const sub2Area = document.querySelector(`[data-mapsub2-area="${categoryValue}"]`);
  let subItem = '';
  let subItemValue = '';
  let radioId = '';

  if (sub2Area) {
    const subRadio = sub2Area.querySelector('input[type="radio"]:checked');
    if (subRadio) {
      radioId = subRadio.id;
      subItemValue = subRadio.value;
      const subLabelEl = document.querySelector(`label[for="${subRadio.id}"]`);
      subItem = subLabelEl ? subLabelEl.textContent.trim() : subRadio.value;
    }
  }

  const path = subItem ? `${category} > ${subItem}` : category;

  return {
    path,                    // "수지모델 > 바람"
    category,                // "수지모델"
    categoryValue,           // "allmenu_style_3_1"
    subItem,                 // "바람"
    subItemValue,            // "wind"
    radioId,                 // "allmenu_style_3_1_1"
  };
};

/**
 * 선택된 지도형 라디오 값을 등록된 콜백 및 iframe(postMessage)으로 전달
 * @param {Object} [customData] - 직접 전달할 데이터 (생략 시 getMapSelectionData() 사용)
 */
export const notifyMapSelection = (customData = null) => {
  const data = customData || getMapSelectionData();
  if (!data) return;

  // 1. 등록된 사용자 콜백 함수 실행
  if (typeof mapSelectionCallback === 'function') {
    try {
      mapSelectionCallback(data);
    } catch (err) {
      console.error('Error executing mapSelectionCallback:', err);
    }
  }

  // 2. window 커스텀 이벤트 발행 (window.addEventListener('mapSelectionChange', ...))
  try {
    window.dispatchEvent(new CustomEvent('mapSelectionChange', { detail: data }));
  } catch (err) {}

  // 3. 아이프레임(iframe)에 postMessage로 값 전달
  const mapContainer = document.querySelector('[data-diaplay-item="map"]');
  if (mapContainer) {
    const iframe = mapContainer.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(
          {
            type: 'MAP_SELECT_CHANGE',
            path: data.path,
            category: data.category,
            categoryValue: data.categoryValue,
            subItem: data.subItem,
            subItemValue: data.subItemValue,
            data,
          },
          '*'
        );
      } catch (err) {
        console.warn('Failed to send postMessage to iframe:', err);
      }
    }
  }
};

/**
 * 전체 메뉴, 설정 다이얼로그 및 메인 화면 영문/국문 번역 딕셔너리
 */
export const I18N_TEXT_MAP = {
  // --- 1. 헤더 & GNB ---
  '날씨': 'Weather',
  '관측': 'Observation',
  '예보': 'Forecast',
  '태풍': 'Typhoon',
  '지진': 'Earthquake',
  '알림': 'Alerts',
  '기상청 날씨알리미': 'KMA Weather Alert',
  '날씨알리미': 'Weather Alert',

  // --- 2. 전체 메뉴 카테고리 헤드 ---
  '전국': 'Nationwide',
  '영상': 'Imagery',
  '바다': 'Marine',
  '항공': 'Aviation',
  '산악': 'Mountain',
  '제보': 'Weather Report',

  // --- 3. 전체 메뉴 서브 링크 ---
  '주요도시': 'Major Cities',
  '지역별 상세관측': 'Regional Observation',
  '과거관측': 'Past Observation',
  '단기예보': 'Short-term Forecast',
  '중기예보': 'Mid-term Forecast',
  '날씨지도': 'Weather Map',
  '분석일기도': 'Synoptic Chart',
  '위성': 'Satellite',
  '낙뢰': 'Lightning',
  '일일예보': 'Daily Forecast',
  '너울 예측': 'Swell Forecast',
  '이안류 예측': 'Rip Current Forecast',
  '공항날씨': 'Airport Weather',
  '실시간 운항정보': 'Live Flight Info',
  '실시간 지진감시': 'Live Earthquake Monitoring',
  '최근 지진': 'Recent Earthquakes',
  '지진해일 조회': 'Tsunami Info',
  '화산 조회': 'Volcano Info',
  '태풍 통보문': 'Typhoon Advisory',
  '열대감시': 'Tropical Monitoring',
  '산악날씨': 'Mountain Weather',
  '제보 조회': 'View Reports',
  '제보 등록': 'Submit Report',
  '나의 제보': 'My Reports',

  // --- 4. 정책 및 하단 메뉴 ---
  '정책 · 정보': 'Policy & Info',
  '제안 · 건의': 'Feedback',
  '공지사항': 'Notices',
  '이용안내': 'User Guide',
  '개인정보처리방침': 'Privacy Policy',
  '위치정보 수집 안내': 'Location Terms',
  '저작권 보호 및 정책': 'Copyright Policy',
  '접근권한 안내': 'Access Permissions',
  '앱 버전 정보': 'App Version',

  // --- 5. 설정 헤더 및 스타일 ---
  '설정': 'Settings',
  '화면스타일 선택': 'Screen Style',
  '대시보드형': 'Dashboard',
  '정보집약형': 'Information',
  '지도형': 'Map',
  '수치모델': 'Numerical Model',

  // --- 6. 지도형 서브메뉴 & 기상 요소 ---
  '바람': 'Wind',
  '강수': 'Precipitation',
  '구름': 'Clouds',
  '기온': 'Temperature',
  '해수면온도': 'SST',
  '해상바람': 'Sea Wind',
  '습도': 'Hum',
  '해빙': 'Sea Ice',
  '적설': 'Snow',
  '체감온도': 'Sensory Temp',
  '상대습도': 'Relative Humidity',
  '강수확률': 'Precip Prob',
  '강수량': 'Precip Amount',
  '적설량': 'Snow Amount',
  '하늘상태': 'Sky Condition',
  '강수형태': 'Precip Type',
  '유의파고': 'Wave Height',
  '레이더': 'Radar',
  '현재기온': 'Current Temp',
  '일최고기온': 'Daily Max Temp',
  '일최저기온': 'Daily Min Temp',
  '일최대풍속': 'Daily Max Wind',
  '일최대순간풍속': 'Daily Max Gust',
  '일강수': 'Daily Precip',
  '3시간누적강수': '3h Precip',
  '육상지점': 'Land Stations',
  '해상지점': 'Marine Stations',

  // --- 7. 설정 항목 리스트 ---
  '알림설정': 'Notification Settings',
  '관심지역 설정': 'Favorite Locations',
  '예보 표출': 'Forecast Display',
  '첫화면 표출': 'First Screen Display',
  '시간별 예보 모드': 'Hourly Forecast Mode',
  '영상 재생': 'Video Playback',
  '풍속 단위 설정': 'Wind Speed Unit',
  '제보메뉴활성화': 'Report Menu',
  '알림 메뉴 활성화': 'Notification Menu',
  '언어설정': 'Language',
  '큰 글자 모드': 'Large Text Mode',
  '테마사용': 'Theme',

  // --- 8. 스위치 라벨 및 상태 텍스트 ---
  '시간별': 'Hourly',
  '일별': 'Daily',
  '현재': 'Current',
  '그래프': 'Chart',
  '표': 'Table',
  '자동': 'Auto',
  '수동': 'Manual',
  '라이트': 'Light',
  '다크': 'Dark',

  // --- 9. 메인 요약 카드 (Summary Swiper) ---
  '시간당\n강수량': 'Hourly\nPrecip',
  '시간당 강수량': 'Hourly Precip',
  '기상 특보': 'Special Report',
  '특보 날씨 알림': 'Special Weather Alert',
  '특보날씨알림': 'Special Weather Alert',
  '현재 발효 중인 기상특보가 없습니다.': 'No active special weather reports.',
  '해당지역에 폭염주의보, 강풍주의보, 태풍주의보 호우주의보 발효중': 'Heatwave, Strong Wind, Typhoon, and Heavy Rain advisories in effect.',
  '해당지역에 강풍주의보, 풍랑주의보 발효중 (해안가 안전 유의)': 'Strong Wind and Gale advisories in effect (be cautious on coastal areas).',
  '해당지역에 호우경보, 강풍경보 발효중 (저지대 침수 주의)': 'Heavy Rain and Strong Wind warnings in effect (beware of lowland flooding).',

  // --- 10. 메인 섹션 제목 (Section Titles) ---
  '시간별 예보': 'Hourly Forecast',
  '일출일몰 · 월출월몰': 'Sun & Moon',
  '대기질정보': 'Air Quality',
  '자외선지수': 'UV Index',
  '대기정체지수': 'Air Stagnation Index',
  '꽃가루농도위험지수': 'Pollen Risk Index',

  // --- 11. 메인 서브 탭 & 버튼 ---
  '3시간 간격': '3hour',
  '1시간 간격': '1hour',
  '오전': 'AM',
  '오후': 'PM',
  '최저': 'Min',
  '최고': 'Max',
  '평균기온': 'Avg Temp',
  '강수예측': 'Precip Forecast',

  // --- 12. 일출일몰 · 월출월몰 ---
  '일출': 'Sunrise',
  '일몰': 'Sunset',
  '월출': 'Moonrise',
  '월몰': 'Moonset',
  '제공 : 한국천문연구원': 'Source: KASI',

  // --- 13. 대기질 & 지수 ---
  '초미세먼지': 'PM2.5',
  '미세먼지': 'PM10',
  '오존': 'Ozone',
  '좋음': 'Good',
  '보통': 'Moderate',
  '나쁨': 'Unhealthy',
  '매우나쁨': 'Very Unhealthy',

  // --- 14. 꽃가루 필터 ---
  '잡초류': 'Weeds',
  '참나무': 'Oak',
  '소나무': 'Pine',
  '측백나무': 'Cypress',

  // --- 15. 위험/단계 지수 ---
  '낮음': 'Low',
  '높음': 'High',
  '매우높음': 'Very High',
  '위험': 'Hazardous',
  '낮음 0': 'Low 0',
  '낮음 1': 'Low 1',
  '낮음 2': 'Low 2',
  '낮음 3': 'Low 3',
  '낮음 4': 'Low 4',
  '보통 1': 'Moderate 1',
  '보통 2': 'Moderate 2',
  '보통 3': 'Moderate 3',
  '보통 4': 'Moderate 4',
  '보통 5': 'Moderate 5',
  '높음 4': 'High 4',
  '높음 5': 'High 5',
  '높음 6': 'High 6',
  '높음 7': 'High 7',
  '높음 8': 'High 8',

  // --- 16. 날짜 및 요일 ---
  '오늘': 'Today',
  '내일': 'Tomorrow',
  '모레': 'Day After',
  '글피': '2 Days After',
  '월': 'Mon',
  '화': 'Tue',
  '수': 'Wed',
  '목': 'Thu',
  '금': 'Fri',
  '토': 'Sat',
  '일': 'Sun',

  // --- 17. 시간별 예보 테이블 행 헤더 ---
  '시각': 'Time',
  '폭염영향': 'Heat Impact',
  '강수가능성': 'Precip Chance',
  '강수가능성 변화추이': 'Precip Trend',
  '강수량(mm)': 'Precip (mm)',
  '강수량 (mm)': 'Precip (mm)',
  '적설량(cm)': 'Snow (cm)',
  '적설량 (cm)': 'Snow (cm)',
  '강수강도': 'Precip Intensity',
  '풍향/풍속': 'Wind Dir/Speed',
  '풍향 / 풍속': 'Wind Dir/Speed',
  '풍향/풍속(m/s)': 'Wind Dir/Speed (m/s)',
  '풍향/풍속 (m/s)': 'Wind Dir/Speed (m/s)',
  '바람(m/s)': 'Wind (m/s)',
  '기온(체감)': 'Temp (Sensory)',
  '최저/최고기온': 'Min/Max Temp',
  '강수량 및 적설량': 'Precip & Snow',
  '약한비': 'Light Rain',
  '보통비': 'Moderate Rain',
  '강한비': 'Heavy Rain',
  '매우강한비': 'Very Heavy Rain',
  '약한눈': 'Light Snow',
  '보통눈': 'Moderate Snow',
  '강한눈': 'Heavy Snow',
  '대설': 'Heavy Snowfall',
  '비슷': 'Similar',
  '거의없음': 'None',
  '조금': 'Slight',

  // --- 18. 날씨 상태 명칭 ---
  '맑음': 'Clear',
  '구름많음': 'Partly Cloudy',
  '흐림': 'Cloudy',
  '비': 'Rain',
  '눈': 'Snow',
  '비/눈': 'Rain/Snow',
  '소나기': 'Shower',
  '천둥번개': 'Thunderstorm',
  '안개': 'Fog',
  '황사': 'Yellow Dust',

  // --- 19. 풍향 및 바람 세기 ---
  '북': 'N',
  '북동': 'NE',
  '동': 'E',
  '남동': 'SE',
  '남': 'S',
  '남서': 'SW',
  '서': 'W',
  '북서': 'NW',
  '북북동': 'NNE',
  '동북동': 'ENE',
  '동남동': 'ESE',
  '남남동': 'SSE',
  '남남서': 'SSW',
  '서남서': 'WSW',
  '서북서': 'WNW',
  '북북서': 'NNW',
  '약': 'Light',
  '약간강': 'Moderate',
  '강': 'Strong',
  '매우강': 'Very Strong',

  // --- 20. 하단 푸터 네비게이션 ---
  '시간별예보': 'Hourly',
  '일별예보': 'Daily',
  '대기질': 'Air Quality',
  '레이더 · 위성': 'Radar & Satellite',
};

export const I18N_REVERSE_MAP = {};
Object.entries(I18N_TEXT_MAP).forEach(([ko, en]) => {
  I18N_REVERSE_MAP[en] = ko;
});
// 충돌 방지 명시적 우선순위 오버라이드 (영문 -> 국문 복원 시 'Hourly'는 스위치의 '시간별'로 복원)
I18N_REVERSE_MAP['Hourly'] = '시간별';
I18N_REVERSE_MAP['Daily'] = '일별';
I18N_REVERSE_MAP['Hourly Forecast'] = '시간별 예보';
I18N_REVERSE_MAP['Special Weather Alert'] = '특보 날씨 알림';
I18N_REVERSE_MAP['Moderate'] = '보통';
I18N_REVERSE_MAP['Low'] = '낮음';
I18N_REVERSE_MAP['High'] = '높음';
I18N_REVERSE_MAP['Very High'] = '매우높음';
I18N_REVERSE_MAP['Hazardous'] = '위험';
I18N_REVERSE_MAP['Precip (mm)'] = '강수량(mm)';
I18N_REVERSE_MAP['Snow (cm)'] = '적설량(cm)';
I18N_REVERSE_MAP['Precip Intensity'] = '강수강도';
I18N_REVERSE_MAP['Wind Dir/Speed'] = '풍향/풍속';
I18N_REVERSE_MAP['Wind (m/s)'] = '바람(m/s)';
I18N_REVERSE_MAP['Temp (Sensory)'] = '기온(체감)';
I18N_REVERSE_MAP['Min/Max Temp'] = '최저/최고기온';

/**
 * 스위치 전용 영문/국문 딕셔너리
 */
export const SWITCH_MAP = {
  '시간별': 'Hourly',
  '일별': 'Daily',
  '현재': 'Current',
  '예보': 'Forecast',
  '그래프': 'Chart',
  '표': 'Table',
  '자동': 'Auto',
  '수동': 'Manual',
  '라이트': 'Light',
  '다크': 'Dark',
};

export const SWITCH_REVERSE_MAP = {
  'Hourly': '시간별',
  'Daily': '일별',
  'Current': '현재',
  'Forecast': '예보',
  'Chart': '그래프',
  'Table': '표',
  'Auto': '자동',
  'Manual': '수동',
  'Light': '라이트',
  'Dark': '다크',
};

export const I18N_ARIA_MAP = {
  '전체 메뉴': 'All Menu',
  '마이페이지': 'My Page',
  '설정': 'Settings',
  '전체 메뉴 닫기': 'Close All Menu',
  '홈으로 이동': 'Home',
  '설정 닫기': 'Close Settings',
  '화면스타일 도움말': 'Screen Style Help',
  '기상청 유튜브': 'KMA YouTube',
  '새로고침': 'Refresh',
  '도움말': 'Help',
  '즐겨찾기': 'Favorite',
  '검색': 'Search',
  '10초 뒤로': '10s Rewind',
  '재생': 'Play',
  '10초 앞으로': '10s Forward',
  '현재 위치로 이동': 'Current Location',
  '지도 확대': 'Zoom In',
  '지도 축소': 'Zoom Out',
  '하단 메뉴': 'Bottom Navigation',
};

export const I18N_ARIA_REVERSE_MAP = {};
Object.entries(I18N_ARIA_MAP).forEach(([ko, en]) => {
  I18N_ARIA_REVERSE_MAP[en] = ko;
});

export const I18N_ALT_MAP = {
  '강수예측 레이더 영상 지도': 'Precipitation Forecast Radar Map',
};

export const I18N_ALT_REVERSE_MAP = {};
Object.entries(I18N_ALT_MAP).forEach(([ko, en]) => {
  I18N_ALT_REVERSE_MAP[en] = ko;
});

/**
 * 특정 루트 엘리먼트 내의 텍스트 노드를 맵에 따라 치환
 * @param {HTMLElement} rootElement 
 * @param {Object} map 
 * @param {boolean} isEng 
 */
export const replaceTextNodes = (rootElement, map, isEng) => {
  if (!rootElement) return;
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const text = node.nodeValue.trim();
      if (!text) return NodeFilter.FILTER_SKIP;
      if (node.parentElement && (
        node.parentElement.tagName === 'SCRIPT' ||
        node.parentElement.tagName === 'STYLE' ||
        node.parentElement.closest('.form-element-switch') ||
        node.parentElement.closest('.nr__footer-btn')
      )) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodesToUpdate = [];
  while (walker.nextNode()) {
    nodesToUpdate.push(walker.currentNode);
  }

  nodesToUpdate.forEach((node) => {
    const val = node.nodeValue;
    const trimmed = val.trim();

    // 1. 단순 1:1 매핑
    if (map[trimmed]) {
      node.nodeValue = val.replace(trimmed, map[trimmed]);
      return;
    }

    // 2. 체감온도 및 지수 뱃지(낮음/보통/높음/매우높음/위험) 등 패턴 매핑
    if (isEng) {
      if (/^낮음\s*(\d+)$/.test(trimmed)) {
        node.nodeValue = val.replace(/낮음\s*(\d+)/, 'Low $1');
      } else if (/^보통\s*(\d+)$/.test(trimmed)) {
        node.nodeValue = val.replace(/보통\s*(\d+)/, 'Moderate $1');
      } else if (/^높음\s*(\d+)$/.test(trimmed)) {
        node.nodeValue = val.replace(/높음\s*(\d+)/, 'High $1');
      } else if (/^매우높음\s*(\d+)?$/.test(trimmed)) {
        node.nodeValue = val.replace(/매우높음\s*(\d+)?/, (m, d) => d ? `Very High ${d}` : 'Very High');
      } else if (/^위험\s*(\d+)?$/.test(trimmed)) {
        node.nodeValue = val.replace(/위험\s*(\d+)?/, (m, d) => d ? `Hazardous ${d}` : 'Hazardous');
      } else if (/체감온도\s*([\d.-]+°?)/.test(val)) {
        node.nodeValue = val.replace(/체감온도/, 'Feels like');
      } else if (/어제보다\s*([\d.]+)°\s*낮아요/.test(val)) {
        node.nodeValue = val.replace(/어제보다\s*([\d.]+)°\s*낮아요/, '$1° lower than yesterday');
      } else if (/어제보다\s*([\d.]+)°\s*높아요/.test(val)) {
        node.nodeValue = val.replace(/어제보다\s*([\d.]+)°\s*높아요/, '$1° higher than yesterday');
      } else if (/어제와\s*같아요/.test(val)) {
        node.nodeValue = val.replace(/어제와\s*같아요/, 'Same as yesterday');
      }
    } else {
      if (/^Low\s*(\d+)$/i.test(trimmed)) {
        node.nodeValue = val.replace(/Low\s*(\d+)/i, '낮음 $1');
      } else if (/^Moderate\s*(\d+)$/i.test(trimmed)) {
        node.nodeValue = val.replace(/Moderate\s*(\d+)/i, '보통 $1');
      } else if (/^High\s*(\d+)$/i.test(trimmed)) {
        node.nodeValue = val.replace(/High\s*(\d+)/i, '높음 $1');
      } else if (/^Very High\s*(\d+)?$/i.test(trimmed)) {
        node.nodeValue = val.replace(/Very High\s*(\d+)?/i, (m, d) => d ? `매우높음 ${d}` : '매우높음');
      } else if (/^Hazardous\s*(\d+)?$/i.test(trimmed)) {
        node.nodeValue = val.replace(/Hazardous\s*(\d+)?/i, (m, d) => d ? `위험 ${d}` : '위험');
      } else if (/Feels like\s*([\d.-]+°?)/.test(val)) {
        node.nodeValue = val.replace(/Feels like/, '체감온도');
      } else if (/([\d.]+)°\s*lower than yesterday/.test(val)) {
        node.nodeValue = val.replace(/([\d.]+)°\s*lower than yesterday/, '어제보다 $1° 낮아요');
      } else if (/([\d.]+)°\s*higher than yesterday/.test(val)) {
        node.nodeValue = val.replace(/([\d.]+)°\s*higher than yesterday/, '어제보다 $1° 높아요');
      } else if (/Same as yesterday/.test(val)) {
        node.nodeValue = val.replace(/Same as yesterday/, '어제와 같아요');
      }
    }
  });
};

/**
 * 스위치 라벨 속성(data-label-on, data-label-off) 및 텍스트(.txt-checked, .txt-uncheck) 치환
 * @param {HTMLElement} container 
 * @param {boolean|Object} isEngOrMap 
 */
export const updateSwitchLabels = (container, isEngOrMap) => {
  if (!container) return;
  const isEng = (typeof isEngOrMap === 'boolean')
    ? isEngOrMap
    : (isEngOrMap === I18N_TEXT_MAP || document.documentElement.getAttribute('lang') === 'en');

  // 1. 설정 다이얼로그 내 주요 스위치 명시적 1:1 세팅 (충돌 및 오차 원천 차단)
  const sw1Label = container.querySelector('label[for="setting_sw_1"]');
  if (sw1Label) {
    sw1Label.setAttribute('data-label-on', isEng ? 'Hourly' : '시간별');
    sw1Label.setAttribute('data-label-off', isEng ? 'Daily' : '일별');
    const c = sw1Label.querySelector('.txt-checked');
    if (c) c.textContent = isEng ? 'Hourly' : '시간별';
    const u = sw1Label.querySelector('.txt-uncheck');
    if (u) u.textContent = isEng ? 'Daily' : '일별';
  }

  const sw2Label = container.querySelector('label[for="setting_sw_2"]');
  if (sw2Label) {
    sw2Label.setAttribute('data-label-on', isEng ? 'Current' : '현재');
    sw2Label.setAttribute('data-label-off', isEng ? 'Forecast' : '예보');
    const c = sw2Label.querySelector('.txt-checked');
    if (c) c.textContent = isEng ? 'Current' : '현재';
    const u = sw2Label.querySelector('.txt-uncheck');
    if (u) u.textContent = isEng ? 'Forecast' : '예보';
  }

  const swHourlyLabel = container.querySelector('label[for="setting_sw_hourly_mode"]');
  if (swHourlyLabel) {
    swHourlyLabel.setAttribute('data-label-on', isEng ? 'Chart' : '그래프');
    swHourlyLabel.setAttribute('data-label-off', isEng ? 'Table' : '표');
    const c = swHourlyLabel.querySelector('.txt-checked');
    if (c) c.textContent = isEng ? 'Chart' : '그래프';
    const u = swHourlyLabel.querySelector('.txt-uncheck');
    if (u) u.textContent = isEng ? 'Table' : '표';
  }

  const sw3Label = container.querySelector('label[for="setting_sw_3"]');
  if (sw3Label) {
    sw3Label.setAttribute('data-label-on', isEng ? 'Auto' : '자동');
    sw3Label.setAttribute('data-label-off', isEng ? 'Manual' : '수동');
    const c = sw3Label.querySelector('.txt-checked');
    if (c) c.textContent = isEng ? 'Auto' : '자동';
    const u = sw3Label.querySelector('.txt-uncheck');
    if (u) u.textContent = isEng ? 'Manual' : '수동';
  }

  const sw9Label = container.querySelector('label[for="setting_sw_9"]');
  if (sw9Label) {
    sw9Label.setAttribute('data-label-on', isEng ? 'Light' : '라이트');
    sw9Label.setAttribute('data-label-off', isEng ? 'Dark' : '다크');
    const c = sw9Label.querySelector('.txt-checked');
    if (c) c.textContent = isEng ? 'Light' : '라이트';
    const u = sw9Label.querySelector('.txt-uncheck');
    if (u) u.textContent = isEng ? 'Dark' : '다크';
  }

  // 2. 컨테이너 내 기타 모든 스위치(.form-element-switch label) 범용 처리
  const map = isEng ? SWITCH_MAP : SWITCH_REVERSE_MAP;
  const switchLabels = container.querySelectorAll('.form-element-switch label');
  switchLabels.forEach((label) => {
    const forAttr = label.getAttribute('for');
    if (forAttr === 'setting_sw_1' || forAttr === 'setting_sw_2' || forAttr === 'setting_sw_hourly_mode' || forAttr === 'setting_sw_3' || forAttr === 'setting_sw_9') {
      return;
    }
    const onVal = label.getAttribute('data-label-on');
    const offVal = label.getAttribute('data-label-off');
    if (onVal && map[onVal]) {
      label.setAttribute('data-label-on', map[onVal]);
    }
    if (offVal && map[offVal]) {
      label.setAttribute('data-label-off', map[offVal]);
    }
    const txtChecked = label.querySelector('.txt-checked');
    if (txtChecked) {
      const text = txtChecked.textContent.trim();
      if (map[text]) {
        txtChecked.textContent = map[text];
      }
    }
    const txtUncheck = label.querySelector('.txt-uncheck');
    if (txtUncheck) {
      const text = txtUncheck.textContent.trim();
      if (map[text]) {
        txtUncheck.textContent = map[text];
      }
    }
  });
};

/**
 * 하단 푸터 네비게이션 텍스트 영문/국문 갱신
 * @param {boolean} isEng 
 */
export const updateFooterNav = (isEng) => {
  const footerHourly = document.querySelector('.nr__footer-btn[data-target="#section-hourly"] .nr__footer-text');
  if (footerHourly) {
    footerHourly.textContent = isEng ? 'Hourly' : '시간별예보';
  }
  const footerDaily = document.querySelector('.nr__footer-btn[data-target="#section-daily"] .nr__footer-text');
  if (footerDaily) {
    footerDaily.textContent = isEng ? 'Daily' : '일별예보';
  }
  const footerAir = document.querySelector('.nr__footer-btn[data-target="#section-air"] .nr__footer-text');
  if (footerAir) {
    footerAir.textContent = isEng ? 'Air Quality' : '대기질';
  }
  const footerRadar = document.querySelector('.nr__footer-btn[data-radar-tab="picture1"] .nr__footer-text');
  if (footerRadar) {
    footerRadar.textContent = isEng ? 'Radar' : '레이더';
  }
  const footerSat = document.querySelector('.nr__footer-btn[data-radar-tab="picture2"] .nr__footer-text');
  if (footerSat) {
    footerSat.textContent = isEng ? 'Satellite' : '위성';
  }
  const footerSpecial = document.querySelector('.nr__footer-btn[href*="weather.go.kr"] .nr__footer-text, .nr__footer-btn[aria-label*="특보"] .nr__footer-text');
  if (footerSpecial) {
    footerSpecial.textContent = isEng ? 'Special Report' : '특보';
  }
  const footerCombined = document.querySelector('.nr__footer-btn[data-target="#section-radar"]:not([data-radar-tab]) .nr__footer-text');
  if (footerCombined) {
    footerCombined.textContent = isEng ? 'Radar & Satellite' : '레이더 · 위성';
  }
};

/**
 * aria-label 속성 치환
 * @param {HTMLElement} container 
 * @param {Object} map 
 */
export const updateAriaLabels = (container, map) => {
  if (!container) return;
  if (container.hasAttribute && container.hasAttribute('aria-label')) {
    const aria = container.getAttribute('aria-label');
    if (aria && map[aria]) {
      container.setAttribute('aria-label', map[aria]);
    }
  }
  const elements = container.querySelectorAll('[aria-label]');
  elements.forEach((el) => {
    const aria = el.getAttribute('aria-label');
    if (aria && map[aria]) {
      el.setAttribute('aria-label', map[aria]);
    }
  });
};

/**
 * img alt 속성 치환
 * @param {HTMLElement} container 
 * @param {Object} map 
 */
export const updateAltAttributes = (container, map) => {
  if (!container) return;
  const elements = container.querySelectorAll('img[alt]');
  elements.forEach((el) => {
    const alt = el.getAttribute('alt');
    if (alt && map[alt]) {
      el.setAttribute('alt', map[alt]);
    }
  });
};

/**
 * 전체 화면 (헤더, 메인, 푸터, 다이얼로그) 텍스트/라벨 영문/국문 일괄 적용
 * @param {string} lang - 'ko' | 'en'
 */
export const applyLanguage = (lang = 'ko') => {
  const isEng = (lang === 'en' || String(lang).toUpperCase() === 'ENG');
  const targetLang = isEng ? 'en' : 'ko';
  document.documentElement.setAttribute('lang', targetLang);
  document.title = isEng ? 'KMA Weather Alert' : '날씨알리미';

  const textMap = isEng ? I18N_TEXT_MAP : I18N_REVERSE_MAP;
  const ariaMap = isEng ? I18N_ARIA_MAP : I18N_ARIA_REVERSE_MAP;
  const altMap = isEng ? I18N_ALT_MAP : I18N_ALT_REVERSE_MAP;

  // 헤더, 메인, 푸터, 모든 팝업 다이얼로그 컨테이너 대상
  const targets = document.querySelectorAll(
    'header, main, footer, .ui-dialog, #nr-allmenu, [data-dialog="setting-dialog"], .nr__setting-dialog'
  );

  targets.forEach((container) => {
    replaceTextNodes(container, textMap, isEng);
    updateSwitchLabels(container, isEng);
    updateAriaLabels(container, ariaMap);
    updateAltAttributes(container, altMap);
  });

  // 하단 푸터 네비게이션 버튼 텍스트 명시적 갱신
  updateFooterNav(isEng);
};

/**
 * GNB 알림 메뉴 노출/숨김 상태 갱신
 * @param {boolean} isEnabled - true: 노출, false: 숨김
 */
export const updateAlarmMenuVisibility = (isEnabled) => {
  const gnbItems = document.querySelectorAll('.nr__header-gnb-item');
  gnbItems.forEach((item) => {
    const isAlarm = item.getAttribute('data-gnb-menu') === 'alert' ||
      item.querySelector('a[href="#forecast"]') ||
      item.textContent.trim() === '알림' ||
      item.textContent.trim() === 'Alerts';
    if (isAlarm) {
      item.style.display = isEnabled ? '' : 'none';
    }
  });
};

/**
 * 설정 다이얼로그 전역 인스턴스 참조
 */
let settingDialogInstance = null;

/**
 * 설정 다이얼로그 열기
 * @param {HTMLElement} [triggerBtn] - 설정 다이얼로그를 호출한 버튼
 */
export const openSettingDialog = (triggerBtn = null) => {
  const dialogEl = document.querySelector('[data-dialog="setting-dialog"]');
  if (!dialogEl) {
    console.warn('Setting dialog element not found in DOM.');
    return null;
  }

  // 현재 언어 상태 반영
  const currentLang = document.documentElement.getAttribute('lang') || 'ko';
  applyLanguage(currentLang);

  if (!settingDialogInstance) {
    settingDialogInstance = new Dialog({
      id: 'setting-dialog',
      type: 'modal',
      ps: 'bottom',
      full: true,
      dim: true,
      dimClick: true,
    });
  }

  // 현재 body 테마 상태에 따라 스위치 checked 값 동기화 (라이트: false, 다크/나이트: true)
  const themeSwitch = dialogEl.querySelector('#setting_sw_9');
  if (themeSwitch) {
    const isDark = document.body.classList.contains('dark-theme') || document.body.classList.contains('night-theme');
    themeSwitch.checked = isDark;
  }

  // 큰글씨 모드 스위치(#setting_sw_8) 동기화 (data-zoom === "2"이면 ON(false), "1"이면 OFF(true))
  const fontSwitch = dialogEl.querySelector('#setting_sw_8');
  if (fontSwitch) {
    const isZoom = document.body.getAttribute('data-zoom') === '2';
    fontSwitch.checked = !isZoom;
  }

  // 시간별 예보 모드 스위치(#setting_sw_hourly_mode) 동기화 (표: true, 그래프: false)
  const hourlyModeSwitch = dialogEl.querySelector('#setting_sw_hourly_mode');
  if (hourlyModeSwitch) {
    let savedMode = null;
    try { savedMode = sessionStorage.getItem('nr_forecast_view_mode'); } catch (err) {}
    const activeBtn = document.querySelector('.nr__hourly-view-btn.active');
    const currentMode = activeBtn ? activeBtn.dataset.view : (savedMode || 'mode3');
    hourlyModeSwitch.checked = (currentMode === 'mode3');
  }

  // 언어 설정 스위치(#setting_sw_7) 동기화 (lang === 'en'이면 true(ENG), 'ko'이면 false(한국어))
  const langSwitch = dialogEl.querySelector('#setting_sw_7');
  if (langSwitch) {
    let savedLang = null;
    try { savedLang = sessionStorage.getItem('nr_lang'); } catch (err) {}
    const currentLang = savedLang || document.documentElement.getAttribute('lang') || 'ko';
    langSwitch.checked = (currentLang === 'en');
  }

  // 알림 메뉴 활성화 스위치(#setting_sw_6) 동기화 (ON(노출): false, OFF(숨김): true)
  const alarmSwitch = dialogEl.querySelector('#setting_sw_6');
  if (alarmSwitch) {
    let savedAlarm = null;
    try { savedAlarm = sessionStorage.getItem('nr_alarm_menu_enabled'); } catch (err) {}
    const isAlarmEnabled = (savedAlarm !== null) ? (savedAlarm === 'true') : !alarmSwitch.checked;
    alarmSwitch.checked = !isAlarmEnabled;
  }

  // 풍속 단위 설정 스위치(#setting_sw_4) 동기화 (m/s: false, km/h: true)
  const windSwitch = dialogEl.querySelector('#setting_sw_4');
  if (windSwitch) {
    let savedWind = null;
    try { savedWind = sessionStorage.getItem('nr_wind_unit'); } catch (err) {}
    windSwitch.checked = (savedWind === 'kmh');
  }

  // 지도형 서브 라디오 동기화 (data-maptype-check)
  const mapTypeContainer = dialogEl.querySelector('[data-maptype-check]');
  if (mapTypeContainer) {
    const checkedRadio = mapTypeContainer.querySelector(
      '[data-mapsub-area] input[type="radio"]:checked, input[name="allmenu_style_3"]:checked'
    );
    if (checkedRadio) {
      mapTypeContainer.setAttribute('data-maptype-check', checkedRadio.value);
    }
  }

  settingDialogInstance.show(triggerBtn);
  return settingDialogInstance;
};

/**
 * 설정 다이얼로그 및 세그먼트 버튼 전역 이벤트 바인딩
 */
export const initSettingDialog = () => {
  // 초기 body data-zoom 설정 (기본값 '1', 저장된 세션값 우선)
  if (!document.body.hasAttribute('data-zoom')) {
    let savedZoom = '1';
    try { savedZoom = sessionStorage.getItem('nr_zoom') || '1'; } catch (err) {}
    document.body.setAttribute('data-zoom', savedZoom);
  }

  // 초기 html lang 설정 (기본값 'ko', 저장된 세션값 우선)
  let savedLang = null;
  try { savedLang = sessionStorage.getItem('nr_lang'); } catch (err) {}
  const initialLang = savedLang || document.documentElement.getAttribute('lang') || 'ko';
  document.documentElement.setAttribute('lang', initialLang);
  applyLanguage(initialLang);

  const initialLangSwitch = document.querySelector('#setting_sw_7');
  if (initialLangSwitch) {
    initialLangSwitch.checked = (initialLang === 'en');
  }

  // 초기 알림 메뉴 노출 여부 반영 (기본값 true(ON), 저장된 세션값 우선)
  let savedAlarm = null;
  try { savedAlarm = sessionStorage.getItem('nr_alarm_menu_enabled'); } catch (err) {}
  const initialAlarmEnabled = (savedAlarm !== null) ? (savedAlarm === 'true') : true;
  updateAlarmMenuVisibility(initialAlarmEnabled);

  const initialAlarmSwitch = document.querySelector('#setting_sw_6');
  if (initialAlarmSwitch) {
    initialAlarmSwitch.checked = !initialAlarmEnabled;
  }

  // 초기 풍속 단위 스위치 동기화
  let savedWind = null;
  try { savedWind = sessionStorage.getItem('nr_wind_unit'); } catch (err) {}
  const initialWindSwitch = document.querySelector('#setting_sw_4');
  if (initialWindSwitch && savedWind) {
    initialWindSwitch.checked = (savedWind === 'kmh');
  }

  document.addEventListener('click', (e) => {
    // 1. 헤더 설정 버튼 클릭 시 설정 다이얼로그 호출
    const settingBtn = e.target.closest('.nr__allmenu-btn--setting, [data-dialog-target="setting-dialog"]');
    if (settingBtn) {
      e.preventDefault();
      openSettingDialog(settingBtn);
      return;
    }

    // 2. 홈 버튼 클릭 시 설정 다이얼로그 닫기 (또는 메인 이동)
    const homeBtn = e.target.closest('.nr__setting-btn-home');
    if (homeBtn) {
      e.preventDefault();
      if (settingDialogInstance) {
        settingDialogInstance.hide();
      }
      return;
    }

    // 3. 설정 내 세그먼트 토글 버튼 클릭 처리 (예보 표출, 언어, 테마 등)
    const segmentedBtn = e.target.closest('.nr__setting-segmented .nr__segmented-btn');
    if (segmentedBtn) {
      e.preventDefault();
      const group = segmentedBtn.closest('.nr__setting-segmented');
      if (group) {
        group.querySelectorAll('.nr__segmented-btn').forEach((btn) => {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-checked', 'false');
        });
        segmentedBtn.classList.add('is-active');
        segmentedBtn.setAttribute('aria-checked', 'true');

        // 테마 및 언어 설정 변경 연동
        const item = segmentedBtn.closest('.nr__setting-item');
        if (item) {
          const label = item.querySelector('.nr__setting-label')?.textContent.trim();
          if (label === '언어설정' || label === '언어' || label === 'Language') {
            const isEng = segmentedBtn.textContent.trim().toUpperCase() === 'ENG';
            setLanguage(isEng ? 'en' : 'ko');
          } else if (label === '테마사용' || label === 'Theme') {
            const isDark = segmentedBtn.textContent.trim() === '다크';
            const theme = isDark ? 'dark' : 'light';
            document.body.classList.remove('light-theme', 'night-theme', 'dark-theme');
            document.body.classList.add(`${theme}-theme`);
            try { sessionStorage.setItem('nr_theme', theme); } catch (err) {}
            const themeSelect = document.querySelector('.nr__theme-select');
            if (themeSelect) {
              themeSelect.value = theme;
            }
            const themeSwitch = document.querySelector('#setting_sw_9');
            if (themeSwitch) {
              themeSwitch.checked = !isDark;
            }
          }
        }
      }
    }
  });

  // 4. 스위치(#setting_sw_9) 변경 시 테마 변경 처리 및 셀렉트 동기화 (checked === false : 라이트, checked === true : 다크)
  document.addEventListener('change', (e) => {
    const themeSwitch = e.target.closest('#setting_sw_9');
    if (themeSwitch) {
      const isDark = themeSwitch.checked;
      const theme = isDark ? 'dark' : 'light';
      document.body.classList.remove('light-theme', 'night-theme', 'dark-theme');
      document.body.classList.add(`${theme}-theme`);
      try { sessionStorage.setItem('nr_theme', theme); } catch (err) {}
      const themeSelect = document.querySelector('.nr__theme-select');
      if (themeSelect) {
        themeSelect.value = theme;
      }
    }
  });

  // 5. 큰글씨 모드 스위치(#setting_sw_8) 변경 시 body data-zoom 설정 (checked : 1 (OFF), unchecked : 2 (ON))
  document.addEventListener('change', (e) => {
    const fontSwitch = e.target.closest('#setting_sw_8');
    if (fontSwitch) {
      const zoom = fontSwitch.checked ? '1' : '2';
      document.body.setAttribute('data-zoom', zoom);
      try { sessionStorage.setItem('nr_zoom', zoom); } catch (err) {}
    }
  });

  // 5-1. 시간별 예보 모드 스위치(#setting_sw_hourly_mode) 변경 시 표('mode3') / 그래프('mode2') 전환
  document.addEventListener('change', (e) => {
    const hourlySwitch = e.target.closest('#setting_sw_hourly_mode');
    if (hourlySwitch) {
      const targetMode = hourlySwitch.checked ? 'mode3' : 'mode2';
      try { sessionStorage.setItem('nr_forecast_view_mode', targetMode); } catch (err) {}
      if (typeof window.switchForecastViewMode === 'function') {
        window.switchForecastViewMode(targetMode);
      } else {
        const targetBtn = document.querySelector(`.nr__hourly-view-btn[data-view="${targetMode}"]`);
        if (targetBtn) targetBtn.click();
      }
    }
  });

  // 5-2. 언어설정 스위치(#setting_sw_7) 변경 시 html lang 변경 (checked: 'en' (ENG), unchecked: 'ko' (한국어))
  document.addEventListener('change', (e) => {
    const langSwitch = e.target.closest('#setting_sw_7');
    if (langSwitch) {
      const isEng = langSwitch.checked;
      setLanguage(isEng ? 'en' : 'ko');

      // 세그먼트 버튼이 있는 경우 동기화
      const item = langSwitch.closest('.nr__setting-item');
      if (item) {
        item.querySelectorAll('.nr__setting-segmented .nr__segmented-btn').forEach((btn) => {
          const isBtnEng = btn.textContent.trim().toUpperCase() === 'ENG';
          const active = isEng ? isBtnEng : !isBtnEng;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-checked', active ? 'true' : 'false');
        });
      }
    }
  });

  // 5-3. 알림 메뉴 활성화 스위치(#setting_sw_6) 변경 시 GNB 알림 메뉴 노출 여부 컨트롤
  document.addEventListener('change', (e) => {
    const alarmSwitch = e.target.closest('#setting_sw_6');
    if (alarmSwitch) {
      const isEnabled = !alarmSwitch.checked; // unchecked: ON (노출), checked: OFF (숨김)
      try { sessionStorage.setItem('nr_alarm_menu_enabled', String(isEnabled)); } catch (err) {}
      updateAlarmMenuVisibility(isEnabled);
    }
  });

  // 5-4. 풍속 단위 설정 스위치(#setting_sw_4) 변경 시 저장 (unchecked: m/s, checked: km/h)
  document.addEventListener('change', (e) => {
    const windSwitch = e.target.closest('#setting_sw_4');
    if (windSwitch) {
      const unit = windSwitch.checked ? 'kmh' : 'ms';
      try { sessionStorage.setItem('nr_wind_unit', unit); } catch (err) {}
    }
  });

  // 6. 지도형 서브 라디오 선택 시 data-maptype-check 속성에 checked 된 value 반영 및 콜백/아이프레임 전달
  document.addEventListener('change', (e) => {
    // 1차 서브 라디오(수치모델, 예보, 관측) 변경 시
    const categoryRadio =
      e.target.closest('[data-mapsub-area] input[type="radio"]') ||
      (e.target.name === 'allmenu_style_3' ? e.target : null);
    if (categoryRadio && categoryRadio.checked) {
      const target = categoryRadio.closest('[data-maptype-check]');
      if (target) {
        target.setAttribute('data-maptype-check', categoryRadio.value);
      }
      notifyMapSelection();
      return;
    }

    // 2차 서브 라디오(바람, 강수, 구름 등) 변경 시
    const subRadio = e.target.closest('[data-mapsub2-area] input[type="radio"]');
    if (subRadio && subRadio.checked) {
      notifyMapSelection();
      return;
    }
  });
};

/**
 * 전체 메뉴 전역 인스턴스 참조
 */
let allMenuDialogInstance = null;

/**
 * 전체 메뉴 열기 (ui-dialog 기반, 우측 슬라이드 인 모션)
 * @param {HTMLElement} [triggerBtn] - 전체 메뉴를 호출한 버튼
 * @param {Object} [options] - 위치/모션 옵션 ({ ps: 'right', motion: 'slide-right' })
 */
export const openAllMenu = (triggerBtn = null, options = {}) => {
  const dialogEl = document.querySelector('.nr__allmenu, [data-dialog="allmenu-dialog"]');
  if (!dialogEl) {
    console.warn('Allmenu dialog element not found in DOM.');
    return null;
  }

  // 현재 언어 상태 반영
  const currentLang = document.documentElement.getAttribute('lang') || 'ko';
  applyLanguage(currentLang);

  const dialogId = dialogEl.dataset.dialog || 'allmenu-dialog';
  const targetPs = options.ps || dialogEl.dataset.ps || 'right';
  const targetMotion = options.motion || dialogEl.dataset.motion || 'slide-right';

  if (!allMenuDialogInstance) {
    allMenuDialogInstance = new Dialog({
      id: dialogId,
      type: 'modal',
      ps: targetPs,
      motion: targetMotion,
      full: true,
      dim: options.dim !== undefined ? options.dim : true,
      dimClick: options.dimClick !== undefined ? options.dimClick : true,
      ...options,
    });
  } else {
    allMenuDialogInstance.option.ps = targetPs;
    allMenuDialogInstance.option.motion = targetMotion;
    if (allMenuDialogInstance.dialog) {
      allMenuDialogInstance.dialog.dataset.ps = targetPs;
      allMenuDialogInstance.dialog.dataset.motion = targetMotion;
    }
  }

  // body의 data-display 값 동기화 (기본값 dash)
  const currentDisplay = document.body.getAttribute('data-display') || 'dash';
  document.body.setAttribute('data-display', currentDisplay);
  const targetRadio = dialogEl.querySelector(`input[name="allmenu_style_"][value="${currentDisplay}"]`);
  if (targetRadio) {
    targetRadio.checked = true;
  }

  // 지도형 서브 라디오 동기화 (data-maptype-check)
  const mapTypeContainer = dialogEl.querySelector('[data-maptype-check]');
  if (mapTypeContainer) {
    const checkedRadio = mapTypeContainer.querySelector(
      '[data-mapsub-area] input[type="radio"]:checked, input[name="allmenu_style_3"]:checked'
    );
    if (checkedRadio) {
      mapTypeContainer.setAttribute('data-maptype-check', checkedRadio.value);
    }
  }

  allMenuDialogInstance.show(triggerBtn);
  dialogEl.classList.add('is-active');
  return allMenuDialogInstance;
};

/**
 * 전체 메뉴 닫기
 */
export const closeAllMenu = () => {
  if (allMenuDialogInstance) {
    allMenuDialogInstance.hide();
  }
  const dialogEl = document.querySelector('.nr__allmenu, [data-dialog="allmenu-dialog"]');
  if (dialogEl) {
    dialogEl.classList.remove('is-active');
  }
};

/**
 * 전체 메뉴 이벤트 바인딩
 */
export const initAllMenuEvents = () => {
  document.addEventListener('click', (e) => {
    // 1. 헤더 메뉴 버튼 클릭 시 전체 메뉴 다이얼로그 오픈
    const menuBtn = e.target.closest('.nr__header-btn--menu, [data-dialog-target="allmenu-dialog"]');
    if (menuBtn) {
      e.preventDefault();
      openAllMenu(menuBtn);
      return;
    }

    // 2. 전체 메뉴 닫기 버튼 클릭
    const closeBtn = e.target.closest('.nr__allmenu-btn--close, [data-dialog-button="close"]');
    if (closeBtn && e.target.closest('.nr__allmenu, [data-dialog="allmenu-dialog"]')) {
      e.preventDefault();
      closeAllMenu();
      return;
    }

    // 3. 화면스타일 선택 카드 클릭
    const styleCard = e.target.closest('.nr__allmenu-style-card');
    if (styleCard) {
      e.preventDefault();
      const cardGroup = styleCard.closest('.nr__allmenu-style-cards');
      if (cardGroup) {
        cardGroup.querySelectorAll('.nr__allmenu-style-card').forEach((card) => {
          card.classList.remove('is-active');
          card.setAttribute('aria-checked', 'false');
        });
        styleCard.classList.add('is-active');
        styleCard.setAttribute('aria-checked', 'true');
      }
      return;
    }
  });

  // 4. 화면스타일 라디오 선택 변경 시 body[data-display="dash|info|map"] 변경
  document.addEventListener('change', (e) => {
    const styleRadio = e.target.closest('input[name="allmenu_style_"]');
    if (styleRadio) {
      const displayVal = styleRadio.value; // 'dash' | 'info' | 'map'
      document.body.setAttribute('data-display', displayVal);
      if (displayVal === 'map') {
        notifyMapSelection();
      }
    }
  });
};

/**
 * 지도형(map) 모드 진입 시에만 iframe 동적 로드(lazy load) 및 타 메뉴 이동 시 제거(unload) 처리
 * @param {string} displayVal - 'dash' | 'info' | 'map'
 */
export const updateMapIframe = (displayVal) => {
  const mapContainer = document.querySelector('[data-diaplay-item="map"]');
  if (!mapContainer) return;
  const iframe = mapContainer.querySelector('iframe');
  if (!iframe) return;

  const targetSrc = iframe.dataset.src || 'https://www.weather.go.kr/wnuri-map/html/map.html';
  if (!iframe.dataset.src) {
    iframe.dataset.src = targetSrc;
  }

  if (displayVal === 'map') {
    if (!iframe.getAttribute('src') || iframe.getAttribute('src') === 'about:blank') {
      iframe.setAttribute('src', targetSrc);
      iframe.addEventListener('load', () => {
        // iframe 로드 완료 시 현재 선택된 라디오 값을 iframe으로 1회 전송
        setTimeout(() => notifyMapSelection(), 100);
      }, { once: true });
    } else {
      notifyMapSelection();
    }
  } else {
    if (iframe.getAttribute('src') && iframe.getAttribute('src') !== 'about:blank') {
      iframe.removeAttribute('src');
    }
  }
};

/**
 * data-display 감시 및 날씨지도 이동 처리 컨트롤러
 */
export const initMapIframeController = () => {
  const syncMap = () => {
    const currentDisplay = document.body.getAttribute('data-display') || 'dash';
    updateMapIframe(currentDisplay);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'data-display') {
        syncMap();
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-display'] });
    syncMap();
  }

  // '날씨지도' 버튼/링크 클릭 시 지도형 모드로 전환 및 iframe 로드
  document.addEventListener('click', (e) => {
    const mapLink = e.target.closest('.nr__radar-link-btn, a[href="#"].nr__allmenu-sub-link');
    if (mapLink) {
      const text = mapLink.textContent.trim();
      if (text.includes('날씨지도') || mapLink.classList.contains('nr__radar-link-btn')) {
        e.preventDefault();
        document.body.setAttribute('data-display', 'map');
        const mapRadio = document.querySelector('input[name="allmenu_style_"][value="map"]');
        if (mapRadio) mapRadio.checked = true;
        closeAllMenu();
        notifyMapSelection();
      }
    }
  });
};

/**
 * 언어 설정 변경 함수 ('ko' | 'en')
 * @param {string} lang - 'ko' 또는 'en'
 */
export const setLanguage = (lang = 'ko') => {
  const isEng = (lang === 'en' || String(lang).toUpperCase() === 'ENG');
  const targetLang = isEng ? 'en' : 'ko';
  document.documentElement.setAttribute('lang', targetLang);
  try { sessionStorage.setItem('nr_lang', targetLang); } catch (err) {}
  const langSwitch = document.querySelector('#setting_sw_7');
  if (langSwitch) {
    langSwitch.checked = isEng;
  }
  applyLanguage(targetLang);
};

/**
 * 메인 화면 동적 렌더링 감시 및 자동 언어 반영 Observer
 */
let mainObserver = null;
let mainObserverTimer = null;

export const initMainI18nObserver = () => {
  if (mainObserver) return;
  const mainEl = document.querySelector('main');
  if (!mainEl) return;

  mainObserver = new MutationObserver(() => {
    const currentLang = document.documentElement.getAttribute('lang') || 'ko';
    if (currentLang === 'en') {
      if (mainObserverTimer) clearTimeout(mainObserverTimer);
      mainObserverTimer = setTimeout(() => {
        applyLanguage('en');
      }, 50);
    }
  });

  mainObserver.observe(mainEl, { childList: true, subtree: true });
};

/**
 * 전체 메뉴 및 설정 다이얼로그 종합 초기화
 */
export const initAllMenu = () => {
  initSettingDialog();
  initAllMenuEvents();
  initMapIframeController();
  initMainI18nObserver();
};

if (typeof window !== 'undefined') {
  window.openAllMenu = openAllMenu;
  window.closeAllMenu = closeAllMenu;
  window.openSettingDialog = openSettingDialog;
  window.updateMapIframe = updateMapIframe;
  window.initAllMenu = initAllMenu;
  window.setMapChangeCallback = setMapChangeCallback;
  window.onMapSelectionChange = onMapSelectionChange;
  window.getMapSelectionData = getMapSelectionData;
  window.notifyMapSelection = notifyMapSelection;
  window.setLanguage = setLanguage;
  window.applyLanguage = applyLanguage;
  window.initMainI18nObserver = initMainI18nObserver;
  window.updateSwitchLabels = updateSwitchLabels;
  window.updateFooterNav = updateFooterNav;
  window.updateAlarmMenuVisibility = updateAlarmMenuVisibility;
}
