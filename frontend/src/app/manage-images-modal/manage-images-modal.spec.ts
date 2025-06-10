import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageImagesModal } from './manage-images-modal';

describe('ManageImagesModal', () => {
  let component: ManageImagesModal;
  let fixture: ComponentFixture<ManageImagesModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManageImagesModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ManageImagesModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
