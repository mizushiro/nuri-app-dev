import { renderAllForecastCharts } from './ui-forecast-chart.js';

// 선택된 날짜 및 스크롤 동기화 상태 관리 변수
let currentSelectedDate = null;
let isProgrammaticScroll = false;
let programmaticScrollTimer = null;
let weatherSwiperInstance = null;
let globalForecastData = null;

/**
 * 날짜 데이터 인덱스에 따라 첫 번째 날은 '오늘', 그 다음은 '내일', '모레', 그 이상은 날짜를 반환
 * @param {string} targetDate - 대상 날짜 (예: '10.02')
 * @param {Array} [dataList] - 전체 예보 데이터 목록
 * @returns {string}
 */
export const getDisplayDateText = (targetDate, dataList) => {
  const list = dataList || globalForecastData;
  if (!Array.isArray(list) || !targetDate) return targetDate || '';
  const idx = list.findIndex(item => item.date === targetDate);
  if (idx === 0) return '오늘';
  if (idx === 1) return '내일';
  if (idx === 2) return '모레';
  if (idx >= 3) {
    const item = list[idx];
    return item ? (item.date || targetDate) : targetDate;
  }
  return targetDate || '';
};

/**
 * 고정 열의 시각 행 셀(.nr__fixed-row-cell.nr__row-time) 텍스트를 현재 선택된 날짜에 맞게 갱신
 * @param {string} targetDate
 * @param {Array} [dataList]
 */
export const updateFixedTimeCell = (targetDate, dataList) => {
  const fixedTimeCell = document.querySelector('.nr__hourly-fixed-column .nr__row-time');
  if (fixedTimeCell) {
    fixedTimeCell.innerHTML = `<span class="nr__row-time-box">${getDisplayDateText(targetDate, dataList || globalForecastData)}</span>`;
  }
};

/**
 * 일별 예보 카드 클릭 시 시간별 예보의 해당 날짜 위치로 스크롤 이동하는 함수
 * @param {string} targetDate - 선택한 날짜 (예: '05.24')
 */
export const scrollToHourlyDate = (targetDate) => {
  if (!targetDate) return;

  isProgrammaticScroll = true;
  clearTimeout(programmaticScrollTimer);
  programmaticScrollTimer = setTimeout(() => {
    isProgrammaticScroll = false;
  }, 600);

  // 가로 스크롤 뷰포트 이동
  const viewport = document.querySelector('.nr__hourly-scroll-viewport');
  if (viewport) {
    const targetBlock = viewport.querySelector(`.nr__date-group[data-date="${targetDate}"]`);
    if (targetBlock) {
      if ('onscrollend' in window) {
        viewport.addEventListener('scrollend', () => {
          isProgrammaticScroll = false;
        }, { once: true });
      }

      viewport.scrollTo({
        left: targetBlock.offsetLeft,
        behavior: 'smooth'
      });
    }
  }
};

/**
 * 특정 날짜의 카드를 활성화하고 상단 Swiper 및 시간별 예보를 동기화하는 함수
 * @param {string} targetDate - 선택할 날짜 (예: '05.24')
 * @param {Object} options
 * @param {boolean} options.fromScroll - 가로 스크롤에 의한 동기화 여부
 */
export const selectWeatherCard = (targetDate, options = {}) => {
  const { fromScroll = false } = options;
  if (!targetDate) return;
  if (currentSelectedDate === targetDate) return;

  currentSelectedDate = targetDate;

  // 1. Swiper 날씨 카드 active 상태 갱신
  const weatherCards = document.querySelectorAll('.nr__weather-card');
  let targetIndex = -1;
  let targetCard = null;

  weatherCards.forEach((card, idx) => {
    if (card.dataset.date === targetDate) {
      targetCard = card;
      targetIndex = idx;
      card.classList.add('active');
    } else {
      card.classList.remove('active');
    }
  });

  // date-group data-current 속성 갱신
  const dateGroups = document.querySelectorAll('.nr__date-group');
  dateGroups.forEach(group => {
    group.setAttribute('data-current', group.dataset.date === targetDate ? 'true' : 'false');
  });

  if (!targetCard) return;

  // 2. Swiper 슬라이드 위치 조정 (선택된 카드가 화면 밖으로 벗어나면 화면 안으로 이동)
  if (weatherSwiperInstance && targetIndex >= 0) {
    const swiperEl = document.querySelector('.nr__hourly-forecast-day .swiper') || document.querySelector('.nr__hourly-forecast-day');
    if (swiperEl) {
      const swiperRect = swiperEl.getBoundingClientRect();
      const cardRect = targetCard.getBoundingClientRect();

      // 카드가 화면 왼쪽으로 벗어난 경우
      if (cardRect.left < swiperRect.left + 5) {
        weatherSwiperInstance.slideTo(targetIndex);
      }
      // 카드가 화면 오른쪽으로 벗어난 경우
      else if (cardRect.right > swiperRect.right - 5) {
        const visibleSlides = Math.floor(weatherSwiperInstance.slidesPerViewDynamic?.() || weatherSwiperInstance.params.slidesPerView || 1);
        const targetSlide = Math.max(0, targetIndex - visibleSlides + 1);
        weatherSwiperInstance.slideTo(targetSlide);
      }
    }
  }

  // 3. 하단 안내 영역 업데이트
  const infoDetail = document.getElementById('selected-info-detail');
  if (infoDetail) {
    infoDetail.textContent = `${targetCard.dataset.day}(${targetCard.dataset.date}) - 오전 ${targetCard.dataset.amTemp} (강수 ${targetCard.dataset.amRain}) / 오후 ${targetCard.dataset.pmTemp} (강수 ${targetCard.dataset.pmRain})`;
  }

  // 4. 데이터 수집 및 커스텀 이벤트 전달
  const cardData = {
    day: targetCard.dataset.day,
    date: targetCard.dataset.date,
    amTemp: targetCard.dataset.amTemp,
    amRain: targetCard.dataset.amRain,
    pmTemp: targetCard.dataset.pmTemp,
    pmRain: targetCard.dataset.pmRain
  };
  console.log('[콜백 실행] 선택한 날씨 정보:', cardData);
  targetCard.dispatchEvent(new CustomEvent('weatherSelect', { detail: cardData, bubbles: true }));

  // 5. 고정 열 날짜 텍스트 갱신 (오늘/내일/모레/날짜)
  updateFixedTimeCell(targetDate);

  // 6. 카드 클릭 등 스크롤 외에서 선택한 경우 시간별 예보 스크롤 이동
  if (!fromScroll) {
    scrollToHourlyDate(targetDate);
  }
};

/**
 * Swiper 초기화 함수 및 데이터 바인딩
 * @param {Array} data - 날씨 카드 데이터 목록
 */
export const weekdayExe = (target, data) => {
  const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
  if (!targetEl) return;
  // 최대 5일치로 제한
  const limitedData = Array.isArray(data) ? data.slice(0, 5) : data;
  if (limitedData) globalForecastData = limitedData;
  // JSON 데이터를 Swiper 슬라이드 HTML 문자열로 생성하는 함수
  const weatherSlideMaker = (dataList) => {
    let result = '<div class="nr__hourly-forecast-day">';
    
    dataList.forEach((item, idx) => {
      const displayDay = idx === 0 ? '오늘' : idx === 1 ? '내일' : idx === 2 ? '모레' : (item.dayOfWeek || item.day);
      const displayDate = idx < 3 ? `${item.date} ${item.dayOfWeek}` : item.date;
      result += `
        <div class="nr__weather-card ${item.active ? 'active' : ''}" data-date="${item.date}" data-day="${displayDay}" data-am-temp="${item.amTemp}" data-am-rain="${item.amRain}" data-pm-temp="${item.pmTemp}" data-pm-rain="${item.pmRain}">
          <div class="nr__weather-card-header">
            <span class="nr__weather-card-date">${item.date}</span>
            <span class="nr__weather-card-week">${item.dayOfWeek}</span>
          </div>
          <div class="nr__weather-card-body">
            <div class="nr__weather-card-body-atype">
              <div class="nr__weather-card-icon">
                ${item.amIcon ? `
                  <div class="nr__weather-card-icon-item">
                    <div>오전</div>
                    <div class="icon-aspect-${item.amIcon || 'NB01'}" data-size="32">
                      <span class="sr_only">${item.amText || ''}</span>
                    </div>
                  </div>
                ` : ''}
                ${item.pmIcon ? `
                  <div class="nr__weather-card-icon-item">
                    <div>오후</div>
                    <div class="icon-aspect-${item.pmIcon || 'NB01'}" data-size="32">
                      <span class="sr_only">${item.pmText || ''}</span>
                    </div>
                  </div>
                ` : ''}
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
    });

    result += '</div>';

    return result;
  };

  targetEl.insertAdjacentHTML('beforeend', weatherSlideMaker(limitedData));

  // 초기 선택 날짜 설정
  const activeData = Array.isArray(limitedData) ? (limitedData.find(item => item.active) || limitedData[0]) : null;
  const initialActive = document.querySelector('.nr__weather-card.active') || document.querySelector('.nr__weather-card');
  currentSelectedDate = activeData ? activeData.date : (initialActive ? initialActive.dataset.date : null);

  // 카드 클릭 이벤트 및 콜백 바인딩
  const weatherCards = document.querySelectorAll('.nr__weather-card');
  weatherCards.forEach((card) => {
    card.addEventListener('click', function () {
      selectWeatherCard(this.dataset.date, { fromScroll: false });
    });
  });
};

/**
 * 시간별 예보 컴포넌트 실행 함수 (Mode 1: 선형 차트)
 * @param {Array} data - weather.json 데이터
 * @param {Object} options - 차트 렌더링 옵션 (options.renderTempChart 등)
 */
export const hourlyForecastExe = (target, data, options = {}) => {
  const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
  if (!targetEl) return;
  // 최대 5일치로 제한
  const limitedData = Array.isArray(data) ? data.slice(0, 5) : data;
  if (limitedData) globalForecastData = limitedData;
  // 현재 선택된 간격 가져오기 (3시간 or 1시간)
  const getCurrentInterval = () => {
    const checkedTimeRadio = document.querySelector('input[name="time"]:checked');
    if (checkedTimeRadio) {
      if (checkedTimeRadio.id === 'time1' || checkedTimeRadio.value === '3') return 3;
      if (checkedTimeRadio.id === 'time2' || checkedTimeRadio.value === '1') return 1;
    }
    const activeBtn = document.querySelector('.nr__hourly-interval-btn.active');
    if (activeBtn && activeBtn.dataset.interval) {
      return parseInt(activeBtn.dataset.interval, 10);
    }
    return 3;
  };

  const getWindAngle = (dir) => {
    if (typeof dir === 'number') return dir;
    const angles = {
      'N': 0, 'NNE': 23, 'NE': 45, 'ENE': 68,
      'E': 90, 'ESE': 113, 'SE': 135, 'SSE': 158,
      'S': 180, 'SSW': 203, 'SW': 225, 'WSW': 248,
      'W': 270, 'WNW': 293, 'NW': 315, 'NNW': 338
    };
    return angles[dir] ?? 0;
  };

  const filterHours = (hours, interval) => {
    if (!hours) return [];
    if (interval === 1) return hours;
    // 3시간 간격 필터링 (03시, 06시, 09시, 12시, 15시, 18시, 21시, 00시 등)
    return hours.filter(h => {
      const num = parseInt(h.time);
      return num % 3 === 0;
    });
  };

  const renderComponent = () => {
    const currentInterval = getCurrentInterval();
    // hourly 데이터가 존재하는 날짜 항목만 사용 (최대 5일치로 제한)
    const validDates = limitedData.filter(d => d.hourly && d.hourly.length > 0).slice(0, 5);
    if (!currentSelectedDate && validDates.length > 0) {
      const activeItem = validDates.find(d => d.active) || validDates[0];
      currentSelectedDate = activeItem.date;
    }

    const initialDateText = getDisplayDateText(currentSelectedDate, validDates);

    const fixedColHtml = `
      <div class="nr__hourly-fixed-column">
        <div class="nr__fixed-header-cell"></div>
        <div class="nr__fixed-row-cell nr__row-time"><span class="nr__row-time-box">${initialDateText}</span></div>
        <div class="nr__fixed-row-cell nr__row-weather">날씨</div>
        <div class="nr__fixed-row-cell nr__row-temp-chart">기온</div>
        <div class="nr__fixed-row-cell nr__row-sensory">체감온도</div>
        <div class="nr__fixed-row-cell nr__row-precip">강수량</div>
        <div class="nr__fixed-row-cell nr__row-rain-prob">강수확률</div>
        <div class="nr__fixed-row-cell nr__row-wind">바람</div>
        <div class="nr__fixed-row-cell nr__row-humidity">습도</div>
        <div class="nr__fixed-row-cell nr__row-heat">폭염영향</div>
      </div>
    `;

    const chartLayersHtml = `
      <div class="nr__hourly-chart-layer nr__temp-chart-layer" id="hourly-temp-chart-layer"></div>
    `;

    let scrollViewportHtml = `
      <div class="nr__hourly-scroll-viewport">
        <div class="nr__hourly-dates-wrapper">
          ${chartLayersHtml}
    `;

    validDates.forEach((dayItem, dayIndex) => {
      const isLastDate = (dayIndex === validDates.length - 1);
      const hours = filterHours(dayItem.hourly, currentInterval);
      const isCurrent = currentSelectedDate ? (dayItem.date === currentSelectedDate) : (dayIndex === 0);
      scrollViewportHtml += `
        <div class="nr__date-group" data-date="${dayItem.date}" data-length="${hours.length}" data-current="${isCurrent}">
          <div class="nr__hourly-columns-row">
      `;

      hours.forEach(h => {
        const numericTemp = parseInt(h.temp) || 0;
        const rainProbVal = parseInt(h.rainProb) || 0;
        const windDirVal = typeof h.windDir === 'number' ? h.windDir : getWindAngle(h.windDir);
        const windSpeedVal = Array.isArray(h.windText) ? (h.windText.length >= 3 ? h.windText[2] : h.windText[1]) : (h.windSpeed ?? '0');
        const windStrengthVal = Array.isArray(h.windText) && h.windText.length >= 3 ? h.windText[1] : '약';
        const humidityVal = parseInt(h.humidity) || 0;

        scrollViewportHtml += `
          <div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}" data-temp="${numericTemp}" data-rain-prob="${rainProbVal}" data-wind-dir="${windDirVal}" data-wind-speed="${windSpeedVal}" data-wind-strength="${windStrengthVal}" data-humidity="${humidityVal}">
            <div class="nr__cell nr__row-time nr__cell-time">
              <span class="sr_only">시각</span>
              ${h.time < 10 ? '0' + h.time : h.time}시
            </div>
            <div class="nr__cell nr__row-weather nr__cell-weather">
              <span class="sr_only">날씨</span>
              <div class="icon-aspect-${h.icon}" data-size="28">
                <span class="sr_only">${h.text}</span>
              </div>
            </div>
            <div class="nr__cell nr__row-temp-chart nr__cell-temp-chart">
              <span class="sr_only">기온 ${h.temp}°C</span>
            </div>
            <div class="nr__cell nr__row-sensory nr__cell-sensory">
              <span class="sr_only">체감기온</span>
              <div class="nr__cell-sensory-value">${h.sensoryTemp}°C</div>
            </div>
            <div class="nr__cell nr__row-precip nr__cell-precip">
              <span class="sr_only">강수량</span>
              <div class="nr__cell-precip-value">${h.precip}</div>
            </div>
            <div class="nr__cell nr__row-rain-prob nr__cell-rain-prob">
              <span class="sr_only">강수확률</span>
              <div class="nr__cell-rain-prob-value">${h.rainProb}%</div>
            </div>
            <div class="nr__cell nr__row-wind nr__cell-wind">
              <span class="sr_only">${Array.isArray(h.windText) ? `${h.windText[0]} ${h.windText.length >= 3 ? h.windText[1] + ' ' : ''}${h.windText.length >= 3 ? h.windText[2] : h.windText[1]}m/s` : '풍향 및 풍속'}</span>
              <span class="nr__wind-arrow icon-mask-arrow-wind" style="transform: rotate(${windDirVal}deg);"></span>
              <span class="nr__wind-strength">${windStrengthVal}</span>
              <span class="nr__wind-text">${windSpeedVal}</span>
            </div>
            <div class="nr__cell nr__row-humidity nr__cell-humidity">
              <span class="sr_only">습도</span>
              ${h.humidity}%
            </div>
            <div class="nr__cell nr__row-heat nr__cell-heat">
              <span class="sr_only">폭염영향</span>
              ${h.heatImpact || '-'}
            </div>
          </div>
        `;
      });

      if (isLastDate) {
        scrollViewportHtml += `
          <div class="nr__hourly-col nr__empty-col">
            <div class="nr__cell nr__row-time nr__cell-time"></div>
            <div class="nr__cell nr__row-weather nr__cell-weather"></div>
            <div class="nr__cell nr__row-temp-chart nr__cell-temp-chart"></div>
            <div class="nr__cell nr__row-sensory nr__cell-sensory"><div class="nr__cell-sensory-value"></div></div>
            <div class="nr__cell nr__row-precip nr__cell-precip"><div class="nr__cell-precip-value"></div></div>
            <div class="nr__cell nr__row-rain-prob nr__cell-rain-prob"><div class="nr__cell-rain-prob-value"></div></div>
            <div class="nr__cell nr__row-wind nr__cell-wind"></div>
            <div class="nr__cell nr__row-humidity nr__cell-humidity"></div>
            <div class="nr__cell nr__row-heat nr__cell-heat"></div>
          </div>
        `;
      }

      scrollViewportHtml += `
          </div>
        </div>
      `;
    });

    scrollViewportHtml += `
        </div>
      </div>
    `;

    let containerWrap = targetEl.querySelector('.nr__hourly-forecast-container');
    if (!containerWrap) {
      targetEl.insertAdjacentHTML('beforeend', `
        <div class="nr__hourly-forecast-container">
          <div id="hourly-forecast-content" class="nr__hourly-forecast-content"></div>
        </div>
      `);
    }
    const container = targetEl.querySelector('#hourly-forecast-content');
    container.innerHTML = `
      <div class="nr__hourly-grid-container nr__mode-line-chart">
        ${fixedColHtml}
        ${scrollViewportHtml}
      </div>
    `;

    // 차트 레이어 렌더링 (기온 선형 차트)
    renderAllForecastCharts(container, validDates, options);

    // 드래그 스크롤 이벤트 바인딩
    bindDragScroll();
    // 가로 스크롤 시 상단 스와이퍼 날짜 연동 바인딩
    bindScrollSync();
  };

  // 마우스 드래그 스크롤 바인딩 함수
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

  // 가로 스크롤 시 상단 Swiper 날짜 연동 바인딩
  const bindScrollSync = () => {
    const viewport = document.querySelector('.nr__hourly-scroll-viewport');
    if (!viewport) return;

    let scrollRafId = null;

    const onViewportScroll = () => {
      if (isProgrammaticScroll) return;
      if (scrollRafId) return;

      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = null;
        syncDateFromScroll();
      });
    };

    viewport.addEventListener('scroll', onViewportScroll, { passive: true });

    // 사용자의 직접적인 마우스 클릭/드래그/터치/휠 입력 시 프로그래밍 스크롤 잠금 해제
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

  // 현재 가로 스크롤 위치를 기준으로 활성화할 날짜 계산 및 연동
  const syncDateFromScroll = () => {
    const viewport = document.querySelector('.nr__hourly-scroll-viewport');
    if (!viewport) return;

    const dateGroups = viewport.querySelectorAll('.nr__date-group');
    if (!dateGroups.length) return;

    const scrollLeft = viewport.scrollLeft;
    const checkOffset = 24;
    const checkPos = scrollLeft + checkOffset;

    let activeDate = null;

    for (let i = 0; i < dateGroups.length; i++) {
      const group = dateGroups[i];
      const start = group.offsetLeft;
      const end = start + group.offsetWidth;

      if (checkPos >= start && checkPos < end) {
        activeDate = group.dataset.date;
        break;
      }
    }

    // 스크롤 끝에 도달했을 때 마지막 날짜 처리
    const isScrolledToEnd = Math.ceil(scrollLeft + viewport.clientWidth) >= viewport.scrollWidth - 10;
    if (isScrolledToEnd) {
      activeDate = dateGroups[dateGroups.length - 1].dataset.date;
    }

    if (activeDate) {
      selectWeatherCard(activeDate, { fromScroll: true });
    }
  };

  // 초기 렌더링
  renderComponent();

  // 현재 렌더 함수 참조 저장
  targetEl._renderForecastComponent = renderComponent;

  // 간격 라디오(time1, time2) 이벤트 바인딩 (글로벌 이벤트 위임 처리)
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

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.nr__hourly-interval-btn');
      if (btn) {
        document.querySelectorAll('.nr__hourly-interval-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
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
 * 일별예보 컴포넌트 실행 함수 (JSON 데이터 기반 동적 렌더링)
 * @param {string|Element} [target='#section-daily'] - 대상 DOM 요소 또는 셀렉터
 * @param {Array} data - 날씨 예보 데이터 목록
 * @param {Object} [options]
 * @param {number} [options.limit] - 최대 표시 일수 (선택 사항)
 */
export const dailyForecastExe = (target = '#section-daily', data, options = {}) => {
  const targetEl = typeof target === 'string' ? document.querySelector(target) : target;
  if (!targetEl || !Array.isArray(data)) return;

  const displayData = options.limit ? data.slice(0, options.limit) : data;

  // 상단 날짜 범위 텍스트 갱신 (예: 9.27 ~ 10.3)
  const rangeEl = targetEl.querySelector('.nr__daily-range, .nr__main-section-header span');
  if (rangeEl && displayData.length > 0) {
    const firstDate = displayData[0].date;
    const lastDate = displayData[displayData.length - 1].date;
    rangeEl.textContent = `${firstDate} ~ ${lastDate}`;
  }

  const listEl = targetEl.querySelector('.nr__daily-forecast-list');
  if (!listEl) return;

  listEl.innerHTML = displayData.map((item) => `
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
  `).join('');
};

/**
 * 일출일몰 · 월출월몰 정보 렌더링 함수
 * @param {string|Element} target - 대상 섹션 셀렉터 또는 엘리먼트 (기본: '#section-sun-moon')
 * @param {Object} astroData - 천문/일출몰/월출몰/달모양/음력 데이터
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
 * @param {string|Element} target - 대상 섹션 셀렉터 또는 엘리먼트 (기본: '#section-air')
 * @param {Object} airQualityData - 대기질 측정 데이터
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
              ${isFirst ? `
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
              ` : ''}
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
 * @param {Object} targets - 각 지수 섹션의 셀렉터 또는 엘리먼트 맵 { uv, airStagnation, pollen }
 * @param {Object} livingIndicesData - 생활기상지수 데이터
 * @param {string} [activePollenType=null] - 꽃가루 활성 탭 키 ('weeds' | 'oak' | 'pine' | 'cypress')
 */
export const livingIndicesExe = (targets = {}, livingIndicesData, activePollenType = null) => {
  if (!livingIndicesData) return;

  const renderIndexItems = (items) => {
    if (!Array.isArray(items)) return '';
    return items.map(item => `
      <li class="nr__uv-index-item">
        <div class="nr__uv-index-info">
          <strong class="text-16" data-text-color="theme1" data-weight="700">${item.period}</strong>
          <span class="text-14" data-text-color="theme2" data-weight="500">${item.label}</span>
        </div>
        <span class="nr__uv-index-badge" data-level="${item.level}">${item.badge}</span>
      </li>
    `).join('');
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
 * 외부에서 불러온 데이터를 전달받아 내부에서 일별(Swiper), 시간별 예보 및 일별예보 목록을 분기 실행합니다.
 * @param {string|Element} target - 대상 DOM 엘리먼트 또는 id
 * @param {Array} data - 날씨 예보 데이터
 * @param {Object} [options] - 차트 렌더링 및 UI 옵션 객체
 */
export const uiForecastExe = (target, data, options = {}) => {
  if (!data) return;
  const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
  if (!targetEl) return;

  targetEl.innerHTML = '';
  // 배열이거나 루트 weather.json 객체인 경우 모두 지원 및 최대 5일치로 제한
  const rawList = Array.isArray(data)
    ? data
    : (data.weekly?.days || data.locations?.[0]?.weekly?.days || []);
  const limitedData = rawList.slice(0, 5);
  globalForecastData = limitedData;
  currentSelectedDate = null;

  weekdayExe(targetEl, limitedData);
  hourlyForecastExe(targetEl, limitedData, options);

  // 일별예보(#section-daily) 섹션이 DOM에 존재하면 7일치 주간 예보 전체 렌더링
  const dailySection = document.querySelector('#section-daily');
  if (dailySection) {
    dailyForecastExe(dailySection, rawList);
  }
};

export const initForecast = uiForecastExe;

