export default class RangeSliderDual {
  constructor(opt) {
    this.id = opt.id;
    this.values = opt.value;
    this.title = opt.title || '';
    this.isText = !!opt.text ? opt.text : false;
    this.step = opt.step || 1;
    this.tickmark = opt.tickmark || false;
    this.marks = opt.marks || null; // ⭐ 새 옵션: 슬라이더 트랙 내부 마크
    
    // ⭐ 단일값 모드인지 확인 (배열이 아니거나 길이가 1인 경우)
    this.isSingleMode = !Array.isArray(this.values) || this.values.length === 1;
    if (this.isSingleMode) {
      this.values = Array.isArray(this.values) ? [this.values[0]] : [this.values];
    }
    
    // ⭐ 새 옵션: 세로형 슬라이더 여부
    this.orientation = opt.orientation || 'horizontal';
    this.isVertical = this.orientation === 'vertical';

    this.el_range = document.querySelector(`.ui-range[data-id="${this.id}"]`);
    if (!this.el_range) {
      console.error(`Element with data-id="${this.id}" not found.`);
      return;
    }

    this.el_from = this.el_range.querySelector('.ui-range-inp[data-range="from"]');
    this.el_to = this.el_range.querySelector('.ui-range-inp[data-range="to"]');
    this.min = opt.min || Number(this.el_from.min);
    this.max = opt.max || Number(this.el_from.max);
    this.eventName = (typeof Global !== 'undefined' && Global.state.browser.ie) ? 'click' : 'input';
  }

  init() {
    if (this.isVertical) {
      this.el_range.classList.add('is-vertical');
    }
    this.setupInputs();
    this.renderSlider();
    this.updateSlider();
    this.bindEvents();
  }

  setupInputs() {
    this.el_from.min = this.min;
    this.el_from.max = this.max;
    this.el_from.step = this.step;
    this.el_from.value = this.values[0];
    this.el_from.setAttribute('tabindex', -1);

    if (this.el_to && !this.isSingleMode) {
      this.el_to.min = this.min;
      this.el_to.max = this.max;
      this.el_to.step = this.step;
      this.el_to.value = this.values[1];
      this.el_to.setAttribute('tabindex', -1);
    }
  }

  renderSlider() {
    const existingTrack = this.el_range.querySelector('.ui-range-track');
    const existingMarks = this.el_range.querySelectorAll('.ui-range-marks');

    existingTrack?.remove();
    existingMarks.forEach(mark => mark.remove());

    let html = `
      <div class="ui-range-track">
        <div class="ui-range-bar"></div>
        <span class="left ui-range-point" data-range="from" aria-hidden="true">
          <em class="ui-range-txt" data-from="${this.id}"></em>
        </span>
    `;

    if (this.el_to && !this.isSingleMode) {
      html += `
        <span class="right ui-range-point" data-range="to" aria-hidden="true">
          <em class="ui-range-txt" data-to="${this.id}"></em>
        </span>
      `;
    }

    // Add marks inside track if specified
    if (this.marks && Array.isArray(this.marks)) {
      html += `<div class="ui-range-marks">`;
      this.marks.forEach(mark => {
        html += `<span>${mark}</span>`;
      });
      html += `</div>`;
    }

    html += `</div>`;

    

    if (this.tickmark) {
      const len = this.tickmark.length;
      const stepValue = (this.max - this.min) / (len - 1);

      html += `<div class="ui-range-marks" id="${this.id}_tickmarks_from" data-from="true">`;
      for (let i = 0; i < len; i++) {
        const value = this.min + (stepValue * i);
        html += this.createTickmarkButton(value, 'from', this.title, this.tickmark[i]);
      }
      html += '</div>';

      if (this.el_to && !this.isSingleMode) {
        html += `<div class="ui-range-marks" id="${this.id}_tickmarks_to" data-to="true">`;
        for (let i = 0; i < len; i++) {
          const value = this.min + (stepValue * i);
          html += this.createTickmarkButton(value, 'to', this.title, this.tickmark[i]);
        }
        html += '</div>';
      }
    }

    this.el_range.insertAdjacentHTML('beforeend', html);
    this.el_left = this.el_range.querySelector(".ui-range-point.left");
    this.el_right = this.el_range.querySelector(".ui-range-point.right");
    this.el_bar = this.el_range.querySelector(".ui-range-bar");
    this.el_marks_from = this.el_range.querySelector(`#${this.id}_tickmarks_from`);
    this.el_marks_to = this.el_range.querySelector(`#${this.id}_tickmarks_to`);
  }

  createTickmarkButton(value, type, title, text) {
    const selectedState = '';
    let ariaLabel;
    if (this.isSingleMode) {
      ariaLabel = `${title}`;
    } else {
      ariaLabel = type === 'to' ? `${title} 최대` : `${title} 최소`;
    }
    return `
      <button class="ui-range-btn" data-id="${this.id}" type="button" data-value="${value}">
        <span class="a11y-hidden">${ariaLabel} </span>
        <span>${text}</span>
        <span class="a11y-hidden state">${selectedState}</span>
      </button>
    `;
  }

  bindEvents() {
    // Input events
    this.el_from.addEventListener(this.eventName, this.updateSlider);
    if (this.el_to && !this.isSingleMode) {
      this.el_to.addEventListener(this.eventName, this.updateSlider);
    }

    // Tickmark events
    this.el_range.querySelectorAll('.ui-range-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleClick(e));
    });

    // Handle events for slider points (mouse/touch)
    if (!this.isMobile()) {
      this.el_left.addEventListener('mouseover', (e) => this.handlePointHover(e));
      if (this.el_to && !this.isSingleMode) {
        this.el_right.addEventListener('mouseover', (e) => this.handlePointHover(e));
      }
    } else {
      this.el_left.addEventListener('touchstart', (e) => this.handlePointTouch(e));
      if (this.el_to && !this.isSingleMode) {
        this.el_right.addEventListener('touchstart', (e) => this.handlePointTouch(e));
      }
    }
  }

  updateSlider = (e) => {
    if (e) {
      const _this = e.currentTarget;
      const type = _this.dataset.range;
      
      if (type === 'from') {
        this.updateFromRange();
      } else if (this.el_to && !this.isSingleMode) {
          this.updateToRange();
      }
    } else {
      this.updateFromRange();
      if (this.el_to && !this.isSingleMode) {
        this.updateToRange();
      }
    }
    if (this.el_to && !this.isSingleMode) {
      this.checkSameValue();
    } 
  }

  updateFromRange(value = this.el_from.value) {
    let fromValue = +value;
    if (this.el_to && !this.isSingleMode && (+this.el_to.value - fromValue < 0)) {
      fromValue = +this.el_to.value;
      this.el_from.value = fromValue;
    }

    const percent = ((fromValue - this.min) / (this.max - this.min)) * 100;
    this.el_left.style.left = `${percent}%`;
    
    if (this.isSingleMode) {
      // 단일 모드에서는 바가 시작점부터 현재 위치까지
      this.el_bar.style.left = '0%';
      this.el_bar.style.right = `${100 - percent}%`;
      this.el_from.setAttribute('aria-label', `${this.title} ${this.isText[fromValue] || fromValue}`);
    } else {
      this.el_bar.style.left = `${percent}%`;
      this.el_from.setAttribute('aria-label', `${this.title} 최소 ${this.isText[fromValue] || fromValue}`);
    }

    this.updateTextDisplay('from', fromValue);
    this.updateTickmarks('from', fromValue);
    this.el_range.setAttribute('data-from', fromValue);
    this.el_from.classList.add('on');
    this.el_left.classList.add('on');
    if (!this.isSingleMode) {
      this.el_to?.classList.remove('on');
      this.el_right?.classList.remove('on');
    }
  }

  updateToRange(value = this.el_to.value) {
    let toValue = +value;
    if (+toValue - +this.el_from.value < 0) {
      toValue = +this.el_from.value;
      this.el_to.value = toValue;
    }

    const percent = ((toValue - this.min) / (this.max - this.min)) * 100;
    this.el_right.style.right = `${100 - percent}%`;
    this.el_bar.style.right = `${100 - percent}%`;
    this.el_to.setAttribute('aria-label', `${this.title} 최대 ${this.isText[toValue]}`);

    this.updateTextDisplay('to', toValue);
    this.updateTickmarks('to', toValue);
    this.el_range.setAttribute('data-to', toValue);
    this.el_to.classList.add('on');
    this.el_right.classList.add('on');
    this.el_from.classList.remove('on');
    this.el_left.classList.remove('on');
  }

  updateTextDisplay(type, value) {
    const dataAttribute = type === 'from' ? `[data-from="${this.id}"]` : `[data-to="${this.id}"]`;
    const elements = document.querySelectorAll(dataAttribute);

    elements.forEach(el => {
      el.textContent = this.isText[value] || value;
    });
  }

  updateTickmarks(type, currentValue) {
    if (!this.tickmark) return;

    const fromMarks = this.el_marks_from?.querySelectorAll('.ui-range-btn') || [];
    const toMarks = this.el_marks_to?.querySelectorAll('.ui-range-btn') || [];
    
    // Update 'from' tickmarks
    fromMarks.forEach(btn => {
      const btnValue = Number(btn.dataset.value);
      this.resetTickmarkState(btn);
      if (currentValue === btnValue) {
        this.setTickmarkState(btn, 'from', '선택됨');
      } else if (this.el_to && !this.isSingleMode && Number(this.el_to.value) < btnValue) {
        this.setTickmarkDisabled(btn);
      }
    });

    // Update 'to' tickmarks (only in dual mode)
    if (this.el_to && !this.isSingleMode) {
      toMarks.forEach(btn => {
        const btnValue = Number(btn.dataset.value);
        this.resetTickmarkState(btn);
        if (Number(this.el_to.value) === btnValue) {
          this.setTickmarkState(btn, 'to', '선택됨');
        } else if (Number(this.el_from.value) > btnValue) {
          this.setTickmarkDisabled(btn);
        }
      });
    }
  }

  resetTickmarkState(btn) {
    btn.dataset.from = 'false';
    btn.dataset.to = 'false';
    btn.querySelector('.state').textContent = '';
    btn.disabled = false;
    btn.removeAttribute('tabindex');
    btn.removeAttribute('role');
  }

  setTickmarkState(btn, type, stateText) {
    btn.dataset[type] = 'true';
    btn.querySelector('.state').textContent = stateText;
  }

  setTickmarkDisabled(btn) {
    btn.disabled = true;
    btn.setAttribute('tabindex', -1);
    btn.setAttribute('role', 'none');
  }

  checkSameValue() {
    if (this.el_from.value === this.el_to.value) {
      this.el_range.classList.add('same');
    } else {
      this.el_range.classList.remove('same');
    }
  }

  handleClick(e) {
    const btn = e.currentTarget;
    const value = Number(btn.dataset.value);
    const marks = btn.closest('.ui-range-marks');
    const isFrom = !!marks.dataset.from;
    
    if (isFrom || this.isSingleMode) {
      this.updateFromRange(value);
    } else {
      this.updateToRange(value);
    }
  }

  handlePointHover(e) {
    const rangeType = e.currentTarget.dataset.range;
    if (rangeType === 'to') {
      this.el_to.classList.add('on');
      this.el_from.classList.remove('on');
      this.el_to.focus();
    } else {
      this.el_from.classList.add('on');
      this.el_to?.classList.remove('on');
      this.el_from.focus();
    }
  }

  handlePointTouch(e) {
    const rangeType = e.currentTarget.dataset.range;
    if (rangeType === 'to') {
      this.el_right.classList.add('on');
      this.el_left.classList.remove('on');
      this.el_to.classList.add('on');
      this.el_from.classList.remove('on');
      this.el_to.focus();
    } else {
      this.el_left.classList.add('on');
      this.el_right.classList.remove('on');
      this.el_from.classList.add('on');
      this.el_to.classList.remove('on');
      this.el_from.focus();
    }
  }

  isMobile() {
    return (typeof Global !== 'undefined' && Global.state.device.mobile);
  }
}

// To use this class, you would create a new instance like this:
// 
// Dual range slider:
// const myDualSlider = new RangeSliderDual({
//   id: 'your_slider_id',
//   value: [0, 50],
//   title: 'Your Slider Title',
//   min: 0,
//   max: 100,
//   step: 1,
//   text: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
//   tickmark: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
//   marks: [0, 0.5, 1] // Static marks inside track
// });
//
// Single slider:
// const mySingleSlider = new RangeSliderDual({
//   id: 'your_single_slider_id',
//   value: 25, // or [25]
//   title: 'Your Single Slider Title',
//   min: 0,
//   max: 100,
//   step: 1,
//   text: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
//   tickmark: ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
//   marks: [0, 0.5, 1] // Static marks inside track
// });