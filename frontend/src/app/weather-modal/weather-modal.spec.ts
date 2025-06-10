import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeatherModal } from './weather-modal';

describe('WeatherModal', () => {
  let component: WeatherModal;
  let fixture: ComponentFixture<WeatherModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeatherModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeatherModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
