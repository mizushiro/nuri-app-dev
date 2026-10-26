// ==========================================================================
// UI Forecast Unified Module (ui-forecast.js)
// - nuri-web & nuri-app 통합 컴포넌트
// - 상단 일정 선택기(방법 B 분기):
//   * nuri-web: Swiper 카드 슬라이더 (weatherSwiperExe) + 단기/중기 탭 버튼
//   * nuri-app: 상단 단기예보 / 하단 중기예보 분리형 카드 & 알약(Pill) (weekdayExe)
// - 하단 시간별 예보 그리드 및 차트(통합):
//   * nuri-web 최종버전 기준 Mode 1(선형 차트) / Mode 2(막대 차트) / Mode 3(리스트/표)
//   * 다크모드 및 지역 변경 시 전체 예보/차트 동적 재렌더링 지원
// ==========================================================================

import { renderAllForecastCharts } from './ui-forecast-chart.js';
import { initDropdown } from './ui-dropdown.js';

// 선택된 날짜 및 스크롤 동기화 상태 관리 변수
let currentSelectedDate = null;
let currentForecastTab = 'short'; // 'short': 단기예보, 'mid': 중기예보
let currentForecastType = 'short'; // currentForecastTab과 동기화
let currentInterval = 1; // 1: 1시간 간격, 3: 3시간 간격
let currentViewMode = 'mode3'; // 'mode1': 선형 차트, 'mode2': 막대 차트, 'mode3': 리스트 (표 형태 기본값)
let isProgrammaticScroll = false;
let programmaticScrollTimer = null;
let weatherSwiperInstance = null;
let settingsDropdownInstance = null;
let rawWeatherData = null;
let globalForecastData = null;
let shortTermList = [];
let midTermList = [];
let tabSwitcherFn = null;
let renderComponentFn = null;
let staticEventsBound = false;

// 임시 테스트 컨트롤러 오버라이드 상태 관리 객체
const testOverrides = {
	zeroPrecip: false,
	zeroSnow: false,
	zeroRainIntensity: false,
	zeroSnowIntensity: false
};

/**
 * 풍향 각도 계산 헬퍼
 */
export const getWindAngle = (dir) => {
	if (typeof dir === 'number') return dir;
	const angles = {
		'N': 0, 'NNE': 23, 'NE': 45, 'ENE': 68,
		'E': 90, 'ESE': 113, 'SE': 135, 'SSE': 158,
		'S': 180, 'SSW': 203, 'SW': 225, 'WSW': 248,
		'W': 270, 'WNW': 293, 'NW': 315, 'NNW': 338
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
	if (h.rainTrend && h.trendText) {
		const text = h.trendText;
		const code = h.rainTrend;
		const level = code === 'up' ? 'high' : (code === 'down' ? 'low' : 'same');
		return { text, level, code };
	}
	if (h.rainTrend && (h.rainTrend === '높음' || h.rainTrend === '낮음' || h.rainTrend === '비슷')) {
		const text = h.rainTrend;
		const level = text === '높음' ? 'high' : (text === '낮음' ? 'low' : 'same');
		const code = text === '높음' ? 'up' : (text === '낮음' ? 'down' : 'flat');
		return { text, level, code };
	}
	if (!prevH) {
		const prob = parseInt(h.rainProb, 10) || 0;
		if (prob >= 60) return { text: '높음', level: 'high', code: 'up' };
		if (prob <= 20) return { text: '낮음', level: 'low', code: 'down' };
		return { text: '비슷', level: 'same', code: 'flat' };
	}
	const currProb = parseInt(h.rainProb, 10) || 0;
	const prevProb = parseInt(prevH.rainProb, 10) || 0;
	const diff = currProb - prevProb;
	if (diff > 0) return { text: '높음', level: 'high', code: 'up' };
	if (diff < 0) return { text: '낮음', level: 'low', code: 'down' };
	return { text: '비슷', level: 'same', code: 'flat' };
};

/**
 * nuri-web / nuri-app 데이터 포맷 정규화 함수
 * - nuri-web의 포맷(문자열 단위 포함)은 원본 그대로 100% 보존
 * - nuri-app의 숫자형 데이터 및 24시간 중기예보 데이터를 nuri-web 규격과 호환되도록 정규화
 * @param {Array|Object} rawInput
 * @returns {Array}
 */
export const normalizeForecastData = (rawInput) => {
	if (!rawInput) return [];
	const rawList = Array.isArray(rawInput)
		? rawInput
		: (rawInput.weekly?.days || rawInput.locations?.[0]?.weekly?.days || []);
	if (!Array.isArray(rawList)) return [];

	// 이미 nuri-web 포맷(예: time이 '20시' 형태의 문자열이고 minTemp에 '°C'가 포함된 경우)이면 원본 그대로 반환
	const firstDay = rawList[0];
	if (
		firstDay &&
		typeof firstDay.minTemp === 'string' &&
		firstDay.minTemp.includes('°') &&
		firstDay.hourly?.[0] &&
		typeof firstDay.hourly[0].time === 'string' &&
		firstDay.hourly[0].time.includes('시')
	) {
		return rawList;
	}

	let prevMidHour = null;

	return rawList.map((day, dayIdx) => {
		const forecastType = day.forecastType || (dayIdx < 3 ? '단기예보' : '중기예보');
		const isMid = forecastType === '중기예보';

		const minTempNum = typeof day.minTemp === 'number' ? day.minTemp : parseFloat(String(day.minTemp ?? '').replace(/[^0-9.-]/g, ''));
		const maxTempNum = typeof day.maxTemp === 'number' ? day.maxTemp : parseFloat(String(day.maxTemp ?? '').replace(/[^0-9.-]/g, ''));

		const formatTempStr = (val) => {
			if (val === undefined || val === null || val === '') return '-';
			const s = String(val).trim();
			if (s.includes('°')) return s;
			return `${s}°C`;
		};

		const formatPctStr = (val) => {
			if (val === undefined || val === null || val === '') return '0%';
			const s = String(val).trim();
			if (s.includes('%')) return s;
			return `${s}%`;
		};

		let sourceHours = Array.isArray(day.hourly) ? day.hourly : [];
		// nuri-app 중기예보의 경우 1~24시 전체가 들어있으면 3시간 간격(03시~00시)으로 추출
		if (isMid && sourceHours.length > 8) {
			sourceHours = sourceHours.filter((h) => {
				const num = parseInt(h.time, 10);
				return !isNaN(num) && num % 3 === 0;
			});
		}

		// 중기예보 최저/최고 시점 판별 (기존에 지정된 isMin/isMax가 없을 때)
		const hasExplicitMinMax = sourceHours.some((h) => h.isMin !== undefined || h.isMax !== undefined);
		const hasHour9 = sourceHours.some((h) => parseInt(h.time, 10) === 9);
		const hasHour15 = sourceHours.some((h) => parseInt(h.time, 10) === 15);

		const normalizedHours = sourceHours.map((h) => {
			const timeNum = parseInt(h.time, 10);
			let timeStr = String(h.time ?? '');
			if (!timeStr.includes('시') && !isNaN(timeNum)) {
				timeStr = (timeNum === 24 || timeNum === 0)
					? '00시'
					: `${timeNum < 10 ? '0' + timeNum : timeNum}시`;
			}

			const tempNum = typeof h.temp === 'number' ? h.temp : parseFloat(String(h.temp ?? '').replace(/[^0-9.-]/g, ''));
			const tempStr = formatTempStr(h.temp);
			const sensoryStr = h.sensoryTemp !== undefined && h.sensoryTemp !== null
				? formatTempStr(h.sensoryTemp)
				: tempStr;
			const rainProbStr = formatPctStr(h.rainProb);
			const humidityStr = formatPctStr(h.humidity);
			const snowStr = h.snow !== undefined
				? String(h.snow)
				: (h.snowfall !== undefined && h.snowfall !== null ? String(h.snowfall) : '-');
			const precipStr = h.precip !== undefined && h.precip !== null ? String(h.precip) : '-';

			if (isMid) {
				let isMin = Boolean(h.isMin);
				let isMax = Boolean(h.isMax);
				if (!hasExplicitMinMax) {
					if (timeNum === 9 || (timeNum === 6 && !hasHour9)) isMin = true;
					else if (timeNum === 15 || (timeNum === 12 && !hasHour15)) isMax = true;
				}
				const minVal = h.minVal !== undefined ? h.minVal : (isMin ? (!isNaN(minTempNum) ? minTempNum : tempNum) : null);
				const maxVal = h.maxVal !== undefined ? h.maxVal : (isMax ? (!isNaN(maxTempNum) ? maxTempNum : tempNum) : null);

				const possInfo = getRainPossibilityInfo(h);
				const trendInfo = getRainTrendInfo(h, prevMidHour);
				prevMidHour = h;

				const baseTemp = isMin && minVal !== null ? minVal : (isMax && maxVal !== null ? maxVal : (!isNaN(tempNum) ? tempNum : 20));
				const percentiles = h.percentiles || {
					p10: baseTemp - 3,
					p25: baseTemp - 1,
					p75: baseTemp + 1,
					p90: baseTemp + 3
				};

				return {
					...h,
					time: timeStr,
					temp: isMin && minVal !== null ? `${minVal}°C` : (isMax && maxVal !== null ? `${maxVal}°C` : tempStr),
					sensoryTemp: sensoryStr,
					rainProb: rainProbStr,
					humidity: humidityStr,
					snow: snowStr,
					precip: precipStr,
					isMin,
					minVal,
					isMax,
					maxVal,
					rainPossibility: h.rainPossibility || possInfo.text,
					rainTrend: (h.rainTrend === 'up' || h.rainTrend === 'down' || h.rainTrend === 'flat') ? h.rainTrend : trendInfo.code,
					trendText: h.trendText || trendInfo.text,
					percentiles
				};
			}

			return {
				...h,
				time: timeStr,
				temp: tempStr,
				sensoryTemp: sensoryStr,
				rainProb: rainProbStr,
				humidity: humidityStr,
				snow: snowStr,
				precip: precipStr
			};
		});

		return {
			...day,
			forecastType,
			minTemp: formatTempStr(day.minTemp),
			maxTemp: formatTempStr(day.maxTemp),
			amTemp: day.amTemp !== undefined ? formatTempStr(day.amTemp) : formatTempStr(day.minTemp),
			pmTemp: day.pmTemp !== undefined ? formatTempStr(day.pmTemp) : formatTempStr(day.maxTemp),
			amRain: formatPctStr(day.amRain),
			pmRain: formatPctStr(day.pmRain),
			hourly: normalizedHours
		};
	});
};

/**
 * 날짜 텍스트 (오늘, 내일, 모레, 날짜)
 */
export const getDisplayDateText = (targetDate, dataList) => {
	const list = dataList || globalForecastData || rawWeatherData;
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
 * 고정 열 시각 셀(.nr__row-time) 갱신 (첫날짜: 오늘, 두번째: 내일, 세번째: 모레, 그 이후: 날짜)
 */
export const updateFixedTimeCell = (targetDate, dataList) => {
	const text = getDisplayDateText(targetDate, dataList || globalForecastData || rawWeatherData);
	if (!text) return;
	const fixedTimeCells = document.querySelectorAll('.nr__hourly-fixed-column .nr__row-time span');
	fixedTimeCells.forEach(cell => {
		const fixedTimeBox = cell.querySelector('.nr__row-time-box');
		if (fixedTimeBox) {
			fixedTimeBox.textContent = text;
		} else {
			cell.textContent = text;
		}
	});
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
		behavior
	});
};

/**
 * 일별 예보 카드 클릭 시 시간별 예보의 해당 날짜 위치로 스크롤 이동하는 함수
 * @param {string} targetDate - 선택한 날짜 (예: '05.24')
 * @param {'smooth'|'auto'} [behavior='smooth']
 */
export const scrollToHourlyDate = (targetDate, behavior = 'smooth') => {
	if (!targetDate) return;

	updateFixedTimeCell(targetDate);

	isProgrammaticScroll = true;
	clearTimeout(programmaticScrollTimer);
	programmaticScrollTimer = setTimeout(() => {
		isProgrammaticScroll = false;
	}, 600);

	// Mode 1, Mode 2 & Mode 3: 가로 스크롤 뷰포트 이동
	const viewport = document.querySelector('.nr__hourly-scroll-viewport');
	if (viewport) {
		const targetBlock = viewport.querySelector(`.nr__date-group[data-date="${targetDate}"], .nr__list-date-block[data-date="${targetDate}"]`);
		if (targetBlock) {
			if ('onscrollend' in window) {
				viewport.addEventListener('scrollend', () => {
					isProgrammaticScroll = false;
				}, { once: true });
			}

			viewport.scrollTo({
				left: Math.max(0, targetBlock.offsetLeft),
				behavior
			});
		}
	}
};

/**
 * 알약(Pill) HTML 렌더러 (nuri-app 최소화된 일정 행)
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
 * 상세 카드 HTML 렌더러 (nuri-app 확장된 일정 행)
 */
const renderCardsHtml = (list, selectedDate, type) => {
	return list
		.map((item) => {
			const isActive = item.date === selectedDate;
			const maxTempClean = String(item.maxTemp ?? '').replace(/°C?$/i, '');
			const minTempClean = String(item.minTemp ?? '').replace(/°C?$/i, '');
			return `
				<div class="nr__weather-card ${isActive ? 'active' : ''}" data-date="${item.date}" data-type="${type}" data-day="${item.dayOfWeek || item.day || ''}" data-forecast-type="${item.forecastType || (type === 'mid' ? '중기예보' : '단기예보')}" data-am-temp="${item.amTemp || ''}" data-am-rain="${item.amRain || ''}" data-pm-temp="${item.pmTemp || ''}" data-pm-rain="${item.pmRain || ''}">
					<div class="nr__weather-card-header">
						<span class="nr__weather-card-date">${item.date}</span>
						<span class="nr__weather-card-week">${item.dayOfWeek || item.day || ''}</span>
					</div>
					<div class="nr__weather-card-body">
						<div class="nr__weather-card-body-atype">
							<div class="nr__weather-card-icon">
								${
									item.amIcon
										? `
									<div class="nr__weather-card-icon-item">
										<div>오전</div>
										<div class="icon-aspect-${item.amIcon || 'NB01'}" data-icon-weather="${item.amIcon || 'NB01'}" data-size="28">
											<span class="sr_only sr-only">${item.amText || ''}</span>
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
										<div class="icon-aspect-${item.pmIcon || 'NB01'}" data-icon-weather="${item.pmIcon || 'NB01'}" data-size="28">
											<span class="sr_only sr-only">${item.pmText || ''}</span>
										</div>
									</div>
								`
										: ''
								}
							</div>
							<hr />
							<div class="nr__weather-card-temp">
								<span class="nr__weather-card-temp-max">${maxTempClean}°</span>
								<span class="nr__weather-card-temp-min">${minTempClean}°</span>
							</div>
						</div>
						<div class="nr__weather-card-body-btype">
							${item.dayOfWeek || item.day || ''}
						</div>
					</div>
				</div>
			`;
		})
		.join('');
};

/**
 * 단기/중기 일정 이벤트 바인딩 (nuri-app)
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
 * 상/하단 일정 행 렌더링 및 갱신 함수 (nuri-app)
 */
const renderSchedules = (targetContainer) => {
	const container = targetContainer || document.getElementById('hourly-forecast-day') || document.querySelector('.nr__hourly-forecast');
	if (!container) return;

	const schedulesWrap = container.querySelector('.nr__forecast-schedules');
	if (!schedulesWrap) return;

	const isShortActive = currentForecastTab === 'short';

	const shortRow = schedulesWrap.querySelector('.nr__schedule-row--short');
	const shortScroll = shortRow?.querySelector('.nr__schedule-scroll');
	const midRow = schedulesWrap.querySelector('.nr__schedule-row--mid');
	const midScroll = midRow?.querySelector('.nr__schedule-scroll');

	if (shortRow && shortScroll) {
		shortRow.classList.toggle('is-expanded', isShortActive);
		shortRow.classList.toggle('is-minimized', !isShortActive);
		shortScroll.innerHTML = isShortActive
			? renderCardsHtml(shortTermList, currentSelectedDate, 'short')
			: renderPillsHtml(shortTermList, 'short');
	}

	if (midRow && midScroll) {
		midRow.classList.toggle('is-expanded', !isShortActive);
		midRow.classList.toggle('is-minimized', isShortActive);
		midScroll.innerHTML = !isShortActive
			? renderCardsHtml(midTermList, currentSelectedDate, 'mid')
			: renderPillsHtml(midTermList, 'mid');
	}

	bindScheduleEvents(schedulesWrap);

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
	const currentType = type || currentForecastTab;
	const isMid = currentType === 'mid';

	const hourlySection =
		document.getElementById('section-hourly') ||
		document.querySelector('.nr__hourly-forecast')?.closest?.('section') ||
		document.querySelector('.nr__main-section-box');

	if (hourlySection && typeof hourlySection.setAttribute === 'function') {
		hourlySection.setAttribute('data-forecast-type', currentType);
		hourlySection.classList?.toggle('is-mid-term', isMid);
	}

	const intervalRadioGroup = document.getElementById('hourly-interval-radios');
	if (intervalRadioGroup) {
		intervalRadioGroup.style.display = isMid ? 'none' : 'flex';
	}

	const appIntervalWrap =
		document.querySelector('#section-hourly .nr__content-type') ||
		document.querySelector('input[name="time"]')?.closest?.('.nr__content-type');
	if (appIntervalWrap && appIntervalWrap.style) {
		appIntervalWrap.style.display = isMid ? 'none' : '';
	}
};

/**
 * 특정 날짜의 카드를 활성화하고 상단(Swiper 또는 2단 일정 행) 및 시간별 예보를 동기화하는 함수
 * @param {string} targetDate - 선택할 날짜 (예: '05.24')
 * @param {Object} options
 * @param {boolean} options.fromScroll - 가로 스크롤에 의한 동기화 여부
 * @param {boolean} options.skipTabSwitch - 탭 전환 여부 스킵
 * @param {'short'|'mid'} [options.targetType] - 대상 예보 타입 (nuri-app 호환)
 */
export const selectWeatherCard = (targetDate, options = {}) => {
	const { fromScroll = false, skipTabSwitch = false, targetType = null } = options;
	if (!targetDate) return;

	const dataList = rawWeatherData || globalForecastData || [];

	// 단기/중기에 해당하는 날짜를 클릭하면 시간별예보 탭 자동 전환
	if (!skipTabSwitch && !fromScroll && tabSwitcherFn && dataList.length > 0) {
		let targetTab = targetType;
		if (!targetTab) {
			const foundItem = dataList.find(d => d.date === targetDate);
			if (foundItem && foundItem.forecastType) {
				targetTab = (foundItem.forecastType === '중기예보') ? 'mid' : 'short';
			} else if (shortTermList.some(d => d.date === targetDate)) {
				targetTab = 'short';
			} else if (midTermList.some(d => d.date === targetDate)) {
				targetTab = 'mid';
			}
		}
		if (targetTab && currentForecastTab !== targetTab) {
			tabSwitcherFn(targetTab, targetDate);
			return;
		}
	}

	currentSelectedDate = targetDate;

	// 1. 날씨 카드 active 상태 갱신 (nuri-web Swiper & nuri-app Schedule 공통)
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

	// date-group 및 list-date-block data-current 속성 갱신
	const dateGroups = document.querySelectorAll('.nr__date-group, .nr__list-date-block');
	dateGroups.forEach(group => {
		group.setAttribute('data-current', group.dataset.date === targetDate ? 'true' : 'false');
	});

	// nuri-app: 활성 일정 스크롤 영역 중앙 정렬
	const schedulesWrap = document.querySelector('.nr__forecast-schedules');
	if (schedulesWrap && targetCard) {
		const activeScroll = targetCard.closest('.nr__schedule-scroll');
		if (activeScroll) {
			scrollToCenter(activeScroll, targetCard, 'smooth');
		}
	}

	updateFixedTimeCell(targetDate);

	if (!targetCard) return;

	// 2. Swiper 슬라이드 위치 조정 (nuri-web: 선택된 카드가 화면 밖으로 벗어나면 화면 안으로 이동)
	if (weatherSwiperInstance && targetIndex >= 0) {
		const swiperEl = document.querySelector('.nr__weather-swiper');
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

	// 3. 하단 안내 영역 업데이트 (nuri-web)
	const infoDetail = document.getElementById('selected-info-detail');
	if (infoDetail && targetCard.dataset.amTemp) {
		infoDetail.textContent = `${targetCard.dataset.day}(${targetCard.dataset.date}) - 오전 ${targetCard.dataset.amTemp} (강수 ${targetCard.dataset.amRain}) / 오후 ${targetCard.dataset.pmTemp} (강수 ${targetCard.dataset.pmRain})`;
	}

	// 4. 데이터 수집 및 커스텀 이벤트 전달
	const activeItem = dataList.find(d => d.date === targetDate);
	const cardData = {
		forecastType: currentForecastTab,
		day: targetCard.dataset.day || activeItem?.dayOfWeek || activeItem?.day || '',
		date: targetCard.dataset.date,
		amTemp: targetCard.dataset.amTemp || activeItem?.amTemp,
		amRain: targetCard.dataset.amRain || activeItem?.amRain,
		pmTemp: targetCard.dataset.pmTemp || activeItem?.pmTemp,
		pmRain: targetCard.dataset.pmRain || activeItem?.pmRain,
		minTemp: activeItem?.minTemp,
		maxTemp: activeItem?.maxTemp
	};
	console.log('[콜백 실행] 선택한 날씨 정보:', cardData);
	targetCard.dispatchEvent(new CustomEvent('weatherSelect', { detail: cardData, bubbles: true }));

	// 5. 카드 클릭 등 스크롤 외에서 선택한 경우 시간별 예보 스크롤 이동
	if (!fromScroll) {
		scrollToHourlyDate(targetDate);
	}
};

/**
 * Swiper 초기화 함수 및 데이터 바인딩 (nuri-web 상단 일정 선택기)
 * @param {Array} rawData - 날씨 카드 데이터 목록
 */
export const weatherSwiperExe = (rawData) => {
	const data = normalizeForecastData(rawData);
	rawWeatherData = data;
	globalForecastData = data;

	// JSON 데이터를 Swiper 슬라이드 HTML 문자열로 생성하는 함수
	const weatherSlideMaker = (dataList) => {
		let result = '';
		dataList.forEach((item, idx) => {
			const displayDay = idx === 0 ? '오늘' : idx === 1 ? '내일' : idx === 2 ? '모레' : (item.dayOfWeek || item.day);
			const displayDate = idx < 3 ? `${item.date}(${item.dayOfWeek})` : item.date;
			result += `
				<div class="swiper-slide nr__weather-card ${item.active ? 'active' : ''}" data-date="${item.date}" data-day="${displayDay}" data-forecast-type="${item.forecastType || '단기예보'}" data-am-temp="${item.amTemp}" data-am-rain="${item.amRain}" data-pm-temp="${item.pmTemp}" data-pm-rain="${item.pmRain}">
					<div class="nr__card-header">
						<strong class="nr__card-day">${displayDay}</strong>
						<span class="nr__card-date">${displayDate}</span>
					</div>
					<div class="nr__card-body">
						<div class="nr__time-col am">
							<div class="nr__weather-icon">
								<div data-icon-weather="${item.amIcon}">
									<span class="sr-only">${item.amText}</span>
								</div>
							</div>
							<span class="nr__temp am">${item.amTemp}</span>
							<span class="nr__rain">${item.amRain}</span>
						</div>
						<div class="nr__time-col pm">
							<div class="nr__weather-icon">
								<div data-icon-weather="${item.pmIcon}">
									<span class="sr-only">${item.pmText}</span>
								</div>
							</div>
							<span class="nr__temp pm">${item.pmTemp}</span>
							<span class="nr__rain">${item.pmRain}</span>
						</div>
					</div>
				</div>
			`;
		});
		return result;
	};

	// HTML 슬라이드 노드 추가
	const wrapper = document.querySelector('.nr__weather-swiper .swiper-wrapper');
	if (wrapper) {
		wrapper.innerHTML = weatherSlideMaker(data);
	}

	// 기존 Swiper 인스턴스 정리
	if (weatherSwiperInstance && typeof weatherSwiperInstance.destroy === 'function') {
		weatherSwiperInstance.destroy(true, true);
		weatherSwiperInstance = null;
	}

	// Swiper 인스턴스 생성
	const swiperTarget = document.querySelector('.nr__weather-swiper');
	if (swiperTarget && typeof Swiper !== 'undefined') {
		weatherSwiperInstance = new Swiper(swiperTarget, {
			slidesPerView: 2,
			slidesPerGroup: 1, // 버튼 클릭 시 하나씩 이동
			spaceBetween: 12,
			navigation: {
				nextEl: '.nr__weather-swiper-next',
				prevEl: '.nr__weather-swiper-prev',
			},
			breakpoints: {
				320: { slidesPerView: 2.2, spaceBetween: 8 },
				480: { slidesPerView: 2.6, spaceBetween: 10 },
				640: { slidesPerView: 3.2, spaceBetween: 10 },
				768: { slidesPerView: 4.2, spaceBetween: 12 },
				1024: { slidesPerView: 6, spaceBetween: 12 }
			}
		});
	}

	// 초기 선택 날짜 설정
	const activeData = Array.isArray(data) ? (data.find(item => item.active) || data[0]) : null;
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
 * 상단 단기예보일정, 하단 중기예보일정 분리 렌더링 초기화 (nuri-app 상단 일정 선택기)
 * @param {string|Element} target
 * @param {Array} rawData
 */
export const weekdayExe = (target, rawData) => {
	const targetEl = typeof target === 'string'
		? (document.getElementById(target) || document.querySelector(target))
		: (target || document.getElementById('hourly-forecast-day'));
	if (!targetEl) return;

	const normalized = normalizeForecastData(rawData);
	const limitedData = normalized.slice(0, 10);
	globalForecastData = limitedData;
	rawWeatherData = limitedData;

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
		currentForecastTab = shortTermList.some((d) => d.date === currentSelectedDate) ? 'short' : 'mid';
		currentForecastType = currentForecastTab;
	} else {
		currentForecastTab = shortTermList.some((d) => d.date === currentSelectedDate) ? 'short' : 'mid';
		currentForecastType = currentForecastTab;
	}

	let schedulesWrap = targetEl.querySelector('.nr__forecast-schedules');
	if (!schedulesWrap) {
		const isShortActive = currentForecastTab === 'short';
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
		// 차트 컨테이너가 이미 존재하면 그 앞에 삽입, 없으면 맨 앞에 삽입
		const forecastContainer = targetEl.querySelector('.nr__hourly-forecast-container');
		if (forecastContainer) {
			forecastContainer.insertAdjacentHTML('beforebegin', schedulesHtml);
		} else {
			targetEl.insertAdjacentHTML('afterbegin', schedulesHtml);
		}
	}

	// nuri-app 헤더 영역에 뷰 모드 전환 버튼(.nr__hourly-view-switcher)이 없으면 자동 주입
	const appSectionHeader = document.querySelector('#section-hourly .nr__main-section-header');
	if (appSectionHeader && !document.querySelector('.nr__hourly-view-btn')) {
		const controlsWrap = document.createElement('div');
		controlsWrap.className = 'nr__hourly-header-controls';
		const existingRadioGroup = appSectionHeader.querySelector('.nr__content-type');
		if (existingRadioGroup) {
			appSectionHeader.insertBefore(controlsWrap, existingRadioGroup);
			controlsWrap.appendChild(existingRadioGroup);
		} else {
			appSectionHeader.appendChild(controlsWrap);
		}
		controlsWrap.insertAdjacentHTML('beforeend', `
			<div class="nr__hourly-view-switcher" role="group" aria-label="시간별 예보 보기 방식">
				<button type="button" class="nr__hourly-view-btn ${currentViewMode === 'mode1' ? 'active' : ''}" data-view="mode1" aria-label="선형 차트 보기" title="선형 차트 보기">
					<span data-icon="legend-1"></span>
				</button>
				<button type="button" class="nr__hourly-view-btn ${currentViewMode === 'mode2' ? 'active' : ''}" data-view="mode2" aria-label="막대 차트 보기" title="막대 차트 보기">
					<span data-icon="legend-2"></span>
				</button>
				<button type="button" class="nr__hourly-view-btn ${currentViewMode === 'mode3' ? 'active' : ''}" data-view="mode3" aria-label="리스트 보기" title="리스트 보기">
					<span data-icon="legend-3"></span>
				</button>
			</div>
		`);
	}

	renderSchedules(targetEl);
	updateIntervalVisibility(currentForecastTab);
};

/**
 * 시간별 예보 컴포넌트 실행 함수 (nuri-web & nuri-app 통합)
 * - hourlyForecastExe(data, options) 및 hourlyForecastExe(target, data, options) 모두 지원
 */
export const hourlyForecastExe = (arg1, arg2 = {}, arg3 = {}) => {
	let targetEl = null;
	let rawInput = null;
	let options = {};

	if (
		Array.isArray(arg1) ||
		(arg1 && typeof arg1 === 'object' && !(arg1 instanceof Element) && (arg1.weekly || arg1.locations))
	) {
		rawInput = arg1;
		options = arg2 || {};
		targetEl = document.getElementById('hourly-forecast-day') || document.querySelector('.nr__hourly-forecast');
	} else {
		targetEl = typeof arg1 === 'string'
			? (document.getElementById(arg1) || document.querySelector(arg1))
			: arg1;
		rawInput = arg2;
		options = arg3 || {};
	}

	const data = normalizeForecastData(rawInput);
	rawWeatherData = data;
	globalForecastData = data;

	shortTermList = data.filter((item, idx) => {
		if (item.forecastType) return item.forecastType === '단기예보';
		return idx < 3;
	});

	midTermList = data.filter((item, idx) => {
		if (item.forecastType) return item.forecastType === '중기예보';
		return idx >= 3;
	});

	// 초기 간격 감지 (nuri-web: nr__interval_opt, nuri-app: name="time")
	const detectCurrentInterval = () => {
		const webRadio = document.querySelector('input[name="nr__interval_opt"]:checked');
		if (webRadio) {
			return parseInt(webRadio.value, 10) || 1;
		}
		const appRadio = document.querySelector('input[name="time"]:checked');
		if (appRadio) {
			if (appRadio.id === 'time1' || appRadio.value === '3') return 3;
			if (appRadio.id === 'time2' || appRadio.value === '1') return 1;
		}
		return currentInterval || 1;
	};

	// 뷰 모드 문자열 정규화 ('table'/'list'/'mode3' -> 'mode3', 'graph'/'bar'/'chart'/'mode2' -> 'mode2', 'line'/'mode1' -> 'mode1')
	const normalizeViewMode = (mode) => {
		if (!mode) return null;
		const m = String(mode).trim().toLowerCase();
		if (m === 'table' || m === 'list' || m === 'mode3') return 'mode3';
		if (m === 'graph' || m === 'bar' || m === 'chart' || m === 'mode2') return 'mode2';
		if (m === 'line' || m === 'mode1') return 'mode1';
		return m;
	};

	// 초기 뷰 모드 감지 (1. options -> 2. 컨테이너 data-view-mode -> 3. sessionStorage -> 4. 기본값)
	const detectInitialViewMode = () => {
		let savedMode = null;
		try { savedMode = sessionStorage.getItem('nr_forecast_view_mode'); } catch (e) {}
		const rawMode = (options && (options.viewMode || options.initialViewMode || options.defaultViewMode))
			|| (targetEl && (targetEl.dataset.viewMode || targetEl.dataset.view))
			|| (document.getElementById('section-hourly')?.dataset.viewMode)
			|| savedMode;
		return normalizeViewMode(rawMode) || currentViewMode || 'mode1';
	};

	currentViewMode = detectInitialViewMode();

	const filterHours = (hours, interval) => {
		if (!hours) return [];
		if (currentForecastTab === 'mid') return hours;
		if (interval === 1) return hours;
		// 3시간 간격 필터링 (03시, 06시, 09시, 12시, 15시, 18시, 21시, 00시 등)
		return hours.filter(h => {
			const num = parseInt(h.time, 10);
			return num % 3 === 0;
		});
	};

	const renderComponent = () => {
		let container = document.getElementById('hourly-forecast-content');
		if (!container && targetEl) {
			let containerWrap = targetEl.querySelector('.nr__hourly-forecast-container');
			if (!containerWrap) {
				targetEl.insertAdjacentHTML(
					'beforeend',
					`
					<div class="nr__hourly-forecast-container">
						<div id="hourly-forecast-content" class="nr__hourly-forecast-content"></div>
					</div>
					`
				);
			}
			container = targetEl.querySelector('#hourly-forecast-content') || document.getElementById('hourly-forecast-content');
		}
		if (!container) return;

		const activeData = rawWeatherData || data || [];
		const isMidTerm = (currentForecastTab === 'mid');
		// hourly 데이터가 존재하며 현재 선택된 탭(단기예보 vs 중기예보)에 맞는 날짜 목록 추출
		const validDates = activeData.filter(d => d.hourly && d.hourly.length > 0 && (isMidTerm ? d.forecastType === '중기예보' : d.forecastType === '단기예보'));

		if (validDates.length > 0) {
			const isDateInTab = validDates.some(d => d.date === currentSelectedDate);
			if (!isDateInTab) {
				const activeItem = validDates.find(d => d.active) || validDates[0];
				currentSelectedDate = activeItem.date;
			}
		}

		// 유효한 강수/적설 값인지 체크하는 헬퍼 함수 (0 또는 빈값/' - ' 제외, 테스트 오버라이드 적용)
		const isValidAmount = (val, isPrecip = false, isSnow = false) => {
			if (isPrecip && testOverrides.zeroPrecip) return false;
			if (isSnow && testOverrides.zeroSnow) return false;
			if (val === null || val === undefined) return false;
			const s = String(val).trim();
			if (s === '' || s === '-') return false;
			const num = parseFloat(s.replace(/[^0-9.]/g, ''));
			if (isNaN(num)) return false;
			return num > 0;
		};

		// 강수강도(비/눈) 파싱 헬퍼 함수 (테스트 오버라이드 적용)
		const getIntensityValues = (h) => {
			let rain = null;
			let snow = null;

			if (h.rainIntensity !== undefined) rain = h.rainIntensity;
			if (h.snowIntensity !== undefined) snow = h.snowIntensity;

			if (rain === null && snow === null && h.precipIntensity) {
				if (typeof h.precipIntensity === 'object' && !Array.isArray(h.precipIntensity)) {
					rain = h.precipIntensity.rain || null;
					snow = h.precipIntensity.snow || null;
				} else if (Array.isArray(h.precipIntensity)) {
					rain = h.precipIntensity[0] || null;
					snow = h.precipIntensity[1] || null;
				} else if (typeof h.precipIntensity === 'string') {
					const str = h.precipIntensity.trim();
					if (str !== '-' && str !== '' && str !== '0') {
						if (str.includes('\n')) {
							const parts = str.split('\n').map(s => s.trim());
							rain = parts[0] || null;
							snow = parts[1] || null;
						} else if (str.includes('/')) {
							const parts = str.split('/').map(s => s.trim());
							rain = parts[0] || null;
							snow = parts[1] || null;
						} else if (str.includes('비')) {
							rain = str;
						} else if (str.includes('눈')) {
							snow = str;
						} else {
							rain = str;
						}
					}
				}
			}

			const isValidIntensity = (val) => {
				if (val === null || val === undefined) return false;
				const s = String(val).trim();
				return s !== '' && s !== '-' && s !== '0';
			};

			let finalRain = isValidIntensity(rain) ? String(rain).trim() : null;
			let finalSnow = isValidIntensity(snow) ? String(snow).trim() : null;

			if (testOverrides.zeroRainIntensity) finalRain = null;
			if (testOverrides.zeroSnowIntensity) finalSnow = null;

			return {
				rain: finalRain,
				snow: finalSnow
			};
		};

		// 강수량 데이터가 단기예보 기간 내에 존재하는지 검사 (3시간 간격이거나 전체가 0이거나 없으면 비노출)
		const hasPrecip = !isMidTerm && currentInterval !== 3 && validDates.some(d => d.hourly && d.hourly.some(h => isValidAmount(h.precip, true, false)));

		// 적설량 데이터가 기간 내에 존재하는지 검사 (3시간 간격이거나 전체가 0이거나 없으면 비노출)
		const hasSnow = !isMidTerm && currentInterval !== 3 && validDates.some(d => d.hourly && d.hourly.some(h => isValidAmount(h.snow, false, true)));

		// 강수강도 비 관련 정보가 단기예보 기간 내에 존재하는지 검사 (없으면 공간 삭제)
		const hasRainIntensity = !isMidTerm && validDates.some(d => d.hourly && d.hourly.some(h => {
			const { rain } = getIntensityValues(h);
			return Boolean(rain);
		}));

		// 강수강도 눈 관련 정보가 단기예보 기간 내에 존재하는지 검사 (없으면 공간 삭제)
		const hasSnowIntensity = !isMidTerm && validDates.some(d => d.hourly && d.hourly.some(h => {
			const { snow } = getIntensityValues(h);
			return Boolean(snow);
		}));

		// 강수강도 전체 노출 여부 및 단일/복수 행 여부 (타이틀 높이 조절용)
		const hasPrecipIntensity = hasRainIntensity || hasSnowIntensity;
		const isBothIntensity = hasRainIntensity && hasSnowIntensity;
		const intensityClass = isBothIntensity ? 'has-both' : 'has-single';

		// 강수강도 셀 HTML 생성 헬퍼
		const makePrecipIntensityCellHtml = (h) => {
			if (!hasPrecipIntensity) return '';
			const { rain, snow } = getIntensityValues(h);

			let contentHtml = '';
			if (isBothIntensity) {
				contentHtml = `
					<div class="nr__intensity-item nr__intensity-rain">${rain || '-'}</div>
					<div class="nr__intensity-item nr__intensity-snow">${snow || '-'}</div>
				`;
			} else if (hasRainIntensity) {
				contentHtml = `
					<div class="nr__intensity-item nr__intensity-rain">${rain || '-'}</div>
				`;
			} else if (hasSnowIntensity) {
				contentHtml = `
					<div class="nr__intensity-item nr__intensity-snow">${snow || '-'}</div>
				`;
			}

			return `
				<div class="nr__cell nr__row-precip-intensity nr__cell-precip-intensity ${intensityClass}">
					<span class="sr-only">강수강도</span>
					${contentHtml}
				</div>
			`;
		};

		// 강수량 및 적설량 최대값 계산 (막대 높이 스케일링용)
		let maxRainVal = 0;
		let maxSnowVal = 0;
		if (hasPrecip || hasSnow) {
			validDates.forEach(d => {
				d.hourly?.forEach(h => {
					if (isValidAmount(h.precip, true, false)) {
						const n = parseFloat(String(h.precip).replace(/[^0-9.]/g, ''));
						if (!isNaN(n) && n > maxRainVal) maxRainVal = n;
					}
					if (isValidAmount(h.snow, false, true)) {
						const n = parseFloat(String(h.snow).replace(/[^0-9.]/g, ''));
						if (!isNaN(n) && n > maxSnowVal) maxSnowVal = n;
					}
				});
			});
		}
		if (maxRainVal === 0) maxRainVal = 10;
		if (maxSnowVal === 0) maxSnowVal = 5;

		// 단기예보 그래프형태(Mode 2): 강수량/적설량 막대그래프 노출 여부 (둘 다 0이면 비노출)
		const hasPrecipSnowBar = (hasPrecip || hasSnow);

		// 단기예보 그래프형태 헤더 HTML (둘 다 있으면 2줄, 하나만 있으면 1줄)
		let precipSnowBarHeaderHtml = '';
		if (hasPrecipSnowBar) {
			let headerText = '강수량(mm)<br>적설량(cm)';
			if (hasPrecip && !hasSnow) {
				headerText = '강수량(mm)';
			} else if (!hasPrecip && hasSnow) {
				headerText = '적설량(cm)';
			}
			precipSnowBarHeaderHtml = `<div class="nr__fixed-row-cell nr__row-precip-bar">${headerText}</div>`;
		}

		// 단기예보 그래프형태: 강수량/적설량 막대그래프 셀 HTML 생성 헬퍼
		const makePrecipSnowBarCellHtml = (h) => {
			if (!hasPrecipSnowBar) return '';

			const isRainVal = hasPrecip && isValidAmount(h.precip, true, false);
			const isSnowVal = hasSnow && isValidAmount(h.snow, false, true);

			if (!isRainVal && !isSnowVal) {
				return `<div class="nr__cell nr__row-precip-bar nr__cell-precip-bar"></div>`;
			}

			const isBothInCell = isRainVal && isSnowVal;
			const barWidthClass = isBothInCell ? 'is-both' : 'is-single';

			let rainBarHtml = '';
			let snowBarHtml = '';

			if (isRainVal) {
				const rainNum = parseFloat(String(h.precip).replace(/[^0-9.]/g, '')) || 0;
				const rainH = Math.min(1.8, Math.max(0.4, (rainNum / maxRainVal) * 1.8)).toFixed(2);
				rainBarHtml = `
					<div class="nr__precip-bar-item nr__bar-rain ${barWidthClass}">
						<span class="nr__bar-val">${h.precip}</span>
						<span class="nr__bar-pillar" style="height: ${rainH}rem;"></span>
					</div>
				`;
			}

			if (isSnowVal) {
				const snowNum = parseFloat(String(h.snow).replace(/[^0-9.]/g, '')) || 0;
				const snowH = Math.min(1.8, Math.max(0.4, (snowNum / maxSnowVal) * 1.8)).toFixed(2);
				snowBarHtml = `
					<div class="nr__precip-bar-item nr__bar-snow ${barWidthClass}">
						<span class="nr__bar-val">${h.snow}</span>
						<span class="nr__bar-pillar" style="height: ${snowH}rem;"></span>
					</div>
				`;
			}

			return `
				<div class="nr__cell nr__row-precip-bar nr__cell-precip-bar">
					<span class="sr-only">강수량 및 적설량</span>
					<div class="nr__precip-bar-group">
						${rainBarHtml}
						${snowBarHtml}
					</div>
				</div>
			`;
		};

		// 단기예보 그래프형태: 강수확률 막대그래프 셀 HTML 생성 헬퍼
		const makeRainProbBarCellHtml = (h) => {
			const rawProb = parseInt(String(h.rainProb).replace(/[^0-9]/g, ''), 10) || 0;
			const prob = Math.min(100, Math.max(0, rawProb));
			const pillarH = prob > 0 ? Math.max(0.4, (prob / 100) * 6.4).toFixed(2) : 0;

			return `
				<div class="nr__cell nr__row-rain-prob nr__cell-rain-chart has-chart" data-rain-prob="${h.rainProb}">
					<span class="sr-only">강수확률 ${h.rainProb}</span>
					<div class="nr__cell-rain-chart-group">
						<div class="nr__rain-prob-bar-item">
							<span class="nr__bar-val">${prob}%</span>
							${prob > 0 ? `<span class="nr__bar-pillar" style="height: ${pillarH}rem;"></span>` : ''}
						</div>
					</div>
				</div>
			`;
		};

		// Mode 판별: Mode 1 (선형 차트), Mode 2 (막대 차트), Mode 3 (리스트/텍스트 형태)
		const isListMode = (currentViewMode === 'mode3');
		const isBarChartMode = (currentViewMode === 'mode2');

		const fixedTimeLabel = getDisplayDateText(currentSelectedDate, activeData) || '오늘';

		let fixedColHtml = '';
		const headerCellHtml = `
			<div class="nr__fixed-header-cell">
				<button type="button" class="nr__drop-btn nr__fixed-info-btn" aria-controls="hourly-info-tooltip" aria-expanded="false" aria-haspopup="dialog" aria-label="시간별 예보 안내" data-tooltip="true">
					<span class="icon-aspect-info-round" data-size="22"></span>
				</button>
				<div id="hourly-info-tooltip" class="nr__drop-menu nr__tooltip-layer" data-position="bottom-left" role="tooltip" style="display: none;">
					<div class="nr__tooltip-body nr__hourly-help">
						<div class="nr__hourly-help-img"></div>
						<div class="nr__hourly-help-cont">
							<h4>예보 요소별 시간 안내</h4>
							<ul>
								<li><b>시각 :</b> 01시 기준 예시</li>
								<li><b>날씨/하늘상태 :</b> 이전 시간대의 날씨 또는 하늘상태</li>
								<li><b>기온 :</b> 정시 기준 기온</li>
								<li><b>체감온도 :</b> 정시 체감온도</li>
								<li><b>강수량/적설량 :</b> 이전 시간대 강수량 및 신적설</li>
								<li><b>강수확률/강수가능성 :</b> 강수 가능 확률 및 정성 정보</li>
								<li><b>바람 :</b> 정시 바람(풍향 및 강도, 풍속)</li>
								<li><b>습도 :</b> 정시 습도</li>
							</ul>
						</div>
					</div>
				</div>
			</div>
		`;

		if (isMidTerm) {
			if (isListMode) {
				// 중기예보 Mode 3: 표 형태 (이미지 구성)
				fixedColHtml = `
					<div class="nr__hourly-fixed-column">
						${headerCellHtml}
						<div class="nr__fixed-row-cell nr__row-time"><span>${fixedTimeLabel}</span></div>
						<div class="nr__fixed-row-cell nr__row-sky">하늘상태</div>
						<div class="nr__fixed-row-cell nr__row-minmax-temp">최저/최고기온</div>
						<div class="nr__fixed-row-cell nr__row-avg-temp">평균기온</div>
						<div class="nr__fixed-row-cell nr__row-rain-possibility">강수가능성</div>
						<div class="nr__fixed-row-cell nr__row-rain-trend">강수가능성<br>변화추이</div>
					</div>
				`;
			} else {
				// 중기예보 그래프 형태 (Mode 1, Mode 2)
				fixedColHtml = `
					<div class="nr__hourly-fixed-column">
						${headerCellHtml}
						<div class="nr__fixed-row-cell nr__row-time"><span>${fixedTimeLabel}</span></div>
						<div class="nr__fixed-row-cell nr__row-sky">하늘상태</div>
						<div class="nr__fixed-row-cell nr__row-temp-chart">기온</div>
						<div class="nr__fixed-row-cell nr__row-rain-possibility">강수가능성</div>
						<div class="nr__fixed-row-cell nr__row-rain-trend">강수가능성<br>변화추이</div>
					</div>
				`;
			}
		} else if (isListMode) {
			// 단기예보 Mode 3 (리스트 보기)
			fixedColHtml = `
				<div class="nr__hourly-fixed-column">
					${headerCellHtml}
					<div class="nr__fixed-row-cell nr__row-time"><span>${fixedTimeLabel}</span></div>
					<div class="nr__fixed-row-cell nr__row-weather">날씨</div>
					${currentInterval === 1 ? `
					<div class="nr__fixed-row-cell nr__row-temp">기온</div>
					<div class="nr__fixed-row-cell nr__row-sensory-temp">체감온도</div>
					` : `
					<div class="nr__fixed-row-cell nr__row-temp-text">기온(체감)</div>
					`}
					${hasPrecip ? '<div class="nr__fixed-row-cell nr__row-precip">강수량(mm)</div>' : ''}
					${hasSnow ? '<div class="nr__fixed-row-cell nr__row-snow">적설량(cm)</div>' : ''}
					${hasPrecipIntensity ? `<div class="nr__fixed-row-cell nr__row-precip-intensity ${intensityClass}">강수강도</div>` : ''}
					<div class="nr__fixed-row-cell nr__row-rain-prob">강수확률</div>
					<div class="nr__fixed-row-cell nr__row-wind">바람</div>
					<div class="nr__fixed-row-cell nr__row-humidity">습도</div>
					<div class="nr__fixed-row-cell nr__row-heat">폭염영향</div>
				</div>
			`;
		} else if (isBarChartMode) {
			// 단기예보 Mode 2 (그래프형태)
			fixedColHtml = `
				<div class="nr__hourly-fixed-column">
					${headerCellHtml}
					<div class="nr__fixed-row-cell nr__row-time"><span>${fixedTimeLabel}</span></div>
					<div class="nr__fixed-row-cell nr__row-weather">날씨</div>
					<div class="nr__fixed-row-cell nr__row-temp-chart">
						<div class="nr__temp-legend-item">
							<span class="nr__legend-title">기온</span>
							<span class="nr__legend-symbol symbol-temp"></span>
						</div>
						<div class="nr__temp-legend-item">
							<span class="nr__legend-title">체감온도</span>
							<span class="nr__legend-symbol symbol-sensory"></span>
						</div>
					</div>
					${precipSnowBarHeaderHtml}
					${hasPrecipIntensity ? `<div class="nr__fixed-row-cell nr__row-precip-intensity ${intensityClass}">강수강도</div>` : ''}
					<div class="nr__fixed-row-cell nr__row-rain-prob has-chart">강수확률</div>
					<div class="nr__fixed-row-cell nr__row-wind has-chart">${currentInterval === 3 ? '바람' : `풍향/풍속<br/>(m/s)`}</div>
					<div class="nr__fixed-row-cell nr__row-humidity has-chart">습도</div>
				</div>
			`;
		} else {
			// 단기예보 Mode 1 (선형 차트 형태 - 이미지 1: 기온 셀에 체감온도 범례 추가)
			fixedColHtml = `
				<div class="nr__hourly-fixed-column">
					${headerCellHtml}
					<div class="nr__fixed-row-cell nr__row-time"><span>${fixedTimeLabel}</span></div>
					<div class="nr__fixed-row-cell nr__row-weather">날씨</div>
					<div class="nr__fixed-row-cell nr__row-temp-chart">
						<div class="nr__temp-legend-item">
							<span class="nr__legend-title">기온</span>
							<span class="nr__legend-symbol symbol-temp"></span>
						</div>
						<div class="nr__temp-legend-item">
							<span class="nr__legend-title">체감온도</span>
							<span class="nr__legend-symbol symbol-sensory"></span>
						</div>
					</div>
					${hasPrecip ? '<div class="nr__fixed-row-cell nr__row-precip">강수량(mm)</div>' : ''}
					${hasSnow ? '<div class="nr__fixed-row-cell nr__row-snow">적설량(cm)</div>' : ''}
					${hasPrecipIntensity ? `<div class="nr__fixed-row-cell nr__row-precip-intensity ${intensityClass}">강수강도</div>` : ''}
					<div class="nr__fixed-row-cell nr__row-rain-prob">강수확률</div>
					<div class="nr__fixed-row-cell nr__row-wind">${currentInterval === 3 ? '바람' : '바람(m/s)'}</div>
					<div class="nr__fixed-row-cell nr__row-humidity">습도</div>
					<div class="nr__fixed-row-cell nr__row-heat">폭염영향</div>
				</div>
			`;
		}

		let chartLayersHtml = '';
		if (!isListMode) {
			chartLayersHtml = `
				<div class="nr__hourly-chart-layer nr__temp-chart-layer" id="hourly-temp-chart-layer"></div>
			`;
			if (!isMidTerm && isBarChartMode) {
				chartLayersHtml += `
					<div class="nr__hourly-chart-layer nr__wind-chart-layer" id="hourly-wind-chart-layer"></div>
					<div class="nr__hourly-chart-layer nr__humidity-chart-layer" id="hourly-humidity-chart-layer"></div>
				`;
			}
		}

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
					<div class="nr__date-sticky-header">
						<span class="nr__date-pill"> <span class="nr__date-pill-icon"><span data-icon="calendar-check"></span></span> ${dayItem.date} ${dayItem.dayOfWeek || dayItem.day}</span>
						<span class="nr__temp-range">
							<span class="nr__temp-range-group">
								최저 <span class="nr__min-temp">${dayItem.minTemp || '-'}</span>
							</span>
							<span class="nr__divider">|</span>
							<span class="nr__temp-range-group">
								최고 <span class="nr__max-temp">${dayItem.maxTemp || '-'}</span>
							</span>
						</span>
					</div>
					<div class="nr__hourly-columns-row">
			`;

			hours.forEach(h => {
				const numericTemp = parseInt(h.temp, 10) || 0;
				const numericSensory = parseInt(h.sensoryTemp, 10) || numericTemp;
				const rainProbVal = parseInt(h.rainProb, 10) || 0;
				const windDirVal = typeof h.windDir === 'number' ? h.windDir : getWindAngle(h.windDir);
				const windSpeedVal = Array.isArray(h.windText) ? (h.windText.length >= 3 ? h.windText[2] : h.windText[1]) : (h.windSpeed || '0');
				const windStrengthVal = Array.isArray(h.windText) && h.windText.length >= 3 ? h.windText[1] : '약';
				const humidityVal = parseInt(h.humidity, 10) || 0;

				const timeHour = parseInt(h.time, 10);
				const isNight = !isNaN(timeHour) && (timeHour >= 21 || timeHour <= 5);
				let weatherIcon = h.icon;
				if (isNight) {
					if (weatherIcon === 'NB01') {
						weatherIcon = 'NB12';
					} else if (weatherIcon === 'NB02') {
						weatherIcon = 'NB13';
					}
				}

				let windDirStrength = '-';
				let windSpeedText = '-';
				let windDirOnly = '-';
				let windStrOnly = '';
				if (Array.isArray(h.windText)) {
					if (h.windText.length >= 3) {
						windDirOnly = h.windText[0];
						windStrOnly = h.windText[1];
						windDirStrength = `${h.windText[0]} ${h.windText[1]}`;
						windSpeedText = `${h.windText[2]}m/s`;
					} else if (h.windText.length === 2) {
						windDirOnly = h.windText[0];
						windStrOnly = h.windText[1];
						windDirStrength = `${h.windText[0]}`;
						windSpeedText = `${h.windText[1]}m/s`;
					} else if (h.windText.length === 1) {
						windDirOnly = h.windText[0];
						windDirStrength = `${h.windText[0]}`;
					}
				} else if (h.windSpeed) {
					windSpeedText = `${h.windSpeed}m/s`;
					windDirOnly = h.windText || '-';
					windStrOnly = h.windStrength || '';
					windDirStrength = h.windStrength ? `${h.windText || ''} ${h.windStrength}` : (h.windText || '-');
				}

				if (isMidTerm) {
					if (isListMode) {
						// 중기예보 Mode 3: 표 형태 (이미지와 같은 구성)
						const formattedTemp = h.temp ? h.temp.replace('°C', '℃') : '-';
						let minMaxValHtml = '';
						if (h.isMin) {
							minMaxValHtml = `<span class="nr__temp-val-min">${formattedTemp}</span>`;
						} else if (h.isMax) {
							minMaxValHtml = `<span class="nr__temp-val-max">${formattedTemp}</span>`;
						}

						scrollViewportHtml += `
							<div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}">
								<div class="nr__cell nr__row-time nr__cell-time">
									<span class="sr-only">시각</span>
									${h.time}
								</div>
								<div class="nr__cell nr__row-sky nr__cell-weather">
									<span class="sr-only">하늘상태</span>
									<div data-icon-weather="${weatherIcon}">
										<span class="sr-only">${h.text}</span>
									</div>
								</div>
								<div class="nr__cell nr__row-minmax-temp nr__cell-minmax-temp">
									<span class="sr-only">최저/최고기온</span>
									${minMaxValHtml}
								</div>
								<div class="nr__cell nr__row-avg-temp nr__cell-avg-temp">
									<span class="sr-only">평균기온</span>
									<span class="nr__temp-val-avg">${formattedTemp}</span>
								</div>
								<div class="nr__cell nr__row-rain-possibility nr__cell-rain-possibility">
									<span class="sr-only">강수가능성</span>
									<div class="nr__cell-possibility-value ${h.rainPossibility === '높음' ? 'status-high' : (h.rainPossibility === '보통' ? 'status-normal' : h.rainPossibility === '조금' ? 'status-low' : '')}"><span>${h.rainPossibility || ''}</span></div>
								</div>
								<div class="nr__cell nr__row-rain-trend nr__cell-rain-trend trend-${h.rainTrend || 'flat'}">
									<span class="nr__trend-wrapper">
										<span class="sr-only">강수가능성 변화추이</span>
										<span class="nr__trend-text">${h.trendText || ''}</span>
									</span>
								</div>
							</div>
						`;
					} else {
						// 중기예보 그래프 형태 (Mode 1, Mode 2)
						scrollViewportHtml += `
							<div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}" data-temp="${numericTemp}" data-is-min="${h.isMin ? 'true' : 'false'}" data-min-val="${h.minVal ?? ''}" data-is-max="${h.isMax ? 'true' : 'false'}" data-max-val="${h.maxVal ?? ''}" data-p10="${h.percentiles?.p10 ?? ''}" data-p25="${h.percentiles?.p25 ?? ''}" data-p75="${h.percentiles?.p75 ?? ''}" data-p90="${h.percentiles?.p90 ?? ''}">
								<div class="nr__cell nr__row-time nr__cell-time">
									<span class="sr-only">시각</span>
									${h.time}
								</div>
								<div class="nr__cell nr__row-sky nr__cell-weather">
									<span class="sr-only">하늘상태</span>
									<div data-icon-weather="${weatherIcon}">
										<span class="sr-only">${h.text}</span>
									</div>
								</div>
								<div class="nr__cell nr__row-temp-chart nr__cell-temp-chart">
									<span class="sr-only">기온 ${h.temp}</span>
								</div>
								<div class="nr__cell nr__row-rain-possibility nr__cell-rain-possibility">
									<span class="sr-only">강수가능성</span>
									<div class="nr__cell-possibility-value ${h.rainPossibility === '높음' ? 'status-high' : (h.rainPossibility === '보통' ? 'status-normal' : h.rainPossibility === '조금' ? 'status-low' : '')}"><span>${h.rainPossibility || '거의없음'}</span></div>
								</div>
								<div class="nr__cell nr__row-rain-trend nr__cell-rain-trend trend-${h.rainTrend || 'flat'}">
									<span class="nr__trend-wrapper">
										<span class="sr-only">강수가능성 변화추이</span>
										${isBarChartMode ? `<span class="nr__trend-arrow">${h.rainTrend === 'up' ? '↑' : (h.rainTrend === 'down' ? '↓' : '≈')}</span>` : ''}
										<span class="nr__trend-text">${h.trendText || '비슷'}</span>
									</span>
								</div>
							</div>
						`;
					}
				} else if (isListMode) {
					// 단기예보 Mode 3: 리스트/텍스트 형태
					scrollViewportHtml += `
						<div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}">
							<div class="nr__cell nr__row-time nr__cell-time">
								<span class="sr-only">시각</span>
								${h.time}
							</div>
							<div class="nr__cell nr__row-weather nr__cell-weather">
								<span class="sr-only">날씨</span>
								<div data-icon-weather="${weatherIcon}">
									<span class="sr-only">${h.text}</span>
								</div>
							</div>
							${currentInterval === 1 ? `
							<div class="nr__cell nr__row-temp nr__cell-temp">
								<span class="sr-only">기온</span>
								<strong>${h.temp ? h.temp.replace('°C', '℃') : '-'}</strong>
							</div>
							<div class="nr__cell nr__row-sensory-temp nr__cell-sensory-temp">
								<span class="sr-only">체감온도</span>
								<strong>${h.sensoryTemp ? h.sensoryTemp.replace('°C', '℃') : (h.temp ? h.temp.replace('°C', '℃') : '-')}</strong>
							</div>
							` : `
							<div class="nr__cell nr__row-temp-text nr__cell-temp-text">
								<span class="sr-only">기온</span>
								<strong>${h.temp}</strong>
								<span class="nr__sensory-temp">(${h.sensoryTemp})</span>
							</div>
							`}
							${hasPrecip ? `
							<div class="nr__cell nr__row-precip nr__cell-precip">
								<span class="sr-only">강수량</span>
								<div class="nr__cell-precip-value">${h.precip || '-'}</div>
							</div>` : ''}
							${hasSnow ? `
							<div class="nr__cell nr__row-snow nr__cell-snow">
								<span class="sr-only">적설량</span>
								<div class="nr__cell-snow-value">${h.snow || '-'}</div>
							</div>` : ''}
							${makePrecipIntensityCellHtml(h)}
							<div class="nr__cell nr__row-rain-prob nr__cell-rain-prob">
								<span class="sr-only">강수확률</span>
								<div class="nr__cell-rain-prob-value">${h.rainProb || '0%'}</div>
							</div>
							<div class="nr__cell nr__row-wind nr__cell-wind nr__cell-wind-text">
								<span class="sr-only">바람</span>
								${currentInterval === 1 ? `
								<span class="nr__cell-wind-wrap">
									<span class="nr__wind-dir">${windDirOnly}</span>
									<span class="nr__wind-str">${windStrOnly}</span>
								</span>
								<span class="nr__wind-spd">${windSpeedText}</span>
								` : `
								<span class="nr__wind-dir">${windDirOnly}</span>
								<span class="nr__wind-str">${windStrOnly}</span>
								`}
							</div>
							<div class="nr__cell nr__row-humidity nr__cell-humidity">
								<span class="sr-only">습도</span>
								${h.humidity || '-'}
							</div>
							<div class="nr__cell nr__row-heat nr__cell-heat">
								<span class="sr-only">폭염영향</span>
								${h.heatImpact || '-'}
							</div>
						</div>
					`;
				} else if (isBarChartMode) {
					// 단기예보 Mode 2: 막대 차트 형태
					scrollViewportHtml += `
						<div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}" data-temp="${numericTemp}" data-sensory-temp="${numericSensory}" data-rain-prob="${rainProbVal}" data-wind-dir="${windDirVal}" data-wind-speed="${windSpeedVal}" data-wind-strength="${windStrengthVal}" data-humidity="${humidityVal}">
							<div class="nr__cell nr__row-time nr__cell-time">
								<span class="sr-only">시각</span>
								${h.time}
							</div>
							<div class="nr__cell nr__row-weather nr__cell-weather">
								<span class="sr-only">날씨</span>
								<div data-icon-weather="${weatherIcon}">
									<span class="sr-only">${h.text}</span>
								</div>
							</div>
							<div class="nr__cell nr__row-temp-chart nr__cell-temp-chart">
								<span class="sr-only">기온 ${h.temp}</span>
							</div>
							${makePrecipSnowBarCellHtml(h)}
							${makePrecipIntensityCellHtml(h)}
							${makeRainProbBarCellHtml(h)}
							<div class="nr__cell nr__row-wind nr__cell-wind-chart has-chart">
								<span class="sr-only">${currentInterval === 3 ? '바람' : '풍향/풍속'}</span>
							</div>
							<div class="nr__cell nr__row-humidity nr__cell-humidity-chart has-chart" data-humidity="${h.humidity}">
								<span class="sr-only">습도 ${h.humidity}</span>
							</div>
						</div>
					`;
				} else {
					// 단기예보 Mode 1: 선형 차트 형태 (이미지 1: 체감온도가 기온 차트에 통합)
					scrollViewportHtml += `
						<div class="nr__hourly-col" data-date="${dayItem.date}" data-time="${h.time}" data-temp="${numericTemp}" data-sensory-temp="${numericSensory}" data-rain-prob="${rainProbVal}" data-wind-dir="${windDirVal}" data-wind-speed="${windSpeedVal}" data-wind-strength="${windStrengthVal}" data-humidity="${humidityVal}">
							<div class="nr__cell nr__row-time nr__cell-time">
								<span class="sr-only">시각</span>
								${h.time}
							</div>
							<div class="nr__cell nr__row-weather nr__cell-weather">
								<span class="sr-only">날씨</span>
								<div data-icon-weather="${weatherIcon}">
									<span class="sr-only">${h.text}</span>
								</div>
							</div>
							<div class="nr__cell nr__row-temp-chart nr__cell-temp-chart">
								<span class="sr-only">기온 ${h.temp}</span>
							</div>
							${hasPrecip ? `
							<div class="nr__cell nr__row-precip nr__cell-precip">
								<span class="sr-only">강수량</span>
								<div class="nr__cell-precip-value">${h.precip || '-'}</div>
							</div>` : ''}
							${hasSnow ? `
							<div class="nr__cell nr__row-snow nr__cell-snow">
								<span class="sr-only">적설량</span>
								<div class="nr__cell-snow-value">${h.snow || '-'}</div>
							</div>` : ''}
							${makePrecipIntensityCellHtml(h)}
							<div class="nr__cell nr__row-rain-prob nr__cell-rain-prob">
								<span class="sr-only">강수확률</span>
								<div class="nr__cell-rain-prob-value">${h.rainProb}</div>
							</div>
							<div class="nr__cell nr__row-wind nr__cell-wind">
								<span class="sr-only">${Array.isArray(h.windText) ? `${h.windText[0]} ${h.windText.length >= 3 ? h.windText[1] + ' ' : ''}${h.windText.length >= 3 ? h.windText[2] : h.windText[1]}m/s` : '풍향 및 풍속'}</span>
								<span class="nr__wind-arrow" data-icon="wind-arrow" style="transform: rotate(${windDirVal}deg);"></span>
								<span class="nr__wind-strength">${windStrengthVal}</span>
								${currentInterval === 1 ? `<span class="nr__wind-text">${windSpeedVal}</span>` : ''}
							</div>
							<div class="nr__cell nr__row-humidity nr__cell-humidity">
								<span class="sr-only">습도</span>
								${h.humidity}
							</div>
							<div class="nr__cell nr__row-heat nr__cell-heat">
								<span class="sr-only">폭염영향</span>
								${h.heatImpact || '-'}
							</div>
						</div>
					`;
				}
			});

			if (isLastDate) {
				if (isMidTerm) {
					if (isListMode) {
						scrollViewportHtml += `
							<div class="nr__hourly-col nr__empty-col">
								<div class="nr__cell nr__row-time nr__cell-time"></div>
								<div class="nr__cell nr__row-sky nr__cell-weather"></div>
								<div class="nr__cell nr__row-minmax-temp nr__cell-minmax-temp"></div>
								<div class="nr__cell nr__row-avg-temp nr__cell-avg-temp"></div>
								<div class="nr__cell nr__row-rain-possibility nr__cell-rain-possibility"><div class="nr__cell-possibility-value"><span></span></div></div>
								<div class="nr__cell nr__row-rain-trend nr__cell-rain-trend"></div>
							</div>
						`;
					} else {
						scrollViewportHtml += `
							<div class="nr__hourly-col nr__empty-col">
								<div class="nr__cell nr__row-time nr__cell-time"></div>
								<div class="nr__cell nr__row-sky nr__cell-weather"></div>
								<div class="nr__cell nr__row-temp-chart nr__cell-temp-chart"></div>
								<div class="nr__cell nr__row-rain-possibility nr__cell-rain-possibility"><div class="nr__cell-possibility-value"></div></div>
								<div class="nr__cell nr__row-rain-trend nr__cell-rain-trend"></div>
							</div>
						`;
					}
				} else if (isListMode) {
					scrollViewportHtml += `
						<div class="nr__hourly-col nr__empty-col">
							<div class="nr__cell nr__row-time nr__cell-time"></div>
							<div class="nr__cell nr__row-weather nr__cell-weather"></div>
							${currentInterval === 1 ? `
							<div class="nr__cell nr__row-temp nr__cell-temp"></div>
							<div class="nr__cell nr__row-sensory-temp nr__cell-sensory-temp"></div>
							` : `
							<div class="nr__cell nr__row-temp-text nr__cell-temp-text"></div>
							`}
							${hasPrecip ? '<div class="nr__cell nr__row-precip nr__cell-precip"><div class="nr__cell-precip-value"></div></div>' : ''}
							${hasSnow ? '<div class="nr__cell nr__row-snow nr__cell-snow"><div class="nr__cell-snow-value"></div></div>' : ''}
							${hasPrecipIntensity ? `<div class="nr__cell nr__row-precip-intensity nr__cell-precip-intensity ${intensityClass}"><div class="nr__cell-precip-intensity-value"></div></div>` : ''}
							<div class="nr__cell nr__row-rain-prob nr__cell-rain-prob"><div class="nr__cell-rain-prob-value"></div></div>
							<div class="nr__cell nr__row-wind nr__cell-wind nr__cell-wind-text"></div>
							<div class="nr__cell nr__row-humidity nr__cell-humidity"></div>
							<div class="nr__cell nr__row-heat nr__cell-heat"></div>
						</div>
					`;
				} else if (isBarChartMode) {
					scrollViewportHtml += `
						<div class="nr__hourly-col nr__empty-col">
							<div class="nr__cell nr__row-time nr__cell-time"></div>
							<div class="nr__cell nr__row-weather nr__cell-weather"></div>
							<div class="nr__cell nr__row-temp-chart nr__cell-temp-chart"></div>
							${hasPrecipSnowBar ? '<div class="nr__cell nr__row-precip-bar nr__cell-precip-bar"></div>' : ''}
							${hasPrecipIntensity ? `<div class="nr__cell nr__row-precip-intensity nr__cell-precip-intensity ${intensityClass}"></div>` : ''}
							<div class="nr__cell nr__row-rain-prob nr__cell-rain-chart has-chart"><div class="nr__cell-rain-chart-group"></div></div>
							<div class="nr__cell nr__row-wind nr__cell-wind-chart has-chart"></div>
							<div class="nr__cell nr__row-humidity nr__cell-humidity-chart has-chart"></div>
						</div>
					`;
				} else {
					scrollViewportHtml += `
						<div class="nr__hourly-col nr__empty-col">
							<div class="nr__cell nr__row-time nr__cell-time"></div>
							<div class="nr__cell nr__row-weather nr__cell-weather"></div>
							<div class="nr__cell nr__row-temp-chart nr__cell-temp-chart"></div>
							${hasPrecip ? '<div class="nr__cell nr__row-precip nr__cell-precip"><div class="nr__cell-precip-value"></div></div>' : ''}
							${hasSnow ? '<div class="nr__cell nr__row-snow nr__cell-snow"><div class="nr__cell-snow-value"></div></div>' : ''}
							${hasPrecipIntensity ? `<div class="nr__cell nr__row-precip-intensity nr__cell-precip-intensity ${intensityClass}"></div>` : ''}
							<div class="nr__cell nr__row-rain-prob nr__cell-rain-prob"><div class="nr__cell-rain-prob-value"></div></div>
							<div class="nr__cell nr__row-wind nr__cell-wind"></div>
							<div class="nr__cell nr__row-humidity nr__cell-humidity"></div>
							<div class="nr__cell nr__row-heat nr__cell-heat"></div>
						</div>
					`;
				}
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

		const modeClass = isListMode ? 'nr__mode-list' : (isBarChartMode ? 'nr__mode-bar-chart' : 'nr__mode-line-chart');
		const intervalClass = (currentInterval === 3) ? 'nr__interval-3h' : 'nr__interval-1h';
		container.innerHTML = `
			<div class="nr__hourly-grid-container ${modeClass} ${isMidTerm ? 'nr__tab-mid' : 'nr__tab-short'} ${intervalClass}">
				${fixedColHtml}
				${scrollViewportHtml}
			</div>
		`;

		// 고정 열 헤더 정보 툴팁 초기화
		const fixedTooltipEl = container.querySelector('.nr__fixed-header-cell .nr__fixed-info-btn, .nr__fixed-header-cell .nr__tooltip-wrap');
		if (fixedTooltipEl) {
			initDropdown(fixedTooltipEl);
		}

		// 리스트 모드가 아닐 때만 차트 레이어 렌더링
		if (!isListMode) {
			renderAllForecastCharts(container, validDates, {
				...options,
				forecastTab: currentForecastTab,
				isBarChartMode,
				currentInterval
			});
		}

		// 드래그 스크롤 이벤트 바인딩
		bindDragScroll();
		// 가로 스크롤 시 상단 스와이퍼/일정 날짜 연동 바인딩
		bindScrollSync();
	};

	renderComponentFn = renderComponent;
	if (targetEl) {
		targetEl._renderForecastComponent = renderComponent;
	}

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

	// 가로 스크롤 시 상단 Swiper / 일정 행 날짜 연동 바인딩
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

		const dateGroups = viewport.querySelectorAll('.nr__date-group, .nr__list-date-block');
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
			updateFixedTimeCell(activeDate);
			selectWeatherCard(activeDate, { fromScroll: true });
		}
	};

	// 뷰 모드 변경 처리 함수
	const switchViewMode = (newMode) => {
		if (!newMode) return;
		currentViewMode = newMode;
		try { sessionStorage.setItem('nr_forecast_view_mode', newMode); } catch (e) {}

		// 전체메뉴 설정 다이얼로그 스위치(#setting_sw_hourly_mode) 동기화 (mode3이면 표: checked, 그 외 그래프: unchecked)
		const hourlySwitch = document.querySelector('#setting_sw_hourly_mode');
		if (hourlySwitch) {
			hourlySwitch.checked = (newMode === 'mode3');
		}

		// 1. 데스크탑 버튼 동기화
		const viewBtns = document.querySelectorAll('.nr__hourly-view-btn');
		viewBtns.forEach(b => {
			if (b.dataset.view === newMode) {
				b.classList.add('active');
			} else {
				b.classList.remove('active');
			}
		});

		// 2. 모바일 드롭다운 메뉴 아이템 동기화
		const mobileViewBtns = document.querySelectorAll('.nr__hourly-settings-menu .nr__item-link[data-view]');
		mobileViewBtns.forEach(b => {
			if (b.dataset.view === newMode) {
				b.classList.add('active');
				b.setAttribute('aria-selected', 'true');
			} else {
				b.classList.remove('active');
				b.setAttribute('aria-selected', 'false');
			}
		});

		// 3. 모바일 드롭다운 인스턴스 동기화 및 닫기
		if (settingsDropdownInstance) {
			if (typeof settingsDropdownInstance.setActiveView === 'function') {
				settingsDropdownInstance.setActiveView(newMode);
			}
			if (typeof settingsDropdownInstance.close === 'function') {
				settingsDropdownInstance.close(false);
			}
		} else {
			const menu = document.getElementById('hourly-settings-menu');
			const trigger = document.querySelector('.nr__hourly-settings-btn');
			if (menu) menu.style.display = 'none';
			if (trigger) {
				trigger.classList.remove('active');
				trigger.setAttribute('aria-expanded', 'false');
			}
		}

		if (renderComponentFn) renderComponentFn();
		if (currentSelectedDate) {
			scrollToHourlyDate(currentSelectedDate);
		}
	};

	window.switchForecastViewMode = switchViewMode;

	// 단기예보 / 중기예보 탭 전환 함수 (nuri-web 탭 & nuri-app 상/하단 일정 행 공통)
	const switchForecastTab = (tabId, targetDateToScroll) => {
		if (!tabId) return;
		currentForecastTab = tabId;
		currentForecastType = tabId;
		if (targetDateToScroll) {
			currentSelectedDate = targetDateToScroll;
		}

		// 1. 데스크탑 탭 버튼 동기화 (nuri-web)
		const tabBtns = document.querySelectorAll('.nr__forecast-tab-btn');
		tabBtns.forEach(b => {
			if (b.dataset.tab === tabId) {
				b.classList.add('active');
			} else {
				b.classList.remove('active');
			}
		});

		// 2. 모바일 드롭다운 메뉴 탭 아이템 동기화 (nuri-web)
		const mobileTabBtns = document.querySelectorAll('.nr__hourly-settings-menu [data-tab]');
		mobileTabBtns.forEach(b => {
			if (b.dataset.tab === tabId) {
				b.classList.add('active');
				b.setAttribute('aria-selected', 'true');
			} else {
				b.classList.remove('active');
				b.setAttribute('aria-selected', 'false');
			}
		});

		// 3. 간격 라디오 버튼 그룹 노출 제어 (단기: 노출, 중기: 비노출)
		updateIntervalVisibility(tabId);

		// 4. nuri-app 상/하단 분리 일정 행 갱신
		const schedulesWrap = document.querySelector('.nr__forecast-schedules');
		if (schedulesWrap) {
			renderSchedules(schedulesWrap.parentElement);
		}

		// 5. 컴포넌트 재렌더링
		if (renderComponentFn) renderComponentFn();

		// 6. 날짜 활성화 및 스크롤 이동
		const activeData = rawWeatherData || data || [];
		const tabDates = activeData.filter(d => d.hourly && d.hourly.length > 0 && (currentForecastTab === 'short' ? d.forecastType === '단기예보' : d.forecastType === '중기예보'));
		let dateToGo = targetDateToScroll;
		if (!dateToGo && tabDates.length > 0) {
			const exists = tabDates.some(d => d.date === currentSelectedDate);
			dateToGo = exists ? currentSelectedDate : tabDates[0].date;
		}

		if (dateToGo) {
			selectWeatherCard(dateToGo, { fromScroll: false, skipTabSwitch: true, targetType: tabId });
			scrollToHourlyDate(dateToGo);
		}
	};

	// 외부 selectWeatherCard에서 호출 가능하도록 콜백 등록
	tabSwitcherFn = switchForecastTab;

	// 초기 렌더링
	updateIntervalVisibility(currentForecastTab);
	renderComponent();

	// 초기 선택 날짜로 스크롤 정렬
	if (currentSelectedDate) {
		scrollToHourlyDate(currentSelectedDate, 'auto');
	}

	// 정적 컨트롤 이벤트 바인딩 (지역 변경 등으로 재호출되어도 중복 등록 방지)
	const bindStaticControlEvents = () => {
		// 단기/중기 탭 버튼 이벤트 바인딩 (nuri-web)
		const tabBtns = document.querySelectorAll('.nr__forecast-tab-btn');
		tabBtns.forEach(btn => {
			if (btn.dataset.forecastBound === 'true') return;
			btn.dataset.forecastBound = 'true';
			btn.addEventListener('click', function () {
				if (tabSwitcherFn) tabSwitcherFn(this.dataset.tab);
			});
		});

		// 1시간 / 3시간 간격 라디오 버튼 이벤트 바인딩 (nuri-web: nr__interval_opt)
		const intervalRadios = document.querySelectorAll('input[name="nr__interval_opt"]');
		intervalRadios.forEach(radio => {
			if (radio.dataset.forecastBound === 'true') return;
			radio.dataset.forecastBound = 'true';
			radio.addEventListener('change', function () {
				currentInterval = parseInt(this.value, 10) || 1;
				if (renderComponentFn) renderComponentFn();
				if (currentSelectedDate) {
					scrollToHourlyDate(currentSelectedDate);
				}
			});
		});

		// 3시간 / 1시간 간격 라디오 버튼 이벤트 바인딩 (nuri-app: name="time")
		const appIntervalRadios = document.querySelectorAll('input[name="time"]');
		appIntervalRadios.forEach(radio => {
			if (radio.dataset.forecastBound === 'true') return;
			radio.dataset.forecastBound = 'true';
			radio.addEventListener('change', function () {
				if (!this.checked) return;
				currentInterval = (this.id === 'time1' || this.value === '3') ? 3 : 1;
				if (renderComponentFn) renderComponentFn();
				if (currentSelectedDate) {
					scrollToHourlyDate(currentSelectedDate);
				}
			});
		});

		// 데스크탑 뷰 모드 버튼 이벤트 바인딩
		const viewBtns = document.querySelectorAll('.nr__hourly-view-btn');
		viewBtns.forEach(btn => {
			if (btn.dataset.forecastBound === 'true') return;
			btn.dataset.forecastBound = 'true';
			btn.addEventListener('click', function () {
				switchViewMode(this.dataset.view);
			});
		});

		// 모바일 설정 드롭다운 메뉴 아이템 이벤트 바인딩 (뷰 모드 및 탭 전환)
		const mobileSettingsBtns = document.querySelectorAll('.nr__hourly-settings-menu .nr__item-link');
		mobileSettingsBtns.forEach(btn => {
			if (btn.dataset.forecastBound === 'true') return;
			btn.dataset.forecastBound = 'true';
			btn.addEventListener('click', function () {
				const mode = this.dataset.view;
				const tab = this.dataset.tab;
				if (mode) {
					switchViewMode(mode);
				} else if (tab && tabSwitcherFn) {
					tabSwitcherFn(tab);
				}
			});
		});

		// 모바일 설정 드롭다운 초기화
		const settingsDropdownEl = document.querySelector('.nr__hourly-settings-dropdown, .nr__hourly-settings-btn');
		if (settingsDropdownEl && !settingsDropdownInstance) {
			settingsDropdownInstance = initDropdown(settingsDropdownEl, {
				onSelect: (selectedValue, item) => {
					if (item && item.dataset.tab && tabSwitcherFn) {
						tabSwitcherFn(item.dataset.tab);
					} else if (item && item.dataset.view) {
						switchViewMode(item.dataset.view);
					} else if ((selectedValue === 'short' || selectedValue === 'mid') && tabSwitcherFn) {
						tabSwitcherFn(selectedValue);
					} else {
						switchViewMode(selectedValue);
					}
				}
			});
			if (settingsDropdownInstance && typeof settingsDropdownInstance.setActiveView === 'function') {
				settingsDropdownInstance.setActiveView(currentViewMode);
			}
		}
	};

	bindStaticControlEvents();

	// 임시 테스트 컨트롤러 패널 이벤트 바인딩 함수
	const initForecastTestPanel = () => {
		const panel = document.getElementById('hourly-forecast-test-panel');
		if (!panel || panel.dataset.initialized === 'true') return;
		panel.dataset.initialized = 'true';

		const chkPrecip = document.getElementById('test-check-precip-zero');
		const chkSnow = document.getElementById('test-check-snow-zero');
		const chkRainInt = document.getElementById('test-check-rain-int-zero');
		const chkSnowInt = document.getElementById('test-check-snow-int-zero');
		const btnReset = document.getElementById('btn-test-reset');

		const update = () => {
			testOverrides.zeroPrecip = Boolean(chkPrecip?.checked);
			testOverrides.zeroSnow = Boolean(chkSnow?.checked);
			testOverrides.zeroRainIntensity = Boolean(chkRainInt?.checked);
			testOverrides.zeroSnowIntensity = Boolean(chkSnowInt?.checked);
			if (renderComponentFn) renderComponentFn();
			if (currentSelectedDate) {
				scrollToHourlyDate(currentSelectedDate);
			}
		};

		chkPrecip?.addEventListener('change', update);
		chkSnow?.addEventListener('change', update);
		chkRainInt?.addEventListener('change', update);
		chkSnowInt?.addEventListener('change', update);

		btnReset?.addEventListener('click', () => {
			if (chkPrecip) chkPrecip.checked = false;
			if (chkSnow) chkSnow.checked = false;
			if (chkRainInt) chkRainInt.checked = false;
			if (chkSnowInt) chkSnowInt.checked = false;
			testOverrides.zeroPrecip = false;
			testOverrides.zeroSnow = false;
			testOverrides.zeroRainIntensity = false;
			testOverrides.zeroSnowIntensity = false;
			if (renderComponentFn) renderComponentFn();
			if (currentSelectedDate) {
				scrollToHourlyDate(currentSelectedDate);
			}
		});
	};

	initForecastTestPanel();
};

/**
 * 일별예보 컴포넌트 실행 함수 (7일치 요약 리스트 - nuri-app)
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
		.map((item) => {
			const amRainClean = String(item.amRain ?? 0).replace(/%$/, '');
			const pmRainClean = String(item.pmRain ?? 0).replace(/%$/, '');
			const minTempClean = String(item.minTemp ?? '').replace(/°C?$/i, '');
			const maxTempClean = String(item.maxTemp ?? '').replace(/°C?$/i, '');
			return `
		<li class="nr__daily-forecast-item">
			<div class="nr__daily-forecast-date">
				<strong class="text-14" data-text-color="theme1" data-weight="700">${item.dayOfWeek || item.day || ''}</strong>
				<span class="text-11" data-text-color="theme2" data-weight="600">${item.date}</span>
			</div>
			<div class="nr__daily-forecast-weather">
				<div class="nr__daily-forecast-weather-am">
					<span class="text-12" data-text-color="theme1" data-weight="600">${amRainClean}%</span>
					<i class="icon-aspect-${item.amIcon || 'NB01'}" data-size="32" aria-hidden="true"></i>
				</div>
				<span class="nr__daily-forecast-slash">/</span>
				<div class="nr__daily-forecast-weather-pm">
					<i class="icon-aspect-${item.pmIcon || 'NB01'}" data-size="32" aria-hidden="true"></i>
					<span class="text-12" data-text-color="theme1" data-weight="600">${pmRainClean}%</span>
				</div>
			</div>
			<div class="nr__daily-forecast-temp">
				<span class="text-16" data-text-color="blue" data-weight="700">${minTempClean}°</span>
				<span class="nr__daily-forecast-slash">/</span>
				<span class="text-16" data-text-color="red" data-weight="700">${maxTempClean}°</span>
			</div>
		</li>
	`;
		})
		.join('');
};

/**
 * 일출일몰 · 월출월몰 정보 렌더링 함수 (nuri-app)
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
 * 대기질 정보(초미세먼지, 미세먼지, 오존) 렌더링 함수 (nuri-app)
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
 * 생활기상지수(자외선, 대기정체, 꽃가루) 렌더링 함수 (nuri-app)
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
		`
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
 * 예보 UI 통합 실행 함수 (nuri-web & nuri-app 겸용)
 * - uiForecastExe(data, options) [nuri-web 방식]
 * - uiForecastExe(target, data, options) [nuri-app 방식]
 */
export const uiForecastExe = (arg1, arg2 = {}, arg3 = {}) => {
	let targetEl = null;
	let rawInput = null;
	let options = {};

	if (
		Array.isArray(arg1) ||
		(arg1 && typeof arg1 === 'object' && !(arg1 instanceof Element) && (arg1.weekly || arg1.locations))
	) {
		rawInput = arg1;
		options = arg2 || {};
		targetEl = document.getElementById('hourly-forecast-day') || document.querySelector('.nr__hourly-forecast');
	} else {
		targetEl = typeof arg1 === 'string'
			? (document.getElementById(arg1) || document.querySelector(arg1))
			: arg1;
		rawInput = arg2;
		options = arg3 || {};
	}

	if (!rawInput) return;

	const normalizedList = normalizeForecastData(rawInput);
	if (!normalizedList.length) return;

	// 방법 B 분기:
	// 1) nuri-web: 상단 Swiper(.nr__weather-swiper)가 존재하면 weatherSwiperExe 실행
	const hasWebSwiper = Boolean(document.querySelector('.nr__weather-swiper'));
	if (hasWebSwiper) {
		weatherSwiperExe(normalizedList);
	}

	// 2) nuri-app: 상/하단 분리형 일정 컨테이너(targetEl 또는 #hourly-forecast-day)가 존재하고 Swiper가 없으면 weekdayExe 실행
	const appScheduleTarget = targetEl || document.getElementById('hourly-forecast-day');
	if (!hasWebSwiper && appScheduleTarget) {
		weekdayExe(appScheduleTarget, normalizedList);
	}

	// 3) 시간별 예보 그리드 및 차트 실행 (nuri-web & nuri-app 공통)
	hourlyForecastExe(appScheduleTarget, normalizedList, options);

	// 4) 일별예보 섹션(#section-daily)이 존재하면 갱신 (nuri-app)
	const dailySection = document.querySelector('#section-daily');
	if (dailySection) {
		dailyForecastExe(dailySection, normalizedList);
	}
};

export const initForecast = uiForecastExe;
