// ==========================================================================
// UI Forecast Module (ui-forecast.js)
// - 상단 단기예보일정 / 하단 중기예보일정 분리 구조 및 단일 선택 관리
// - 선택된 일정: 카드 형태(확장되어 날씨 아이콘, 최저/최고 기온 등 상세 정보 표시)
// - 선택되지 않은 일정: 알약(Pill) 형태로 최소화
// - 가로스크롤 및 중앙 기준 스크롤 이동
// - 단기예보: 챠트선 대신 텍스트로 표시 (Image 1)
// - 중기예보: 하늘상태/최저최고기온/평균기온/강수가능성/변화추이 (Image 2)
// - 단일 차트 컴포넌트 동적 전환 및 스크롤 연동
// ==========================================================================

import { renderAllForecastCharts } from './ui-forecast-chart.js';

// 상태 관리 변수
let globalForecastData = null;
let shortTermList = [];
let midTermList = [];
let currentSelectedDate = null;
let currentForecastType = 'short'; // 'short' | 'mid'
let isProgrammaticScroll = false;
let programmaticScrollTimer = null;

/**
 * 풍향 각도 계산 헬퍼
 */
export const getWindAngle = (dir) => {
  if (typeof dir === 'number') return dir;
  const angles = {
    N: 0, NNE: 23, NE: 45, ENE: 68,
    E: 90, ESE: 113, SE: 135, SSE: 158,
    S: 180, SSW: 203, SW: 225, WSW: 248,
    W: 270, WNW: 293, NW: 315, NNW: 338,
  };
  return angles[dir] ?? 0;
};

/**
 * 강수가능성 등급 및 텍스트 계산
 */
export const getRainPossibilityInfo = (h) => {
  if (h.rainPossibility) {
    const text = h.rainPossibility;
    let level = 'low';
    if (text === '높음') level = 'high';
    else if (text === '보통') level = 'mid';
    else if (text === '거의없음') level = 'none';
    return { text, level };
  }
  const prob = parseInt(h.rainProb, 10) || 0;
  if (prob >= 60) return { text: '높음', level: 'high' };
  if (prob >= 40) return { text: '보통', level: 'mid' };
  if (prob >= 20) return { text: '조금', level: 'low' };
  return { text: '거의없음', level: 'none' };
};

/**
 * 강수가능성 변화추이 등급 및 텍스트 계산
 */
export const getRainTrendInfo = (h, prevH) => {
  if (h.rainTrend) {
    const text = h.rainTrend;
    let level = 'same';
    if (text === '높음') level = 'high';
    else if (text === '낮음') level = 'low';
    return { text, level };
  }
  if (!prevH) {
    const prob = parseInt(h.rainProb, 10) || 0;
    if (prob >= 60) return { text: '높음', level: 'high' };
    if (prob <= 20) return { text: '낮음', level: 'low' };
    return { text: '비슷', level: 'same' };
  }
  const currProb = parseInt(h.rainProb, 10) || 0;
  const prevProb = parseInt(prevH.rainProb, 10) || 0;
  const diff = currProb - prevProb;
  if (diff > 0) return { text: '높음', level: 'high' };
  if (diff < 0) return { text: '낮음', level: 'low' };
  return { text: '비슷', level: 'same' };
};

/**
 * 날짜 텍스트 (오늘, 내일, 모레, 날짜)
 */
export const getDisplayDateText = (targetDate, dataList) => {
  const list = dataList || globalForecastData;
  if (!Array.isArray(list) || !targetDate) return targetDate || '';
  const idx = list.findIndex((item) => item.date === targetDate);
  if (idx === 0) return '오늘';
  if (idx === 1) return '내일';
  if (idx === 2) return '모레';
  if (idx >= 3) {
    const item = list[idx];
    return item ? item.date || targetDate : targetDate;
  }
  return targetDate || '';
};

/**
 * 고정 열 시각 셀(.nr__row-time-box) 갱신
 */
export const updateFixedTimeCell = (targetDate, dataList) => {
  const fixedTimeCell = document.querySelector('.nr__hourly-fixed-column .nr__row-time');
  if (fixedTimeCell) {
    fixedTimeCell.innerHTML = `<span class="nr__row-time-box">${getDisplayDateText(targetDate, dataList || globalForecastData)}</span>`;
  }
};

/**
 * 가로 스크롤 컨테이너 내에서 대상 엘리먼트를 '중앙' 기준으로 부드럽게 스크롤
 * @param {HTMLElement} container
 * @param {HTMLElement} element
 * @param {'smooth'|'auto'} [behavior='smooth']
 */
export const scrollToCenter = (container, element, behavior = 'smooth') => {
  if (!container || !element) return;
  if (container.scrollWidth <= container.clientWidth) return;
  const containerWidth = container.clientWidth;
  const elLeft = element.offsetLeft;
  const elWidth = element.offsetWidth;
  const targetScrollLeft = elLeft - containerWidth / 2 + elWidth / 2;
  container.scrollTo({
    left: Math.max(0, targetScrollLeft),
    behavior,
  });
};

/**
 * 차트 뷰포트 내 특정 날짜 그룹의 시작시간이 고정 열 바로 옆에 오도록 스크롤
 * @param {string} targetDate
 * @param {'smooth'|'auto'} [behavior='smooth']
 */
export const scrollToHourlyDate = (targetDate, behavior = 'smooth') => {
  if (!targetDate) return;

  const viewport = document.querySelector('.nr__hourly-scroll-viewport');
  if (!viewport) return;

  const targetBlock = viewport.querySelector(`.nr__date-group[data-date="${targetDate}"]`);
  if (targetBlock) {
    isProgrammaticScroll = true;
    clearTimeout(programmaticScrollTimer);

    const onScrollEnd = () => {
      viewport.removeEventListener('scrollend', onScrollEnd);
      clearTimeout(programmaticScrollTimer);
      programmaticScrollTimer = setTimeout(() => {
        isProgrammaticScroll = false;
      }, 50);
    };

    if ('onscrollend' in window) {
      viewport.addEventListener('scrollend', onScrollEnd, { once: true });
    }

    programmaticScrollTimer = setTimeout(() => {
      isProgrammaticScroll = false;
    }, 650);

    const targetLeft = targetBlock.offsetLeft;
    viewport.scrollTo({
      left: Math.max(0, targetLeft),
      behavior,
    });
  }
};

/**
 * 알약(Pill) HTML 렌더러 (최소화된 일정 행)
 */
const renderPillsHtml = (list, type) => {
  return list
    .map((item) => {
      return `
        <button type="button" class="nr__schedule-pill" data-date="${item.date}" data-type="${type}">
          ${item.date}
        </button>
      `;
    })
    .join('');
};

/**
 * 상세 카드 HTML 렌더러 (확장된 일정 행)
 */
const renderCardsHtml = (list, selectedDate, type) => {
  return list
    .map((item) => {
      const isActive = item.date === selectedDate;
      return `
        <div class="nr__weather-card ${isActive ? 'active' : ''}" data-date="${item.date}" data-type="${type}">
          <div class="nr__weather-card-header">
            <span class="nr__weather-card-date">${item.date}</span>
            <span class="nr__weather-card-week">${item.dayOfWeek}</span>
          </div>
          <div class="nr__weather-card-body">
            <div class="nr__weather-card-body-atype">
              <div class="nr__weather-card-icon">
                ${
                  item.amIcon
                    ? `
                  <div class="nr__weather-card-icon-item">
                    <div>오전</div>
                    <div class="icon-aspect-${item.amIcon || 'NB01'}" data-size="28">
                      <span class="sr_only">${item.amText || ''}</span>
                    </div>
                  </div>
                `
                    : ''
                }
                ${
                  item.pmIcon
                    ? `
                  <div class="nr__weather-card-icon-item">
                    <div>오후</div>
                    <div class="icon-aspect-${item.pmIcon || 'NB01'}" data-size="28">
                      <span class="sr_only">${item.pmText || ''}</span>
                    </div>
                  </div>
                `
                    : ''
                }
              </div>
              <hr />
              <div class="nr__weather-card-temp">
                <span class="nr__weather-card-temp-max">${item.maxTemp}°</span>
                <span class="nr__weather-card-temp-min">${item.minTemp}°</span>
              </div>
            </div>
            <div class="nr__weather-card-body-btype">
              ${item.dayOfWeek}
            </div>
          </div>
        </div>
      `;
    })
    .join('');
};

/**
 * 단기/중기 일정 이벤트 바인딩
 */
const bindScheduleEvents = (container) => {
  if (!container) return;

  const pills = container.querySelectorAll('.nr__schedule-pill');
  pills.forEach((btn) => {
    btn.addEventListener('click', function () {
      selectWeatherCard(this.dataset.date, { fromScroll: false, targetType: this.dataset.type });
    });
  });

  const cards = container.querySelectorAll('.nr__weather-card');
  cards.forEach((card) => {
    card.addEventListener('click', function () {
      selectWeatherCard(this.dataset.date, { fromScroll: false, targetType: this.dataset.type });
    });
  });
};

/**
 * 상/하단 일정 행 렌더링 및 갱신 함수
 * - 단기예보 선택 시: 상단 단기예보는 카드 형태(선택된 카드 확장), 하단 중기예보는 알약으로 최소화
 * - 중기예보 선택 시: 상단 단기예보는 알약으로 최소화, 하단 중기예보는 카드 형태(선택된 카드 확장)
 */
const renderSchedules = (targetContainer) => {
  const container = targetContainer || document.getElementById('hourly-forecast-day') || document.querySelector('.nr__hourly-forecast');
  if (!container) return;

  const schedulesWrap = container.querySelector('.nr__forecast-schedules');
  if (!schedulesWrap) return;

  const isShortActive = currentForecastType === 'short';

  const shortRow = schedulesWrap.querySelector('.nr__schedule-row--short');
  const shortScroll = shortRow?.querySelector('.nr__schedule-scroll');
  const midRow = schedulesWrap.querySelector('.nr__schedule-row--mid');
  const midScroll = midRow?.querySelector('.nr__schedule-scroll');

  // 상단 단기예보 일정 행 갱신
  if (shortRow && shortScroll) {
    shortRow.classList.toggle('is-expanded', isShortActive);
    shortRow.classList.toggle('is-minimized', !isShortActive);
    shortScroll.innerHTML = isShortActive
      ? renderCardsHtml(shortTermList, currentSelectedDate, 'short')
      : renderPillsHtml(shortTermList, 'short');
  }

  // 하단 중기예보 일정 행 갱신
  if (midRow && midScroll) {
    midRow.classList.toggle('is-expanded', !isShortActive);
    midRow.classList.toggle('is-minimized', isShortActive);
    midScroll.innerHTML = !isShortActive
      ? renderCardsHtml(midTermList, currentSelectedDate, 'mid')
      : renderPillsHtml(midTermList, 'mid');
  }

  bindScheduleEvents(schedulesWrap);

  // 현재 활성 카드로 중앙 스크롤
  setTimeout(() => {
    const activeScroll = isShortActive ? shortScroll : midScroll;
    if (activeScroll && typeof activeScroll.querySelector === 'function') {
      const activeCard = activeScroll.querySelector('.nr__weather-card.active');
      if (activeCard) {
        scrollToCenter(activeScroll, activeCard, 'smooth');
      }
    }
  }, 60);
};

/**
 * 중기예보 활성 시 3시간/1시간 간격 선택 영역 표시/숨김 갱신
 * @param {'short'|'mid'} [type]
 */
export const updateIntervalVisibility = (type) => {
  const currentType = type || currentForecastType;
  const isMid = currentType === 'mid';

  const hourlySection =
    document.getElementById('section-hourly') ||
    document.querySelector('.nr__hourly-forecast')?.closest?.('section') ||
    document.querySelector('.nr__main-section-box');

  if (hourlySection && typeof hourlySection.setAttribute === 'function') {
    hourlySection.setAttribute('data-forecast-type', currentType);
    hourlySection.classList?.toggle('is-mid-term', isMid);
  }

  const intervalWrap =
    document.querySelector('#section-hourly .nr__content-type') ||
    document.querySelector('input[name="time"]')?.closest?.('.nr__content-type') ||
    document.querySelector('.nr__content-type.form-fake-group-flex') ||
    document.querySelector('.nr__hourly-interval-btns');

  if (intervalWrap && intervalWrap.style) {
    intervalWrap.style.display = isMid ? 'none' : '';
  }
};

/**
 * 단기/중기 일정 항목 선택 함수
 * - 단기/중기 중 단 하나만 선택 상태 유지
 * - 선택된 예보는 카드로 확장되어 정보가 표시되고, 선택되지 않은 예보는 알약으로 최소화
 * - 스크롤이 있을 경우 중앙 기준으로 스크롤 이동
 * - 하나의 차트에 해당 정보 갱신 및 차트 위치 중앙 정렬
 * @param {string} targetDate
 * @param {Object} [options]
 * @param {boolean} [options.fromScroll=false]
 * @param {'short'|'mid'} [options.targetType]
 */
export const selectWeatherCard = (targetDate, options = {}) => {
  const { fromScroll = false, targetType = null } = options;
  if (!targetDate) return;

  // 대상 예보 타입 결정
  let type = targetType;
  if (!type) {
    if (shortTermList.some((d) => d.date === targetDate)) type = 'short';
    else if (midTermList.some((d) => d.date === targetDate)) type = 'mid';
    else type = 'short';
  }

  const typeChanged = currentForecastType !== type;
  currentForecastType = type;
  currentSelectedDate = targetDate;

  // 중기예보 시 3시간/1시간 간격 선택 영역 숨김 처리
  updateIntervalVisibility(type);

  const hourlyContainer = document.getElementById('hourly-forecast-day') || document.querySelector('.nr__hourly-forecast');

  if (typeChanged) {
    // 단기 <-> 중기 타입이 변경된 경우: 상/하단 일정 재렌더링 및 차트 컴포넌트 재생성
    if (hourlyContainer) {
      renderSchedules(hourlyContainer);
      if (typeof hourlyContainer._renderForecastComponent === 'function') {
        hourlyContainer._renderForecastComponent();
      }
    }
  } else {
    // 같은 타입 내에서 날짜만 변경된 경우: 활성 행의 카드 active 토글
    const isShort = type === 'short';
    const activeScrollId = isShort ? 'forecast-schedule-short' : 'forecast-schedule-mid';
    const activeScroll = document.getElementById(activeScrollId);
    let activeCardEl = null;

    if (activeScroll) {
      const cards = activeScroll.querySelectorAll('.nr__weather-card');
      cards.forEach((card) => {
        if (card.dataset.date === targetDate) {
          card.classList.add('active');
          activeCardEl = card;
        } else {
          card.classList.remove('active');
        }
      });
      if (activeCardEl) {
        scrollToCenter(activeScroll, activeCardEl, 'smooth');
      }
    }
  }

  // 고정 열 날짜(오늘/내일/모레/날짜) 갱신
  updateFixedTimeCell(targetDate);

  // 사용자가 직접 클릭한 경우 차트 내 해당 날짜 시작시간이 고정 열 바로 옆에 오도록 스크롤
  if (!fromScroll) {
    scrollToHourlyDate(targetDate);
  }

  // 커스텀 이벤트 전달
  const activeItem = (globalForecastData || []).find((d) => d.date === targetDate);
  if (activeItem) {
    const detailData = {
      forecastType: type,
      date: activeItem.date,
      day: activeItem.dayOfWeek || activeItem.day,
      minTemp: activeItem.minTemp,
      maxTemp: activeItem.maxTemp,
    };
    document.dispatchEvent(new CustomEvent('weatherSelect', { detail: detailData, bubbles: true }));
  }
};

/**
 * 상단 단기예보일정, 하단 중기예보일정 분리 렌더링 초기화
 * @param {string|Element} target
 * @param {Array} data
 */
export const weekdayExe = (target, data) => {
  const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
  if (!targetEl) return;

  const limitedData = Array.isArray(data) ? data.slice(0, 10) : [];
  globalForecastData = limitedData;

  // 단기예보 / 중기예보 분리
  shortTermList = limitedData.filter((item, idx) => {
    if (item.forecastType) return item.forecastType === '단기예보';
    return idx < 3;
  });

  midTermList = limitedData.filter((item, idx) => {
    if (item.forecastType) return item.forecastType === '중기예보';
    return idx >= 3;
  });

  // 초기 선택 날짜 설정 (기본값: 단기예보 첫 날)
  if (!currentSelectedDate || !limitedData.some((d) => d.date === currentSelectedDate)) {
    const activeItem = limitedData.find((d) => d.active) || limitedData[0];
    currentSelectedDate = activeItem ? activeItem.date : null;
    currentForecastType = shortTermList.some((d) => d.date === currentSelectedDate) ? 'short' : 'mid';
  } else {
    currentForecastType = shortTermList.some((d) => d.date === currentSelectedDate) ? 'short' : 'mid';
  }

  let schedulesWrap = targetEl.querySelector('.nr__forecast-schedules');
  if (!schedulesWrap) {
    const isShortActive = currentForecastType === 'short';
    const schedulesHtml = `
      <div class="nr__forecast-schedules">
        <!-- S : 상단 단기예보일정 -->
        <div class="nr__schedule-row nr__schedule-row--short ${isShortActive ? 'is-expanded' : 'is-minimized'}">
          <div class="nr__schedule-scroll" id="forecast-schedule-short"></div>
        </div>
        <!-- E : 상단 단기예보일정 -->

        <!-- S : 하단 중기예보일정 -->
        <div class="nr__schedule-row nr__schedule-row--mid ${!isShortActive ? 'is-expanded' : 'is-minimized'}">
          <div class="nr__schedule-scroll" id="forecast-schedule-mid"></div>
        </div>
        <!-- E : 하단 중기예보일정 -->
      </div>
    `;
    targetEl.insertAdjacentHTML('beforeend', schedulesHtml);
  }

  renderSchedules(targetEl);
  updateIntervalVisibility(currentForecastType);
};

/**
 * 시간별 예보 컴포넌트 실행 함수
 * - 들어오는 정보(단기 or 중기)에 따라 하나의 차트 컨테이너에 동적으로 변경 렌더링
 * - 1번째 이미지: 단기예보 챠트 (챠트선 대신 텍스트로)
 * - 2번째 이미지: 중기예보 챠트 (하늘상태/최저최고기온/평균기온/강수가능성/변화추이)
 * - 스크롤 연동 시 중앙을 기준으로 선택 및 이동
 * @param {string|Element} target
 * @param {Array} data
 * @param {Object} [options]
 */
export const hourlyForecastExe = (target, data, options = {}) => {
  const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
  if (!targetEl) return;

  const limitedData = Array.isArray(data) ? data.slice(0, 10) : [];
  globalForecastData = limitedData;

  shortTermList = limitedData.filter((item, idx) => {
    if (item.forecastType) return item.forecastType === '단기예보';
    return idx < 3;
  });

  midTermList = limitedData.filter((item, idx) => {
    if (item.forecastType) return item.forecastType === '중기예보';
    return idx >= 3;
  });

  // 간격(3시간/1시간) 필터
  const getCurrentInterval = () => {
    const checkedTimeRadio = document.querySelector('input[name="time"]:checked');
    if (checkedTimeRadio) {
      if (checkedTimeRadio.id === 'time1' || checkedTimeRadio.value === '3') return 3;
      if (checkedTimeRadio.id === 'time2' || checkedTimeRadio.value === '1') return 1;
    }
    return 3;
  };

  const filterHours = (hours, interval) => {
    if (!hours) return [];
    if (interval === 1) return hours;
    return hours.filter((h) => {
      const num = parseInt(h.time, 10);
      return num % 3 === 0;
    });
  };

  // 차트 컴포넌트 렌더링
  const renderComponent = () => {
    const isShort = currentForecastType === 'short';
    updateIntervalVisibility(currentForecastType);
    const activeList = isShort ? shortTermList : midTermList;
    const validDates = activeList.filter((d) => d.hourly && d.hourly.length > 0);
    const interval = isShort ? getCurrentInterval() : 3;

    if (!currentSelectedDate && validDates.length > 0) {
      currentSelectedDate = validDates[0].date;
    }

    const initialDateText = getDisplayDateText(currentSelectedDate, globalForecastData);

    let fixedColHtml = '';
    let scrollViewportHtml = '';

    if (isShort) {
      // ====================================================================
      // 1번째 이미지: 단기예보 챠트 (챠트선 대신 텍스트로)
      // ====================================================================
      fixedColHtml = `
        <div class="nr__hourly-fixed-column">
          <div class="nr__fixed-row-cell nr__row-time"><span class="nr__row-time-box">${initialDateText}</span></div>
          <div class="nr__fixed-row-cell nr__row-weather">날씨</div>
          <div class="nr__fixed-row-cell nr__row-temp">기온</div>
          <div class="nr__fixed-row-cell nr__row-sensory">체감온도</div>
          <div class="nr__fixed-row-cell nr__row-precip">강수량(mm)</div>
          <div class="nr__fixed-row-cell nr__row-snow">적설량(cm)</div>
          <div class="nr__fixed-row-cell nr__row-rain-prob">강수확률</div>
          <div class="nr__fixed-row-cell nr__row-wind">바람(m/s)</div>
          <div class="nr__fixed-row-cell nr__row-humidity">습도</div>
          <div class="nr__fixed-row-cell nr__row-heat">폭염영향</div>
        </div>
      `;

      scrollViewportHtml = `
        <div class="nr__hourly-scroll-viewport">
          <div class="nr__hourly-dates-wrapper">
      `;

      validDates.forEach((dayItem) => {
        const hours = filterHours(dayItem.hourly, interval);
        const isCurrent = dayItem.date === currentSelectedDate;

        scrollViewportHtml += `
          <div class="nr__date-group" data-date="${dayItem.date}" data-type="short" data-current="${isCurrent}">
            <div class="nr__hourly-columns-row">
        `;

        hours.forEach((h) => {
          const timeText = h.time === 24 || h.time === 0 ? '00시' : (h.time < 10 ? '0' + h.time : h.time) + '시';
          const windDirVal = typeof h.windDir === 'number' ? h.windDir : getWindAngle(h.windDir);
          const windSpeedVal = Array.isArray(h.windText)
            ? (h.windText.length >= 3 ? h.windText[2] : h.windText[1])
            : (h.windSpeed ?? '0');
          const windStrengthVal = Array.isArray(h.windText) && h.windText.length >= 3 ? h.windText[1] : '약';
          const precipVal = h.precip !== undefined && h.precip !== '-' ? h.precip : (h.precip ?? '-');
          const snowVal = h.snowfall ?? h.snow ?? '-';

          scrollViewportHtml += `
            <div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}">
              <div class="nr__cell nr__row-time">${timeText}</div>
              <div class="nr__cell nr__row-weather">
                <div class="icon-aspect-${h.icon || 'NB01'}" data-size="28">
                  <span class="sr_only">${h.text || ''}</span>
                </div>
              </div>
              <div class="nr__cell nr__row-temp">${h.temp}℃</div>
              <div class="nr__cell nr__row-sensory">${h.sensoryTemp ?? h.temp}℃</div>
              <div class="nr__cell nr__row-precip">${precipVal}</div>
              <div class="nr__cell nr__row-snow">${snowVal}</div>
              <div class="nr__cell nr__row-rain-prob">${h.rainProb ?? 0}%</div>
              <div class="nr__cell nr__row-wind">
                <span class="nr__wind-arrow icon-mask-arrow-wind" style="transform: rotate(${windDirVal}deg);"></span>
                <span class="nr__wind-strength">${windStrengthVal}</span>
                <span class="nr__wind-text">${windSpeedVal}</span>
              </div>
              <div class="nr__cell nr__row-humidity">${h.humidity ?? 0}%</div>
              <div class="nr__cell nr__row-heat">${h.heatImpact || '-'}</div>
            </div>
          `;
        });

        scrollViewportHtml += `
            </div>
          </div>
        `;
      });

      scrollViewportHtml += `
          </div>
        </div>
      `;
    } else {
      // ====================================================================
      // 2번째 이미지: 중기예보 챠트
      // ====================================================================
      fixedColHtml = `
        <div class="nr__hourly-fixed-column">
          <div class="nr__fixed-row-cell nr__row-time"><span class="nr__row-time-box">${initialDateText}</span></div>
          <div class="nr__fixed-row-cell nr__row-weather">하늘상태</div>
          <div class="nr__fixed-row-cell nr__row-minmax-temp">최저/최고기온</div>
          <div class="nr__fixed-row-cell nr__row-avg-temp">평균기온</div>
          <div class="nr__fixed-row-cell nr__row-rain-possibility">강수가능성</div>
          <div class="nr__fixed-row-cell nr__row-rain-trend">강수가능성<br>변화추이</div>
        </div>
      `;

      scrollViewportHtml = `
        <div class="nr__hourly-scroll-viewport">
          <div class="nr__hourly-dates-wrapper">
      `;

      let lastHourlyItem = null;

      validDates.forEach((dayItem) => {
        const hours = filterHours(dayItem.hourly, 3);
        const isCurrent = dayItem.date === currentSelectedDate;

        scrollViewportHtml += `
          <div class="nr__date-group" data-date="${dayItem.date}" data-type="mid" data-current="${isCurrent}">
            <div class="nr__hourly-columns-row">
        `;

        hours.forEach((h, hIdx) => {
          const timeNum = parseInt(h.time, 10);
          const timeText = timeNum === 24 || timeNum === 0 ? '00시' : (timeNum < 10 ? '0' + timeNum : timeNum) + '시';

          // 최저/최고기온 표시 (09시에 최저기온 파란색, 15시에 최고기온 빨간색)
          let minMaxHtml = '';
          if (timeNum === 9 || (timeNum === 6 && !hours.some((x) => parseInt(x.time, 10) === 9))) {
            minMaxHtml = `<span class="nr__temp-val nr__temp-val--min">${dayItem.minTemp}℃</span>`;
          } else if (timeNum === 15 || (timeNum === 12 && !hours.some((x) => parseInt(x.time, 10) === 15))) {
            minMaxHtml = `<span class="nr__temp-val nr__temp-val--max">${dayItem.maxTemp}℃</span>`;
          }

          // 강수가능성
          const rainPoss = getRainPossibilityInfo(h);

          // 강수가능성 변화추이
          const prevH = hIdx > 0 ? hours[hIdx - 1] : lastHourlyItem;
          const rainTrend = getRainTrendInfo(h, prevH);
          lastHourlyItem = h;

          scrollViewportHtml += `
            <div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}">
              <div class="nr__cell nr__row-time">${timeText}</div>
              <div class="nr__cell nr__row-weather">
                <div class="icon-aspect-${h.icon || 'NB01'}" data-size="28">
                  <span class="sr_only">${h.text || ''}</span>
                </div>
              </div>
              <div class="nr__cell nr__row-minmax-temp">${minMaxHtml}</div>
              <div class="nr__cell nr__row-avg-temp nr__cell-avg-temp">${h.temp}℃</div>
              <div class="nr__cell nr__row-rain-possibility">
                <span class="nr__rain-badge is-${rainPoss.level}">${rainPoss.text}</span>
              </div>
              <div class="nr__cell nr__row-rain-trend">
                <span class="nr__trend-val is-${rainTrend.level}">${rainTrend.text}</span>
              </div>
            </div>
          `;
        });

        scrollViewportHtml += `
            </div>
          </div>
        `;
      });

      scrollViewportHtml += `
          </div>
        </div>
      `;
    }

    // 단일 차트 컨테이너에 삽입
    let containerWrap = targetEl.querySelector('.nr__hourly-forecast-container');
    if (!containerWrap) {
      targetEl.insertAdjacentHTML(
        'beforeend',
        `
        <div class="nr__hourly-forecast-container">
          <div id="hourly-forecast-content" class="nr__hourly-forecast-content"></div>
        </div>
      `,
      );
    }
    const container = targetEl.querySelector('#hourly-forecast-content');
    container.innerHTML = `
      <div class="nr__hourly-grid-container nr__forecast-view-${currentForecastType}">
        ${fixedColHtml}
        ${scrollViewportHtml}
      </div>
    `;

    // 마우스 드래그 스크롤 및 스크롤 연동 바인딩
    bindDragScroll();
    bindScrollSync();

    // 초기 또는 전환 후 선택된 날짜 중앙 스크롤
    if (currentSelectedDate) {
      scrollToHourlyDate(currentSelectedDate, 'auto');
    }
  };

  // 마우스 드래그 스크롤 바인딩
  const bindDragScroll = () => {
    const slider = document.querySelector('.nr__hourly-scroll-viewport');
    if (!slider) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    slider.addEventListener('mousedown', (e) => {
      if (e.target.closest('button, a, input, select')) return;
      isDown = true;
      slider.classList.add('grabbing');
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
      if (!isDown) return;
      isDown = false;
      slider.classList.remove('grabbing');
    });

    slider.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      slider.classList.remove('grabbing');
    });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 1.5;
      slider.scrollLeft = scrollLeft - walk;
    });
  };

  // 스크롤 연동: 중앙(Center)을 기준으로 날짜 선택 및 연동
  const bindScrollSync = () => {
    const viewport = document.querySelector('.nr__hourly-scroll-viewport');
    if (!viewport) return;

    let scrollRafId = null;

    const onViewportScroll = () => {
      if (isProgrammaticScroll) return;
      if (scrollRafId) return;

      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        syncDateFromCenterScroll();
      });
    };

    viewport.addEventListener('scroll', onViewportScroll, { passive: true });

    const unlockScroll = () => {
      isProgrammaticScroll = false;
      if (programmaticScrollTimer) {
        clearTimeout(programmaticScrollTimer);
        programmaticScrollTimer = null;
      }
    };

    viewport.addEventListener('pointerdown', unlockScroll, { passive: true });
    viewport.addEventListener('wheel', unlockScroll, { passive: true });
    viewport.addEventListener('touchstart', unlockScroll, { passive: true });
  };

  // 고정 열(nr__hourly-fixed-column) 바로 옆 기준 날짜 계산 및 연동
  const syncDateFromCenterScroll = () => {
    const viewport = document.querySelector('.nr__hourly-scroll-viewport');
    if (!viewport) return;

    const dateGroups = viewport.querySelectorAll('.nr__date-group');
    if (!dateGroups.length) return;

    // 고정 열 바로 옆(좌측 시작점) 기준 (+여유 마진)
    // 단, 스크롤이 맨 우측 끝에 도달한 경우 마지막 날짜 선택
    const isAtEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 10;
    const checkPoint = isAtEnd ? viewport.scrollWidth - 10 : viewport.scrollLeft + 30;
    let activeDate = null;

    for (let i = 0; i < dateGroups.length; i++) {
      const group = dateGroups[i];
      const start = group.offsetLeft;
      const end = start + group.offsetWidth;

      if (checkPoint >= start && checkPoint < end) {
        activeDate = group.dataset.date;
        break;
      }
    }

    if (!activeDate && dateGroups.length > 0) {
      if (checkPoint < dateGroups[0].offsetLeft) {
        activeDate = dateGroups[0].dataset.date;
      } else {
        activeDate = dateGroups[dateGroups.length - 1].dataset.date;
      }
    }

    if (activeDate && activeDate !== currentSelectedDate) {
      selectWeatherCard(activeDate, { fromScroll: true, targetType: currentForecastType });
    }
  };

  // 초기 렌더링
  renderComponent();
  targetEl._renderForecastComponent = renderComponent;

  // 간격 라디오(time1, time2) 변경 시 단기예보 갱신
  if (!targetEl._intervalEventsBound) {
    targetEl._intervalEventsBound = true;

    document.addEventListener('change', (e) => {
      const radio = e.target.closest('input[name="time"]');
      if (radio && radio.checked) {
        const hourlyTarget = document.getElementById('hourly-forecast-day') || document.querySelector('.nr__hourly-forecast') || targetEl;
        if (hourlyTarget && typeof hourlyTarget._renderForecastComponent === 'function') {
          hourlyTarget._renderForecastComponent();
          if (currentSelectedDate) {
            scrollToHourlyDate(currentSelectedDate);
          }
        }
      }
    });
  }
};

/**
 * 일별예보 컴포넌트 실행 함수 (7일치 요약 리스트)
 * @param {string|Element} [target='#section-daily']
 * @param {Array} data
 * @param {Object} [options]
 */
export const dailyForecastExe = (target = '#section-daily', data, options = {}) => {
  const targetEl = typeof target === 'string' ? document.querySelector(target) : target;
  if (!targetEl || !Array.isArray(data)) return;

  const displayData = options.limit ? data.slice(0, options.limit) : data;

  const rangeEl = targetEl.querySelector('.nr__daily-range, .nr__main-section-header span');
  if (rangeEl && displayData.length > 0) {
    const firstDate = displayData[0].date;
    const lastDate = displayData[displayData.length - 1].date;
    rangeEl.textContent = `${firstDate} ~ ${lastDate}`;
  }

  const listEl = targetEl.querySelector('.nr__daily-forecast-list');
  if (!listEl) return;

  listEl.innerHTML = displayData
    .map(
      (item) => `
    <li class="nr__daily-forecast-item">
      <div class="nr__daily-forecast-date">
        <strong class="text-14" data-text-color="theme1" data-weight="700">${item.dayOfWeek || item.day || ''}</strong>
        <span class="text-11" data-text-color="theme2" data-weight="600">${item.date}</span>
      </div>
      <div class="nr__daily-forecast-weather">
        <div class="nr__daily-forecast-weather-am">
          <span class="text-12" data-text-color="theme1" data-weight="600">${item.amRain ?? 0}%</span>
          <i class="icon-aspect-${item.amIcon || 'NB01'}" data-size="32" aria-hidden="true"></i>
        </div>
        <span class="nr__daily-forecast-slash">/</span>
        <div class="nr__daily-forecast-weather-pm">
          <i class="icon-aspect-${item.pmIcon || 'NB01'}" data-size="32" aria-hidden="true"></i>
          <span class="text-12" data-text-color="theme1" data-weight="600">${item.pmRain ?? 0}%</span>
        </div>
      </div>
      <div class="nr__daily-forecast-temp">
        <span class="text-16" data-text-color="blue" data-weight="700">${item.minTemp}°</span>
        <span class="nr__daily-forecast-slash">/</span>
        <span class="text-16" data-text-color="red" data-weight="700">${item.maxTemp}°</span>
      </div>
    </li>
  `,
    )
    .join('');
};

/**
 * 일출일몰 · 월출월몰 정보 렌더링 함수
 */
export const sunMoonExe = (target, astroData) => {
  if (!astroData) return;
  const sec = typeof target === 'string' ? document.querySelector(target) : target;
  if (!sec) return;

  const sunList = sec.querySelector('.nr__sun-moon-sun');
  if (sunList) {
    sunList.innerHTML = `
      <li class="nr__sun-moon-item">
        <i class="icon-aspect-sunup-theme" data-size="56" aria-hidden="true"></i>
        <div class="nr__sun-moon-info">
          <span class="text-14" data-text-color="theme2" data-weight="600">일출</span>
          <strong class="text-20" data-text-color="theme1" data-weight="700">${astroData.sunrise}</strong>
        </div>
      </li>
      <li class="nr__sun-moon-item">
        <i class="icon-aspect-sundown-theme" data-size="56" aria-hidden="true"></i>
        <div class="nr__sun-moon-info">
          <span class="text-14" data-text-color="theme2" data-weight="600">일몰</span>
          <strong class="text-20" data-text-color="theme1" data-weight="700">${astroData.sunset}</strong>
        </div>
      </li>
    `;
  }

  const moonList = sec.querySelector('.nr__sun-moon-moon');
  if (moonList) {
    moonList.innerHTML = `
      <li class="nr__sun-moon-item">
        <i class="icon-aspect-sunup2-theme" data-size="56" aria-hidden="true"></i>
        <span class="text-14 mt-8" data-text-color="theme2" data-weight="600">월출</span>
        <strong class="text-20 mt-4" data-text-color="theme1" data-weight="700">${astroData.moonrise}</strong>
      </li>
      <li class="nr__sun-moon-item">
        <i class="icon-aspect-${astroData.moonIcon || 'moon5'}" data-size="56" aria-hidden="true"></i>
        <span class="text-14 mt-8" data-text-color="theme2" data-weight="600">${astroData.lunarDate}</span>
        <strong class="text-18 mt-6" data-text-color="theme1" data-weight="700">${astroData.moonPhase}</strong>
      </li>
      <li class="nr__sun-moon-item">
        <i class="icon-aspect-sundown2-theme" data-size="56" aria-hidden="true"></i>
        <span class="text-14 mt-8" data-text-color="theme2" data-weight="600">월몰</span>
        <strong class="text-20 mt-4" data-text-color="theme1" data-weight="700">${astroData.moonset}</strong>
      </li>
    `;
  }

  const providerText = sec.querySelector('.nr__sun-moon p, .nr__sun-moon-provider');
  if (providerText && astroData.provider) {
    providerText.textContent = `제공 : ${astroData.provider}`;
  }
};

/**
 * 대기질 정보(초미세먼지, 미세먼지, 오존) 렌더링 함수
 */
export const airQualityExe = (target, airQualityData) => {
  if (!airQualityData) return;
  const sec = typeof target === 'string' ? document.querySelector(target) : target;
  if (!sec) return;

  const listEl = sec.querySelector('.nr__air-quality-list');
  if (listEl) {
    const renderGauge = (item, name, isFirst = false, isPpm = false) => {
      if (!item) return '';
      const isBad = item.level === 'bad' || item.level === 'very-bad';
      const strokeUrl = isBad ? 'url(#air-bar-bad)' : 'url(#air-bar-good)';
      const dotColor = isBad ? 'var(--air-bad-start)' : 'var(--air-good-start)';
      const dasharray = item.dasharray || '75 258';

      return `
        <li class="nr__air-quality-item" data-level="${isBad ? 'bad' : 'good'}">
          <div class="nr__air-quality-gauge">
            <svg class="nr__air-quality-svg" viewBox="0 0 100 100" aria-hidden="true">
              ${
                isFirst
                  ? `
              <defs>
                <linearGradient id="air-bar-good" x1="100%" y1="50%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--air-good-start)" />
                  <stop offset="100%" stop-color="var(--air-good-end)" />
                </linearGradient>
                <linearGradient id="air-bar-bad" x1="100%" y1="50%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="var(--air-bad-start)" />
                  <stop offset="100%" stop-color="var(--air-bad-end)" />
                </linearGradient>
              </defs>
              `
                  : ''
              }
              <circle class="nr__air-quality-track" cx="50" cy="50" r="41" fill="none" stroke-width="10" />
              <circle class="nr__air-quality-bar" cx="50" cy="50" r="41" fill="none" stroke-width="10"
                stroke="${strokeUrl}" stroke-linecap="round" stroke-dasharray="${dasharray}"
                transform="rotate(-90 50 50)" />
              <circle class="nr__air-quality-dot" cx="50" cy="9" r="4.5" stroke="${dotColor}"
                stroke-width="1" />
            </svg>
            <div class="nr__air-quality-val">
              <strong class="${isPpm ? 'text-20' : 'text-24'}" data-text-color="theme5" data-weight="700">${item.value}</strong>
              <span class="text-10" data-text-color="theme3" data-weight="500">${item.unit}</span>
            </div>
          </div>
          <strong class="nr__air-quality-status">${item.status}</strong>
          <span class="text-11" data-text-color="theme5" data-weight="600">${name}</span>
        </li>
      `;
    };

    listEl.innerHTML = `
      ${renderGauge(airQualityData.pm25, '초미세먼지', true, false)}
      ${renderGauge(airQualityData.pm10, '미세먼지', false, false)}
      ${renderGauge(airQualityData.o3, '오존', false, true)}
    `;
  }

  const metaText = sec.querySelector('.nr__air-quality p');
  if (metaText) {
    metaText.innerHTML = `
      제공 : ${airQualityData.provider || '한국환경공단'}<br />
      ${airQualityData.station || ''} ${airQualityData.measuredAt || ''}
    `;
  }
};

/**
 * 생활기상지수(자외선, 대기정체, 꽃가루) 렌더링 함수
 */
export const livingIndicesExe = (targets = {}, livingIndicesData, activePollenType = null) => {
  if (!livingIndicesData) return;

  const renderIndexItems = (items) => {
    if (!Array.isArray(items)) return '';
    return items
      .map(
        (item) => `
      <li class="nr__uv-index-item">
        <div class="nr__uv-index-info">
          <strong class="text-16" data-text-color="theme1" data-weight="700">${item.period}</strong>
          <span class="text-14" data-text-color="theme2" data-weight="500">${item.label}</span>
        </div>
        <span class="nr__uv-index-badge" data-level="${item.level}">${item.badge}</span>
      </li>
    `,
      )
      .join('');
  };

  // 1. 자외선지수
  const uvSelector = targets?.uv || '#section-uv';
  const uvSec = typeof uvSelector === 'string' ? document.querySelector(uvSelector) : uvSelector;
  if (uvSec && livingIndicesData.uv) {
    const list = uvSec.querySelector('.nr__uv-index-list');
    if (list) list.innerHTML = renderIndexItems(livingIndicesData.uv);
  }

  // 2. 대기정체지수
  const stagSelector = targets?.airStagnation || '#section-stagnation';
  const stagSec = typeof stagSelector === 'string' ? document.querySelector(stagSelector) : stagSelector;
  if (stagSec && livingIndicesData.airStagnation) {
    const list = stagSec.querySelector('.nr__uv-index-list');
    if (list) list.innerHTML = renderIndexItems(livingIndicesData.airStagnation);
  }

  // 3. 꽃가루농도위험지수
  const pollenSelector = targets?.pollen || '#section-pollen';
  const pollenSec = typeof pollenSelector === 'string' ? document.querySelector(pollenSelector) : pollenSelector;
  if (pollenSec && livingIndicesData.pollen) {
    const checkedRadio = pollenSec.querySelector('input[name="pollen"]:checked');
    const type = activePollenType || (checkedRadio ? checkedRadio.value : 'weeds') || 'weeds';
    const items = livingIndicesData.pollen[type] || livingIndicesData.pollen.weeds;
    const list = pollenSec.querySelector('.nr__uv-index-list');
    if (list && Array.isArray(items)) {
      list.innerHTML = renderIndexItems(items);
    }
  }
};

/**
 * 예보 UI 통합 실행 함수
 * @param {string|Element} target - 대상 DOM 엘리먼트 또는 id
 * @param {Array} data - 날씨 예보 데이터
 * @param {Object} [options]
 */
export const uiForecastExe = (target, data, options = {}) => {
  if (!data) return;
  const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
  if (!targetEl) return;

  targetEl.innerHTML = '';

  const rawList = Array.isArray(data) ? data : data.weekly?.days || data.locations?.[0]?.weekly?.days || [];
  const limitedData = rawList.slice(0, 10);
  globalForecastData = limitedData;
  if (!currentSelectedDate || !limitedData.some((d) => d.date === currentSelectedDate)) {
    currentSelectedDate = null;
  }

  // 1. 단기 / 중기 분리 일정(상단 / 하단 동적 카드 & 알약) 렌더링
  weekdayExe(targetEl, limitedData);

  // 2. 단일 차트 영역 동적 렌더링 (단기: Image 1, 중기: Image 2)
  hourlyForecastExe(targetEl, limitedData, options);

  // 3. 일별예보 섹션 갱신
  const dailySection = document.querySelector('#section-daily');
  if (dailySection) {
    dailyForecastExe(dailySection, rawList);
  }
};

export const initForecast = uiForecastExe;
