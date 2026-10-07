export default class RangeSlider {
  constructor(opt) {
    const defaults = {
      tooltip: true,
      label: true,
      range: 0,
      pointerWidth: 18,

      labelArray:false,
      valueArray:false,
      labelAddText: ['',''],

      min:null,
      max:null,
      step: 1,
      value: null,

      callback:null,
    };

    this.option = { ...defaults, ...opt };
    this.rangeSlider = document.querySelector(`[data-rangeslider="${this.option.id}"]`);
    if (!this.rangeSlider) {
      return false;
    }

    this.rangeSliderWrapper = this.rangeSlider.querySelector(`.slider-wrapper`);
    this.rangeInput = document.querySelector(`#${this.option.id}`);

    this.tooltip = this.option.tooltip;
    this.label = this.option.label;
    this.range = this.option.range;
    this.labelAddText = this.option.labelAddText;
    this.pointerWidth = this.option.pointerWidth;

    this.labelArray = this.option.labelArray;
    this.valueArray = this.option.valueArray;
    this.callback = this.option.callback;

    if (this.valueArray) {
      this.option.min = 1;
      this.option.max = this.valueArray.length;
      this.rangeInput.min = 1;
      this.rangeInput.max = this.valueArray.length;
      this.rangeInput.step = 1;
    } else {
      
      this.option.min ? this.rangeInput.min = this.option.min : '';
      this.option.max ? this.rangeInput.max = this.option.max : '';
      this.rangeInput.step = this.option.step;
    }


    this.option.value !== null ? this.rangeInput.value = this.option.value : '';
    this.min = parseInt(this.rangeInput.min, 10);
    this.max = parseInt(this.rangeInput.max, 10);
    this.value = this.rangeInput.value;
    
    this.rangeLabel = null;
    this.updateRangeStyle = this.updateRangeStyle.bind(this);
  }

  init() {
    if (!this.rangeSlider) {
      return false;
    }
    // 기존의 요소와 이벤트 리스너를 제거합니다.
    this.clearElements();
    if (this.label) {
      this.rangeSlider.insertAdjacentHTML('beforeend', `<div data-rangeslider-text>${this.label[0]}</div>`);
      this.rangeSlider.insertAdjacentHTML('afterbegin', `<div data-rangeslider-text>${this.label[1]}</div>`);
    }
    if (this.tooltip) {
      if (this.labelArray) {
        this.rangeSliderWrapper.insertAdjacentHTML('beforeend', `<div data-rangeslider-label="${this.option.id}">${this.labelArray[Number(this.rangeInput.value) - 1]}</div>`);
      } else {
        if (this.range === 0) {
          this.rangeSliderWrapper.insertAdjacentHTML('beforeend', `<div data-rangeslider-label="${this.option.id}">${this.labelAddText[0]}${this.value}${this.labelAddText[1]}</div>`);
        } else {
          this.rangeSliderWrapper.insertAdjacentHTML('beforeend', `<div data-rangeslider-label="${this.option.id}">${this.labelAddText[0]}${this.rangeInput.min}~${this.rangeInput.max}${this.labelAddText[1]}</div>`);
        }
      }
      
      this.rangeLabel = this.rangeSliderWrapper.querySelector('[data-rangeslider-label]');
    }

    // 이벤트 리스너가 한 번만 추가되도록 합니다.
    this.removeEventListeners(); // 기존 리스너 제거
    this.rangeInput.addEventListener('input', this.updateRangeStyle);
    this.resizeHandler = () => { // 제거를 위해 핸들러 저장
      this.updateRangeLabel(parseInt(this.rangeInput.value, 10));
    };
    window.addEventListener('resize', this.resizeHandler);

    this.updateRangeStyle(this.rangeInput);
  }

  // 동적으로 추가된 요소를 지우는 새 메서드
  clearElements() {
    const existingLabels = this.rangeSlider.querySelectorAll('[data-rangeslider-text]');
    existingLabels.forEach(el => el.remove());

    const existingTooltip = this.rangeSliderWrapper.querySelector('[data-rangeslider-label]');
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }

  // 이벤트 리스너를 제거하는 새 메서드
  removeEventListeners() {
    this.rangeInput.removeEventListener('input', this.updateRangeStyle);
    if (this.resizeHandler) { // 핸들러가 존재하는지 확인 후 제거
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  // 새 reset 메서드
  reset(newOpt) {
    // 기존 요소 및 이벤트 리스너 정리
    this.clearElements();
    this.removeEventListeners();

    // 새 옵션을 기본값 및 현재 옵션과 병합
    const defaults = {
      tooltip: true,
      label: true,
      range: 1,
      pointerWidth: 18,

      labelArray:false,
      valueArray:false,
      labelAddText: ['',''],

      min:null,
      max:null,
      step: 1,
      value: null,
      calllback:null,
    };
    this.option = { ...defaults, ...this.option, ...newOpt };

    // 새 옵션에 따라 속성 재할당
    this.tooltip = this.option.tooltip;
    this.label = this.option.label;
    this.range = this.option.range;
    this.labelAddText = this.option.labelAddText;
    this.pointerWidth = this.option.pointerWidth;

    this.labelArray = this.option.labelArray;
    this.valueArray = this.option.valueArray;
    this.callback = this.option.callback;

    if (this.valueArray) {
      this.option.min = 1;
      this.option.max = this.valueArray.length;
      this.rangeInput.min = 1;
      this.rangeInput.max = this.valueArray.length;
      this.rangeInput.step = 1;
    } else {
      this.option.min ? this.rangeInput.min = this.option.min : '';
      this.option.max ? this.rangeInput.max = this.option.max : '';
      this.rangeInput.step = this.option.step;
    }

    this.option.value ? this.rangeInput.value = this.option.value : '';
    this.min = parseInt(this.rangeInput.min, 10);
    this.max = parseInt(this.rangeInput.max, 10);
    this.value = this.rangeInput.value;

    // 새 옵션으로 슬라이더 재초기화
    this.init();

    // (선택 사항) 슬라이더 값을 기본값 (예: 최소값)으로 설정하거나 새 옵션에 따라 설정
    // this.rangeInput.value = this.min;
    this.updateRangeStyle(this.rangeInput);
  }

  updateValue(v) {
    this.rangeInput.value = v;
    this.updateRangeStyle(v);
  }

  updateRangeStyle(target) {
    let value;
    if (typeof target === 'number') {
      value = target;
      
    } else {
      if (target.target) {
        value = (parseInt(target.target.value, 10));
      } else {
        value = (parseInt(target.value, 10));
      }
    }
   
    const percent = ((value - this.min) / (this.max - this.min)) * 100;
    this.rangeInput.style.setProperty('--percent', `${percent}%`);
    this.tooltip && this.updateRangeLabel(value);
    this.callback && this.callback(value);
  }

  updateRangeLabel(value) {
    const range = this.max - this.min;
    const end = value + this.range > this.max ? this.max : value + this.range;
    
    if (this.rangeLabel) {
      if (this.labelArray) {
        this.rangeLabel.textContent = this.labelArray[Number(this.rangeInput.value) - 1];
      } else {
        this.rangeLabel.textContent = (this.range === 0) ? `${this.labelAddText[0]}${value}${this.labelAddText[1]}` : `${this.labelAddText[0]}${value} ~ ${end}${this.labelAddText[1]}`;
      }

      const percent = (value - this.min) / range;
      const left = percent * 100;
      const add = left < 50 ?
        (this.pointerWidth / 2) * (Math.abs((left - 50) * 2) / 100) :
        (this.pointerWidth / 2) * (Math.abs((left - 50) * 2) / 100) * -1;
      this.rangeLabel.style.left = `calc(${left}% + ${add}px)`;
    }
  }
}