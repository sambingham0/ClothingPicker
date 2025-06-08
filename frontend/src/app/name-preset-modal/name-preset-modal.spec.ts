import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NamePresetModal } from './name-preset-modal';

describe('NamePresetsModal', () => {
  let component: NamePresetModal;
  let fixture: ComponentFixture<NamePresetModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NamePresetModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NamePresetModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
