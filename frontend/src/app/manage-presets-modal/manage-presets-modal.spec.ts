import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManagePresetsModal } from './manage-presets-modal';

describe('ManagePresetsModal', () => {
  let component: ManagePresetsModal;
  let fixture: ComponentFixture<ManagePresetsModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagePresetsModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManagePresetsModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
