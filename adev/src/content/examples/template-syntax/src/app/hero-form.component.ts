import {Component, Input, ViewChild} from '@angular/core';
import {FormsModule, NgForm} from '@angular/forms';

import {Hero} from './hero';

@Component({
  standalone: true,
  selector: 'app-hero-form',
  templateUrl: './hero-form.component.html',
  imports: [FormsModule],
  styles: [
    `
    button { margin: 6px 0; }
    #heroForm { border: 1px solid black; margin: 20px 0; padding: 8px; max-width: 350px; }
  `,
  ],
})
export class HeroFormComponent {
  @Input() hero!: Hero;
  @ViewChild('heroForm') form!: NgForm;

  private _submitMessage = '';

  get submitMessage() {
    if (this.form && !this.form.valid) {
      this._submitMessage = '';
    }
    return this._submitMessage;
  }

  onSubmit(form: NgForm) {
    this._submitMessage = 'Submitted. form value is ' + JSON.stringify(form.value);
  }
}
