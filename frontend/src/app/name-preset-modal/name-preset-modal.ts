import { Component, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-name-preset-modal',
  templateUrl: './name-preset-modal.html',
  styleUrl: './name-preset-modal.css',
  imports: [CommonModule, FormsModule]
})
export class NamePresetModal {
  private _visible = false;
  presetName = '';
  
  @Output() presetNamed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.presetName = '';
    }
  }

  get visible(): boolean {
    return this._visible;
  }

  save() {
    if (this.presetName.trim()) {
      this.presetNamed.emit(this.presetName.trim());
      this.visible = false;
    }
  }

  cancel() {
    this.cancelled.emit();
    this.visible = false;
  }
}