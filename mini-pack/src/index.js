import { fetchGrade } from './fetchGrade.js';

const elem = document.createElement('div');
elem.innerText = `Jerry 的高考成绩：${fetchGrade('Jerry')}`;

document.getElementById('app').appendChild(elem);
